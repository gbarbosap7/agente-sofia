import { Prisma, type Conversation } from "@prisma/client";
import { prisma } from "./prisma";
import { joinbank } from "./joinbank";
import { alertOwner } from "./evolution";
import { dc } from "@/channels/datacrazy/client";

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
  async execute(args, { conversation }) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { aiEnabled: false, handoffReason: String(args.reason) },
    });
    if (args.department_id && conversation.externalConvId) {
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
    if (conversation.externalConvId) {
      try { await dc.finishConversation(conversation.externalConvId); }
      catch { /* ignora — nao bloqueia o ack */ }
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

export const TOOLS: Record<string, ToolDef> = {
  extract_cpf,
  consult_joinbank,
  send_signature_link,
  transfer_human,
  finish_conversation,
  alert_owner,
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
