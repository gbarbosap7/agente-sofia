import { env } from "./env";

/**
 * Cliente JoinBank/Ajin — CLT consignado + INSS portabilidade.
 *
 * Auth:
 *  - CLT endpoints (/v1/clt/*): Authorization: Bearer {key}
 *  - INSS endpoints (/v3/*): apikey: {key}
 *
 * INSS Rule ID portabilidade: 082d1e47-c367-4410-9f39-3740d9286eda
 */

// ─── Constantes ──────────────────────────────────────────────────────────────

const JOINBANK_RULE_ID_INSS = "082d1e47-c367-4410-9f39-3740d9286eda";
const TAXA_REF_INSS = 1.30; // taxa de referência pra portabilidade (%)

// ─── Tipos CLT ───────────────────────────────────────────────────────────────

export interface JbSimulation {
  available: boolean;
  amount?: number;
  installments?: number;
  installmentAmount?: number;
  rate?: number;
  reason?: string;
  raw?: unknown;
}

export interface JbSignatureLink {
  url: string;
  contractId: string;
  expiresAt?: string;
}

export interface JbSignatureStatus {
  signed: boolean;
  signedAt?: string;
  status: string;
}

// ─── Tipos INSS ──────────────────────────────────────────────────────────────

export interface JbInssCalcInput {
  ruleId?: string;
  term: number;                    // prazo restante (meses)
  rate?: number;                   // taxa alvo (default 1.30)
  installmentValue: number;        // nova parcela estimada
  loanValue: number;               // saldo devedor
  lenderCode: number;              // código do banco atual
  contractNumber: string;
  totalTerm: number;               // prazo total original
  installmentsRemaining: number;
  currentInstallment: number;      // parcela atual do contrato
  dueBalance: number;              // saldo devedor = loanValue
}

export interface JbInssCalcResult {
  installmentValue?: number;
  rate?: number;
  lender?: { name?: string; code?: number };
  raw?: unknown;
}

export interface JbInssCreateInput {
  cpf: string;
  nome: string;
  beneficio: string;
  income: number;                  // valor do benefício
  phone: string;
  ruleId?: string;
  term: number;
  rate?: number;
  installmentValue: number;
  loanValue: number;
  lenderCode: number;
  contractNumber: string;
  totalTerm?: number;
  currentInstallment: number;
  dueBalance: number;
  creditBank?: {
    name: string;
    branch: string;
    number: string;
    type?: number;                 // 1=corrente, 2=poupança
  };
  fileIds?: Array<{ id: string; name: string; url?: string }>;
}

export interface JbInssCreateResult {
  simId: string;
  signingUrl: string | null;       // null se ainda não disponível (polling necessário)
  authKey?: string;
  raw?: unknown;
}

export interface JbInssStatus {
  signed: boolean;
  signingUrl?: string;
  status?: string;
  raw?: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

class JbError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
    this.name = "JbError";
  }
}

/** Helper CLT — usa Authorization: Bearer */
async function jb<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${env.JOINBANK_BASE_URL}${path}`, {
    ...rest,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${env.JOINBANK_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : (rest.body as BodyInit | undefined),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch {}
    throw new JbError(`JB ${rest.method ?? "GET"} ${path} → ${res.status}`, res.status, parsed);
  }
  return (await res.json()) as T;
}

/** Helper INSS — usa apikey header (v3 endpoints) */
async function jbV3<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${env.JOINBANK_BASE_URL}${path}`, {
    ...rest,
    signal: AbortSignal.timeout(20_000),
    headers: {
      apikey: env.JOINBANK_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : (rest.body as BodyInit | undefined),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch {}
    throw new JbError(`JBv3 ${rest.method ?? "GET"} ${path} → ${res.status}`, res.status, parsed);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Cliente ─────────────────────────────────────────────────────────────────

export const joinbank = {
  // ── CLT consignado ──────────────────────────────────────────────────────

  async consult(cpf: string, name?: string): Promise<JbSimulation> {
    try {
      const raw = await jb<Record<string, unknown>>("/v1/clt/consult", {
        method: "POST",
        json: { cpf: cpf.replace(/\D/g, ""), name },
      });
      return {
        available: Boolean((raw as { available?: boolean }).available ?? raw.amount),
        amount: (raw as { amount?: number }).amount,
        installments: (raw as { installments?: number }).installments,
        installmentAmount: (raw as { installment_amount?: number }).installment_amount,
        rate: (raw as { rate?: number }).rate,
        raw,
      };
    } catch (err) {
      if (err instanceof JbError && err.status === 404) {
        return { available: false, reason: "cpf_nao_elegivel" };
      }
      throw err;
    }
  },

  async sendSignatureLink(input: {
    cpf: string;
    amount: number;
    installments: number;
    pixKey: string;
  }): Promise<JbSignatureLink> {
    return jb<JbSignatureLink>("/v1/clt/signature", { method: "POST", json: input });
  },

  async getSignatureStatus(contractId: string): Promise<JbSignatureStatus> {
    return jb<JbSignatureStatus>(`/v1/clt/signature/${contractId}`);
  },

  // ── INSS portabilidade ──────────────────────────────────────────────────

  /**
   * Calcula simulação de portabilidade INSS via QualyBank.
   * Retorna installmentValue (nova parcela) e taxa.
   */
  async calcInss(input: JbInssCalcInput): Promise<JbInssCalcResult> {
    const raw = await jbV3<Record<string, unknown>>("/v3/loan-inss-simulations/calculation", {
      method: "POST",
      json: {
        ruleId: input.ruleId ?? JOINBANK_RULE_ID_INSS,
        term: input.term,
        rate: input.rate ?? TAXA_REF_INSS,
        installmentValue: input.installmentValue,
        loanValue: input.loanValue,
        originContract: {
          lenderCode: input.lenderCode,
          contractNumber: input.contractNumber,
          term: input.totalTerm,
          installmentsRemaining: input.installmentsRemaining,
          installmentValue: input.currentInstallment,
          dueBalanceValue: input.dueBalance,
        },
        hasInsurance: false,
        referenceCode: null,
      },
    });
    return {
      installmentValue: (raw as { installmentValue?: number }).installmentValue,
      rate: (raw as { rate?: number }).rate,
      lender: (raw as { lender?: { name?: string; code?: number } }).lender,
      raw,
    };
  },

  /**
   * Cria proposta formal de portabilidade INSS no QualyBank.
   * Retorna simId + signingUrl (quando disponível imediatamente).
   */
  async createInssSimulation(input: JbInssCreateInput): Promise<JbInssCreateResult> {
    const prazo = input.term;
    const simBody: Record<string, unknown> = {
      borrower: {
        name: input.nome,
        identity: input.cpf.replace(/\D/g, ""),
        benefit: input.beneficio,
        benefitType: 41,       // aposentadoria/pensão INSS
        birthDate: "1965-01-01", // fallback — substituir quando tiver data real
        income: input.income,
        phone: input.phone,
      },
      items: [{
        ruleId: input.ruleId ?? JOINBANK_RULE_ID_INSS,
        term: prazo,
        rate: input.rate ?? TAXA_REF_INSS,
        installmentValue: input.installmentValue,
        loanValue: input.loanValue,
        originContract: {
          lenderCode: input.lenderCode,
          contractNumber: input.contractNumber,
          term: (input.totalTerm ?? prazo) + 10,
          installmentsRemaining: prazo,
          installmentValue: input.currentInstallment,
          dueBalanceValue: input.dueBalance,
        },
        hasInsurance: false,
      }],
      step: { code: 20 },
      referenceCode: input.phone,
    };

    if (input.creditBank) {
      simBody.creditBankAccount = {
        bank: { code: 0, name: input.creditBank.name },
        branch: input.creditBank.branch,
        number: input.creditBank.number,
        type: { code: input.creditBank.type ?? 1, name: input.creditBank.type === 2 ? "Conta Poupança" : "Conta Corrente" },
      };
    }

    if (input.fileIds?.length) {
      simBody.files = input.fileIds.map((f, i) => ({
        id: f.id, name: f.name, url: f.url ?? "",
        type: { code: i === 0 ? "doc_front" : "doc_back" },
      }));
    }

    const simResult = await jbV3<Record<string, unknown>>("/v3/loan-inss-simulations", {
      method: "POST",
      json: simBody,
    });

    const simId = String(
      (simResult as { id?: string }).id ??
      (simResult as { items?: Array<{ id: string }> }).items?.[0]?.id ??
      "",
    );
    if (!simId) {
      throw new JbError("QualyBank nao retornou simulation ID", undefined, simResult);
    }

    // Tenta obter URL via auth-term
    let signingUrl: string | null = null;
    let authKey: string | undefined;
    try {
      const authTerm = await jbV3<Record<string, unknown>>(
        `/v3/loan-inss-simulations/${simId}/auth-term`,
      );
      authKey = String((authTerm as { id?: string }).id ?? "");
      signingUrl =
        String((authTerm as { url?: string }).url ?? "") ||
        String((simResult as { formalization?: { url?: string } }).formalization?.url ?? "") ||
        null;
      if (signingUrl === "") signingUrl = null;
    } catch {
      // auth-term pode nao estar pronto — retorna simId pra polling
    }

    // Se ainda sem URL, tenta buscar empréstimo gerado
    if (!signingUrl) {
      try {
        const loan = await jbV3<Record<string, unknown>>(
          `/v3/loans/simulation/${simId}`,
        );
        const url =
          String((loan as { signature?: { url?: string } }).signature?.url ?? "") ||
          String((loan as { formalization?: { url?: string } }).formalization?.url ?? "");
        if (url) signingUrl = url;
      } catch {
        // empréstimo ainda não gerado — polling via worker
      }
    }

    return { simId, signingUrl, authKey, raw: simResult };
  },

  /**
   * Polling de status da proposta INSS — checa empréstimo gerado e signing URL.
   */
  async getInssStatus(simId: string): Promise<JbInssStatus> {
    // Primeiro checa o empréstimo gerado
    try {
      const loan = await jbV3<Record<string, unknown>>(`/v3/loans/simulation/${simId}`);
      const url =
        String((loan as { signature?: { url?: string } }).signature?.url ?? "") ||
        String((loan as { formalization?: { url?: string } }).formalization?.url ?? "");
      if (url) {
        return { signed: false, signingUrl: url, status: "ready_to_sign", raw: loan };
      }
      const signed = !!(loan as { signed?: boolean }).signed || !!(loan as { status?: string }).status?.toLowerCase().includes("sign");
      return { signed, status: String((loan as { status?: string }).status ?? "pending"), raw: loan };
    } catch {
      // loan ainda nao existe — checa simulation
    }

    try {
      const sim = await jbV3<Record<string, unknown>>(`/v3/loan-inss-simulations/${simId}`);
      const url = String((sim as { formalization?: { url?: string } }).formalization?.url ?? "");
      return {
        signed: false,
        signingUrl: url || undefined,
        status: String((sim as { status?: string }).status ?? "processing"),
        raw: sim,
      };
    } catch {
      return { signed: false, status: "unknown" };
    }
  },
};

export { JbError, JOINBANK_RULE_ID_INSS, TAXA_REF_INSS };
