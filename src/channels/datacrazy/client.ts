/**
 * DataCrazy REST client.
 *
 * Endpoints conhecidos (extraídos de Sofia v1 + docs):
 *   POST   /conversations/{id}/messages          — envia msg
 *   GET    /conversations/{id}                   — detalhes
 *   PATCH  /conversations/{id}                   — muda departamento (transbordo humano)
 *   GET    /conversations?filter[phone]=         — busca por phone
 *
 * Auth: Bearer DC_TOKEN
 * Rate limit: 120 req/min em webhooks; API geral é generosa mas evite burst.
 */

import { env } from "@/lib/env";
import type { DcConversation, DcSendResponse } from "./types";

class DcError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "DcError";
  }
}

async function dcFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${env.DC_BASE_URL}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${env.DC_TOKEN}`,
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
    throw new DcError(
      `DC ${rest.method ?? "GET"} ${path} → ${res.status}`,
      res.status,
      parsed,
    );
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export interface SendMessageInput {
  /** ID da conversa no DataCrazy */
  conversationId: string;
  /** Texto livre */
  text: string;
  /** Mídia opcional */
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "document";
}

export const dc = {
  /** Envia mensagem para o lead via canal nativo do DC. */
  async sendMessage(input: SendMessageInput): Promise<DcSendResponse> {
    return dcFetch<DcSendResponse>(
      `/conversations/${input.conversationId}/messages`,
      {
        method: "POST",
        json: {
          text: input.text,
          media_url: input.mediaUrl,
          media_type: input.mediaType,
        },
      },
    );
  },

  /** Detalhes de uma conversa. */
  async getConversation(conversationId: string): Promise<DcConversation> {
    return dcFetch<DcConversation>(`/conversations/${conversationId}`);
  },

  /**
   * Transfere conversa para outro departamento (handoff humano).
   * Marca a conversa como NÃO mais sob responsabilidade da IA.
   */
  async transferDepartment(
    conversationId: string,
    departmentId: string,
  ): Promise<void> {
    await dcFetch(`/conversations/${conversationId}`, {
      method: "PATCH",
      json: { current_department_id: departmentId },
    });
  },

  /**
   * Marca conversa como finalizada (encerramento).
   */
  async finishConversation(conversationId: string): Promise<void> {
    await dcFetch(`/conversations/${conversationId}`, {
      method: "PATCH",
      json: { finished: true },
    });
  },

  /** Adiciona tag ao lead (ex: opt-out, convertido). */
  async tagLead(leadId: string, tagName: string): Promise<void> {
    await dcFetch(`/leads/${leadId}/tags`, {
      method: "POST",
      json: { name: tagName },
    });
  },
};

export { DcError };
