import { env } from "./env";

/**
 * Cliente RVX — portabilidade consignado INSS.
 *
 * Operacoes:
 *  - simulate(cpf)       → elegibilidade + simulacao (margem, valor, parcela, taxa)
 *  - formalize(input)    → submete proposta, retorna link de assinatura
 *  - getStatus(id)       → polling de status da proposta
 *
 * Endpoints e campos exatos dependem do contrato RVX — ajuste conforme spec.
 * Por ora, mapeamento defensivo: nunca lanca por campo ausente.
 */

export interface RvxSimulation {
  eligible: boolean;
  nome?: string;
  beneficio?: string;          // numero do beneficio
  idade?: number;
  banco_atual?: string;        // banco do contrato atual
  margem: number;              // margem disponivel (R$)
  valor_liberado?: number;     // valor liquido proposto
  parcela?: number;            // nova parcela (R$)
  taxa?: number;               // taxa mensal (%)
  prazo?: number;              // prazo (meses)
  reason?: string;             // motivo se !eligible
  raw?: unknown;
}

export interface RvxFormalizeInput {
  cpf: string;
  nome?: string;
  banco: string;
  agencia: string;
  conta: string;
  valor?: number;
  prazo?: number;
  pix_key?: string;
}

export interface RvxFormalizeResult {
  link: string;
  proposta_id: string;
  expires_at?: string;
}

export interface RvxStatus {
  signed: boolean;
  signed_at?: string;
  status: string;
}

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

async function rvxFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${env.RVX_BASE_URL}${path}`, {
    ...rest,
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${env.RVX_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : (rest.body as BodyInit | undefined),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {}
    throw new RvxError(
      `RVX ${rest.method ?? "GET"} ${path} → ${res.status}`,
      res.status,
      parsed,
    );
  }

  return (await res.json()) as T;
}

export const rvx = {
  /**
   * Consulta elegibilidade + simulacao de portabilidade por CPF.
   * Retorna margem disponivel, valor liberado, nova parcela, taxa.
   */
  async simulate(cpf: string): Promise<RvxSimulation> {
    try {
      const raw = await rvxFetch<Record<string, unknown>>("/v1/portability/simulate", {
        method: "POST",
        json: { cpf: cpf.replace(/\D/g, "") },
      });

      // mapeamento defensivo — adaptar conforme spec real do RVX
      const eligible = Boolean(
        (raw as { eligible?: boolean }).eligible ??
          (raw as { elegivel?: boolean }).elegivel ??
          (raw as { margem?: number }).margem,
      );

      return {
        eligible,
        nome: String((raw as { nome?: string }).nome ?? ""),
        beneficio: String((raw as { beneficio?: string; nb?: string }).beneficio ?? (raw as { nb?: string }).nb ?? ""),
        idade: Number((raw as { idade?: number }).idade ?? 0) || undefined,
        banco_atual: String((raw as { banco_atual?: string; bancoAtual?: string }).banco_atual ?? (raw as { bancoAtual?: string }).bancoAtual ?? ""),
        margem: Number((raw as { margem?: number }).margem ?? 0),
        valor_liberado: Number((raw as { valor_liberado?: number; valorLiberado?: number }).valor_liberado ?? (raw as { valorLiberado?: number }).valorLiberado ?? 0) || undefined,
        parcela: Number((raw as { parcela?: number; nova_parcela?: number }).parcela ?? (raw as { nova_parcela?: number }).nova_parcela ?? 0) || undefined,
        taxa: Number((raw as { taxa?: number; taxa_mensal?: number }).taxa ?? (raw as { taxa_mensal?: number }).taxa_mensal ?? 0) || undefined,
        prazo: Number((raw as { prazo?: number }).prazo ?? 0) || undefined,
        raw,
      };
    } catch (err) {
      if (err instanceof RvxError && (err.status === 404 || err.status === 422)) {
        return { eligible: false, margem: 0, reason: "cpf_nao_elegivel" };
      }
      throw err;
    }
  },

  /**
   * Formaliza proposta de portabilidade e retorna link de assinatura.
   */
  async formalize(input: RvxFormalizeInput): Promise<RvxFormalizeResult> {
    return rvxFetch<RvxFormalizeResult>("/v1/portability/formalize", {
      method: "POST",
      json: { ...input, cpf: input.cpf.replace(/\D/g, "") },
    });
  },

  /**
   * Polling de status da proposta.
   */
  async getStatus(propostaId: string): Promise<RvxStatus> {
    return rvxFetch<RvxStatus>(`/v1/portability/status/${propostaId}`);
  },
};

export { RvxError };
