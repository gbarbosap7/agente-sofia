/**
 * Cliente RVX — consulta INSS (IN100 equivalente).
 *
 * Endpoint: POST https://api-crm-v2.rvxtech.com.br/api/consultations
 * Body: { type: 'inss', document: cpf }
 *
 * Retorna dados do beneficiário + lista de empréstimos ativos.
 * A simulação de portabilidade é feita separadamente via JoinBank (joinbank.ts).
 */

import { env } from "./env";

// ─── Tipos da resposta RVX ───────────────────────────────────────────────────

export interface RvxBeneficiario {
  Nome?: string;
  Situacao?: string;      // "Ativo" | "Suspenso" | ...
  Nascimento?: string;
  Sexo?: string;
  Beneficio?: string;     // número do benefício
  Especie?: string;
}

export interface RvxResumoFinanceiro {
  MargemDisponivel?: number;
  MargemTotal?: number;
  ValorBeneficio?: number;
}

export interface RvxEmprestimo {
  Banco?: string;              // código do banco
  BancoNome?: string;          // nome do banco (nem sempre presente)
  Contrato?: string;
  ValorParcela?: number;       // parcela atual (R$)
  Quitacao?: number;           // saldo devedor (R$)
  Prazo?: number;              // prazo total (meses)
  ParcelasRestantes?: string | number;
  Taxa?: number;               // taxa mensal atual (%)
  Situacao?: string;
}

export interface RvxRecord {
  Beneficiario?: RvxBeneficiario;
  ResumoFinanceiro?: RvxResumoFinanceiro;
  Emprestimos?: RvxEmprestimo[];
}

export interface RvxResponse {
  data?: RvxRecord[];
  client?: RvxRecord[];
  phones?: string[];
  error?: boolean | string;
}

// ─── Resultado processado (o que vai pro tool) ───────────────────────────────

export interface RvxConsultResult {
  eligible: boolean;          // tem benefício ativo + ao menos 1 empréstimo elegível
  nome?: string;
  nomeCompleto?: string;
  situacaoBeneficio?: string;
  numeroBeneficio?: string;
  margemDisponivel?: number;
  valorBeneficio?: number;
  emprestimos: RvxEmprestimo[];
  emprestimosElegiveis: RvxEmprestimo[];  // taxa > 1.30%
  phones?: string[];
  reason?: string;            // motivo de !eligible
  raw?: RvxResponse;
}

// ─── Cliente ─────────────────────────────────────────────────────────────────

class RvxError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "RvxError";
  }
}

const TAXA_REF = 1.30; // taxa mínima para considerar empréstimo elegível à portabilidade

export const rvx = {
  /**
   * Consulta dados INSS pelo CPF.
   * Retorna beneficiário, empréstimos e quais são elegíveis à portabilidade.
   */
  async consult(cpf: string): Promise<RvxConsultResult> {
    const cleanCpf = cpf.replace(/\D/g, "");

    let raw: RvxResponse;
    try {
      const res = await fetch("https://api-crm-v2.rvxtech.com.br/api/consultations", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.RVX_KEY}`,
        },
        body: JSON.stringify({ type: "inss", document: cleanCpf }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new RvxError(`RVX ${res.status}`, res.status, text);
      }

      raw = (await res.json()) as RvxResponse;
    } catch (err) {
      if (err instanceof RvxError) throw err;
      throw new RvxError(`RVX network: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Resposta de erro explícita
    if (raw.error === true || raw.error === "true") {
      return {
        eligible: false,
        emprestimos: [],
        emprestimosElegiveis: [],
        phones: raw.phones ?? [],
        reason: "cpf_nao_encontrado_inss",
        raw,
      };
    }

    const records = raw.data ?? raw.client ?? [];
    if (!records.length) {
      return {
        eligible: false,
        emprestimos: [],
        emprestimosElegiveis: [],
        phones: raw.phones ?? [],
        reason: "sem_registros_inss",
        raw,
      };
    }

    const rec = records[0];
    const ben = rec.Beneficiario ?? {};
    const resumo = rec.ResumoFinanceiro ?? {};
    const emps = rec.Emprestimos ?? [];

    const nomeCompleto = ben.Nome ?? "";
    const nome = nomeCompleto.split(" ")[0] || "";

    // Benefício inativo
    if (ben.Situacao && ben.Situacao !== "Ativo") {
      return {
        eligible: false,
        nome,
        nomeCompleto,
        situacaoBeneficio: ben.Situacao,
        numeroBeneficio: ben.Beneficio,
        emprestimos: emps,
        emprestimosElegiveis: [],
        phones: raw.phones ?? [],
        reason: `beneficio_${ben.Situacao?.toLowerCase()}`,
        raw,
      };
    }

    // Empréstimos elegíveis: taxa acima da referência (1.30%)
    const emprestimosElegiveis = emps.filter(
      (e) => Number(e.Taxa ?? 0) > TAXA_REF && Number(e.Quitacao ?? 0) > 0,
    );

    return {
      eligible: emprestimosElegiveis.length > 0,
      nome,
      nomeCompleto,
      situacaoBeneficio: ben.Situacao,
      numeroBeneficio: ben.Beneficio,
      margemDisponivel: resumo.MargemDisponivel,
      valorBeneficio: resumo.ValorBeneficio,
      emprestimos: emps,
      emprestimosElegiveis,
      phones: raw.phones ?? [],
      reason: emprestimosElegiveis.length === 0 ? "sem_emprestimos_elegiveis" : undefined,
      raw,
    };
  },
};

export { RvxError };
