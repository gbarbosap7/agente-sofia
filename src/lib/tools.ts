import { Prisma, type Agent, type Conversation } from "@prisma/client";
import { prisma } from "./prisma";
import { joinbank, TAXA_REF_INSS } from "./joinbank";
import { rvx } from "./rvx";
import { alertOwner, sendEvoMessage } from "./evolution";
import { dc } from "@/channels/datacrazy/client";
import { searchRag } from "./rag";
import { getChannelConfig } from "./agent";

// import lazy de queue pra evitar ciclo (queue → gemini → tools)
async function enqueueSignaturePoll(data: { conversationId: string; contractId: string }) {
  const { enqueueSignaturePoll: fn } = await import("./queue");
  return fn(data);
}

/**
 * Tool registry da Sofia.
 *
 * Cada tool tem:
 *  - schema (Gemini function declaration: name, description, parameters)
 *  - execute(args, ctx): roda e retorna saida JSON-serializavel
 *
 * Toda execucao gera linha em v2_tool_calls (status pending → success|error).
 */

export interface ToolCtx {
  agent: Agent;
  conversation: Conversation;
}

export interface ToolDef {
  declaration: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
  execute(args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown>;
}

function onlyDigits(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

// =====================================================================
// extract_cpf — guarda o CPF da conversa em metadata.cpf
// =====================================================================
const extract_cpf: ToolDef = {
  declaration: {
    name: "extract_cpf",
    description:
      "Persiste o CPF do cliente. Use quando o usuario digitar um CPF (mesmo com pontos/traços).",
    parameters: {
      type: "object",
      properties: {
        cpf: { type: "string", description: "CPF, qualquer formatacao." },
        name: { type: "string", description: "Nome completo se ja foi informado." },
      },
      required: ["cpf"],
    },
  },
  async execute(args, { conversation }) {
    const cpf = onlyDigits(args.cpf);
    if (cpf.length !== 11) return { ok: false, error: "cpf_invalido" };
    const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
    meta.cpf = cpf;
    if (typeof args.name === "string") meta.name = args.name;
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        metadata: meta as Prisma.InputJsonValue,
        contactName:
          typeof args.name === "string" && args.name.trim().length > 0
            ? args.name.trim()
            : conversation.contactName,
      },
    });
    return { ok: true, cpf };
  },
};

// =====================================================================
// consult_joinbank — chama JoinBank, persiste simulacao em metadata.simulation
// =====================================================================
const consult_joinbank: ToolDef = {
  declaration: {
    name: "consult_joinbank",
    description:
      "Consulta o JoinBank pra simular CLT consignado. Bloqueia ate ter resposta. Use APOS extract_cpf.",
    parameters: {
      type: "object",
      properties: {
        cpf: { type: "string" },
      },
      required: ["cpf"],
    },
  },
  async execute(args, { conversation }) {
    const cpf = onlyDigits(args.cpf);
    const sim = await joinbank.consult(cpf, conversation.contactName ?? undefined);
    const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
    meta.simulation = sim;
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { metadata: meta as Prisma.InputJsonValue },
    });
    return sim;
  },
};

// =====================================================================
// send_signature_link — gera link de assinatura, manda via DC
// =====================================================================
const send_signature_link: ToolDef = {
  declaration: {
    name: "send_signature_link",
    description:
      "Gera link de assinatura JoinBank e envia ao cliente via WhatsApp. Use APOS aceite + chave PIX.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        installments: { type: "number" },
        pix_key: { type: "string" },
      },
      required: ["amount", "installments", "pix_key"],
    },
  },
  async execute(args, { conversation }) {
    const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
    const cpf = String(meta.cpf ?? "");
    if (!cpf) return { ok: false, error: "cpf_ausente" };

    const link = await joinbank.sendSignatureLink({
      cpf,
      amount: Number(args.amount),
      installments: Number(args.installments),
      pixKey: String(args.pix_key),
    });

    meta.contractId = link.contractId;
    meta.signatureUrl = link.url;
    meta.pixKey = String(args.pix_key);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { metadata: meta as Prisma.InputJsonValue },
    });

    // envia o link pelo DC (mensagem extra alem da resposta da Sofia)
    if (conversation.externalConvId) {
      await dc.sendMessage({
        conversationId: conversation.externalConvId,
        text: `Aqui o link da assinatura: ${link.url}`,
      });
    }

    // enfileira polling de status (worker checa a cada 60s ate signed=true)
    await enqueueSignaturePoll({
      conversationId: conversation.id,
      contractId: link.contractId,
    });

    return { ok: true, ...link };
  },
};

// =====================================================================
// transfer_human — desliga IA + transfere departamento
// =====================================================================
const transfer_human: ToolDef = {
  declaration: {
    name: "transfer_human",
    description:
      "Transfere a conversa pra atendente humano. Use SOMENTE quando o cliente pedir explicitamente OU quando voce nao souber responder.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Motivo curto pro CRM." },
        department_id: {
          type: "string",
          description: "ID do departamento DC (opcional). Se omitido, so desliga IA.",
        },
      },
      required: ["reason"],
    },
  },
  async execute(args, { agent, conversation }) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { aiEnabled: false, handoffReason: String(args.reason) },
    });
    if (conversation.channel === "evolution") {
      // Evolution nao tem departamentos — so desliga IA e manda nota
      const cfg = getChannelConfig(agent);
      await sendEvoMessage({
        number: conversation.phone,
        text: "Um momento! Vou te conectar com um atendente.",
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        instance: cfg.instance,
      }).catch(() => null);
    } else if (args.department_id && conversation.externalConvId) {
      await dc.transferDepartment(conversation.externalConvId, String(args.department_id));
    }
    await alertOwner(
      `transbordo: ${conversation.contactName ?? conversation.phone} — ${args.reason}`,
    );
    return { ok: true };
  },
};

// =====================================================================
// finish_conversation — encerra educadamente
// =====================================================================
const finish_conversation: ToolDef = {
  declaration: {
    name: "finish_conversation",
    description:
      "Encerra a conversa (cliente recusou, nao tem perfil, ja eh cliente, etc).",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
      required: ["reason"],
    },
  },
  async execute(args, { conversation }) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: "closed", handoffReason: String(args.reason) },
    });
    if (conversation.channel !== "evolution" && conversation.externalConvId) {
      try { await dc.finishConversation(conversation.externalConvId); }
      catch { /* ignora */ }
    }
    return { ok: true };
  },
};

// =====================================================================
// alert_owner — manda WhatsApp pro dono (conversao)
// =====================================================================
const alert_owner: ToolDef = {
  declaration: {
    name: "alert_owner",
    description:
      "Envia alerta pro dono do bot via WhatsApp (numero ALERT_PHONE). Use em conversoes ou eventos importantes.",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  async execute(args) {
    return alertOwner(String(args.message));
  },
};

// =====================================================================
// rag_search — busca na base de conhecimento (PDF/MD ingeridos)
// =====================================================================
const rag_search: ToolDef = {
  declaration: {
    name: "rag_search",
    description:
      "Busca trechos relevantes na base de conhecimento (politicas, FAQ, comissionamento). Use quando o cliente perguntar algo que pode estar em documento interno.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "consulta livre em portugues" },
        top_k: { type: "number", description: "quantos trechos retornar (1-6)" },
      },
      required: ["query"],
    },
  },
  async execute(args, { agent }) {
    const k = Math.max(1, Math.min(6, Number(args.top_k ?? 4)));
    const hits = await searchRag(String(args.query), k, "client", agent.id);
    return {
      results: hits.map((h) => ({
        title: h.documentTitle,
        content: h.content,
        similarity: Number(h.similarity.toFixed(3)),
      })),
    };
  },
};

// =====================================================================
// consult_rvx — consulta elegibilidade + simulacao INSS portabilidade (Ana)
// =====================================================================
const consult_rvx: ToolDef = {
  declaration: {
    name: "consult_rvx",
    description:
      "Consulta elegibilidade e simulacao de portabilidade consignado INSS pelo CPF. Use APOS extract_cpf. Retorna: eligible, nome, margem, valor_liberado, parcela, taxa, banco_atual.",
    parameters: {
      type: "object",
      properties: {
        cpf: { type: "string", description: "CPF do cliente (qualquer formatacao)" },
      },
      required: ["cpf"],
    },
  },
  async execute(args, { conversation }) {
    const cpf = onlyDigits(args.cpf);
    if (cpf.length !== 11) return { ok: false, error: "cpf_invalido" };

    const rvxResult = await rvx.consult(cpf);
    const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};

    if (!rvxResult.eligible) {
      meta.rvxSimulation = { eligible: false, reason: rvxResult.reason };
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { metadata: meta as Prisma.InputJsonValue },
      });
      return { eligible: false, reason: rvxResult.reason, nome: rvxResult.nome };
    }

    // Calcula oferta JoinBank para cada emprestimo elegivel; seleciona a de maior economia
    let bestLoan: Record<string, unknown> | null = null;
    let bestEconomy = -Infinity;

    for (const emp of rvxResult.emprestimosElegiveis) {
      const parcelasRestantes = Number(emp.ParcelasRestantes ?? emp.Prazo ?? 60);
      const loanValue = Number(emp.Quitacao ?? 0);
      const currentInstallment = Number(emp.ValorParcela ?? 0);
      const lenderCode = Number(emp.Banco ?? 0);
      const contractNumber = String(emp.Contrato ?? "");
      const totalTerm = Number(emp.Prazo ?? parcelasRestantes);

      if (!loanValue || !currentInstallment || !lenderCode) continue;

      try {
        const calc = await joinbank.calcInss({
          term: parcelasRestantes,
          installmentValue: currentInstallment,
          loanValue,
          lenderCode,
          contractNumber,
          totalTerm,
          installmentsRemaining: parcelasRestantes,
          currentInstallment,
          dueBalance: loanValue,
        });

        const novaParcela = calc.installmentValue ?? currentInstallment;
        const economy = currentInstallment - novaParcela;

        if (economy > bestEconomy) {
          bestEconomy = economy;
          bestLoan = {
            banco: lenderCode,
            bancoNome: emp.BancoNome ?? String(emp.Banco ?? ""),
            contrato: contractNumber,
            prazo: totalTerm,
            parcelasRestantes,
            parcelaAtual: currentInstallment,
            saldoDevedor: loanValue,
            taxaAtual: Number(emp.Taxa ?? 0),
            novaParcela,
            novaTaxa: calc.rate ?? TAXA_REF_INSS,
            economy: Number(economy.toFixed(2)),
          };
        }
      } catch {
        // JoinBank indisponivel — registra com dados brutos do RVX
        const economy = currentInstallment * 0.05; // estimativa conservadora de 5% reducao
        if (economy > bestEconomy) {
          bestEconomy = economy;
          bestLoan = {
            banco: lenderCode,
            bancoNome: emp.BancoNome ?? String(emp.Banco ?? ""),
            contrato: contractNumber,
            prazo: totalTerm,
            parcelasRestantes,
            parcelaAtual: currentInstallment,
            saldoDevedor: loanValue,
            taxaAtual: Number(emp.Taxa ?? 0),
            novaParcela: null,
            novaTaxa: TAXA_REF_INSS,
            economy: null,
          };
        }
      }
    }

    const simulation = {
      eligible: true,
      nome: rvxResult.nome,
      nomeCompleto: rvxResult.nomeCompleto,
      numeroBeneficio: rvxResult.numeroBeneficio,
      valorBeneficio: rvxResult.valorBeneficio,
      situacaoBeneficio: rvxResult.situacaoBeneficio,
      margemDisponivel: rvxResult.margemDisponivel,
      bestLoan,
      emprestimosElegiveis: rvxResult.emprestimosElegiveis,
      phones: rvxResult.phones,
    };

    meta.rvxSimulation = simulation;
    if (rvxResult.nome && !meta.name) meta.name = rvxResult.nome;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        metadata: meta as Prisma.InputJsonValue,
        contactName: rvxResult.nome && !conversation.contactName ? rvxResult.nome : conversation.contactName,
      },
    });

    return simulation;
  },
};

// =====================================================================
// collect_bank_data — grava dados bancarios na metadata da conversa (Ana)
// =====================================================================
const collect_bank_data: ToolDef = {
  declaration: {
    name: "collect_bank_data",
    description:
      "Salva banco, agencia e conta do cliente na conversa. Use depois do aceite da proposta.",
    parameters: {
      type: "object",
      properties: {
        banco: { type: "string", description: "Nome ou codigo do banco." },
        agencia: { type: "string", description: "Numero da agencia." },
        conta: { type: "string", description: "Numero da conta com digito." },
        tipo_conta: {
          type: "string",
          description: "corrente ou poupanca (opcional, default corrente).",
        },
      },
      required: ["banco", "agencia", "conta"],
    },
  },
  async execute(args, { conversation }) {
    const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
    meta.bankData = {
      banco: String(args.banco),
      agencia: String(args.agencia),
      conta: String(args.conta),
      tipo_conta: String(args.tipo_conta ?? "corrente"),
    };
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { metadata: meta as Prisma.InputJsonValue },
    });
    return { ok: true };
  },
};

// =====================================================================
// request_documents — solicita foto RG + selfie via Evolution (Ana)
// =====================================================================
const request_documents: ToolDef = {
  declaration: {
    name: "request_documents",
    description:
      "Envia mensagem pedindo foto do RG (frente e verso) e selfie segurando o documento. Use apos coletar dados bancarios.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  async execute(_args, { agent, conversation }) {
    const nome = conversation.contactName ?? "cliente";
    const msg =
      `Perfeito, ${nome}! Pra finalizar, preciso de:\n` +
      `1️⃣ Foto do seu *RG* (frente e verso)\n` +
      `2️⃣ Uma *selfie* segurando o documento aberto\n\n` +
      `Pode enviar por aqui mesmo 😊`;

    if (conversation.channel === "evolution") {
      const cfg = getChannelConfig(agent);
      await sendEvoMessage({
        number: conversation.phone,
        text: msg,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        instance: cfg.instance,
      });
    } else if (conversation.externalConvId) {
      await dc.sendMessage({ conversationId: conversation.externalConvId, text: msg });
    }

    const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
    meta.docsRequested = true;
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { metadata: meta as Prisma.InputJsonValue },
    });

    return { ok: true };
  },
};

// =====================================================================
// formalize_proposal — submete proposta ao RVX e retorna link assinatura (Ana)
// =====================================================================
const formalize_proposal: ToolDef = {
  declaration: {
    name: "formalize_proposal",
    description:
      "Formaliza a proposta de portabilidade no RVX usando CPF + dados bancarios ja coletados. Retorna link de assinatura pra enviar ao cliente. Use somente apos ter dados bancarios E documentos confirmados.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  async execute(_args, { agent, conversation }) {
    const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
    const cpf = String(meta.cpf ?? "");
    if (!cpf) return { ok: false, error: "cpf_ausente" };

    const bank = meta.bankData as Record<string, string> | undefined;
    if (!bank?.banco || !bank?.agencia || !bank?.conta) {
      return { ok: false, error: "dados_bancarios_ausentes" };
    }

    const sim = meta.rvxSimulation as Record<string, unknown> | undefined;
    if (!sim?.eligible) return { ok: false, error: "simulacao_ausente" };

    const bestLoan = sim.bestLoan as Record<string, unknown> | undefined;
    if (!bestLoan) return { ok: false, error: "sem_oferta_elegivel" };

    const nome = conversation.contactName ?? String(sim.nomeCompleto ?? "");
    const numeroBeneficio = String(sim.numeroBeneficio ?? "");
    const valorBeneficio = Number(sim.valorBeneficio ?? 0);

    const result = await joinbank.createInssSimulation({
      cpf,
      nome,
      beneficio: numeroBeneficio,
      income: valorBeneficio,
      phone: conversation.phone,
      term: Number(bestLoan.parcelasRestantes ?? 60),
      installmentValue: Number(bestLoan.novaParcela ?? bestLoan.parcelaAtual ?? 0),
      loanValue: Number(bestLoan.saldoDevedor ?? 0),
      lenderCode: Number(bestLoan.banco ?? 0),
      contractNumber: String(bestLoan.contrato ?? ""),
      totalTerm: Number(bestLoan.prazo ?? 60),
      currentInstallment: Number(bestLoan.parcelaAtual ?? 0),
      dueBalance: Number(bestLoan.saldoDevedor ?? 0),
      creditBank: {
        name: bank.banco,
        branch: bank.agencia,
        number: bank.conta,
        type: bank.tipo_conta === "poupanca" ? 2 : 1,
      },
    });

    meta.propostaId = result.simId;
    meta.signatureUrl = result.signingUrl;
    meta.authKey = result.authKey;
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { metadata: meta as Prisma.InputJsonValue },
    });

    if (result.signingUrl) {
      // Link ja disponivel — envia imediatamente
      const linkMsg = `Aqui está seu link de assinatura 👇\n${result.signingUrl}`;
      if (conversation.channel === "evolution") {
        const cfg = getChannelConfig(agent);
        await sendEvoMessage({
          number: conversation.phone,
          text: linkMsg,
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          instance: cfg.instance,
        }).catch(() => null);
      } else if (conversation.externalConvId) {
        await dc.sendMessage({ conversationId: conversation.externalConvId, text: linkMsg }).catch(() => null);
      }
    } else {
      // URL ainda nao pronta — agenda polling via worker
      await enqueueSignaturePoll({ conversationId: conversation.id, contractId: result.simId });
    }

    await alertOwner(
      `🎉 proposta INSS formalizada: ${conversation.contactName ?? conversation.phone} — simId ${result.simId}`,
    );

    return { ok: true, simId: result.simId, link: result.signingUrl, linkPronto: !!result.signingUrl };
  },
};

export const TOOLS: Record<string, ToolDef> = {
  extract_cpf,
  consult_joinbank,
  send_signature_link,
  transfer_human,
  finish_conversation,
  alert_owner,
  rag_search,
  // Ana — INSS portabilidade
  consult_rvx,
  collect_bank_data,
  request_documents,
  formalize_proposal,
};

export function getDeclarations() {
  return Object.values(TOOLS).map((t) => t.declaration);
}

/**
 * Roda uma tool e persiste em v2_tool_calls com status.
 * Nunca lanca — retorna { ok, output, error }.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolCtx,
): Promise<{ ok: boolean; output?: unknown; error?: string; toolCallId: string }> {
  const tool = TOOLS[name];
  if (!tool) {
    return { ok: false, error: `tool_not_found:${name}`, toolCallId: "" };
  }

  const call = await prisma.toolCall.create({
    data: {
      conversationId: ctx.conversation.id,
      toolName: name,
      input: args as Prisma.InputJsonValue,
      status: "running",
    },
  });

  try {
    const output = await tool.execute(args, ctx);
    await prisma.toolCall.update({
      where: { id: call.id },
      data: {
        output: (output ?? null) as Prisma.InputJsonValue,
        status: "success",
        finishedAt: new Date(),
      },
    });
    return { ok: true, output, toolCallId: call.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.toolCall.update({
      where: { id: call.id },
      data: { status: "error", error: msg, finishedAt: new Date() },
    });
    return { ok: false, error: msg, toolCallId: call.id };
  }
}
