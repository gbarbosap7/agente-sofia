import { env } from "./env";

/**
 * Cliente JoinBank/Ajin. APIs reais sao confidenciais — esse stub bate
 * em /v1/clt/consult com o payload mais comum (CPF + nome). Quando o
 * spec final chegar, ajustar o path e a forma do body.
 *
 * Operacoes:
 *  - consult(cpf, name?)   → simulacao CLT consignado (limite, parcelas, taxa)
 *  - sendSignatureLink(...)→ dispara link de assinatura (UNIFICA, etc.)
 *  - getSignatureStatus(...)→ polling do status do link
 */

export interface JbSimulation {
  available: boolean;
  amount?: number;          // valor liquido
  installments?: number;    // numero de parcelas
  installmentAmount?: number; // valor por parcela
  rate?: number;            // taxa mensal
  reason?: string;          // se available=false, motivo
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

class JbError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
    this.name = "JbError";
  }
}

async function jb<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${env.JOINBANK_BASE_URL}${path}`, {
    ...rest,
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

export const joinbank = {
  /** Consulta simulacao CLT consignado por CPF. */
  async consult(cpf: string, name?: string): Promise<JbSimulation> {
    try {
      const raw = await jb<Record<string, unknown>>("/v1/clt/consult", {
        method: "POST",
        json: { cpf: cpf.replace(/\D/g, ""), name },
      });
      // mapeamento defensivo — campos exatos podem mudar
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

  /** Dispara link de assinatura para o CPF/contrato simulado. */
  async sendSignatureLink(input: {
    cpf: string;
    amount: number;
    installments: number;
    pixKey: string;
  }): Promise<JbSignatureLink> {
    return jb<JbSignatureLink>("/v1/clt/signature", {
      method: "POST",
      json: input,
    });
  },

  async getSignatureStatus(contractId: string): Promise<JbSignatureStatus> {
    return jb<JbSignatureStatus>(`/v1/clt/signature/${contractId}`);
  },
};

export { JbError };
