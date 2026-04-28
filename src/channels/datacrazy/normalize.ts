import { z } from "zod";
import type { DcWebhookPayload } from "./types";
import type { InboundMessage } from "@/lib/inbound";

const dcPayloadSchema = z.object({
  conv_id: z.string().min(1),
  phone: z.string().min(8),
  lead_id: z.string().optional(),
  contact_name: z.string().optional(),
  message_text: z.string().optional().default(""),
  message_id: z.string().optional(),
  message_type: z.string().optional().default("text"),
  attachment_url: z.string().optional(),
  attachment_type: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

export type ValidatedDcPayload = z.infer<typeof dcPayloadSchema>;

/** Valida e normaliza payload bruto do webhook DC. */
export function normalizeDcPayload(raw: unknown): InboundMessage {
  const data = dcPayloadSchema.parse(raw) as DcWebhookPayload & ValidatedDcPayload;

  // Provider msg ID — usa message_id ou compõe
  const providerMsgId = data.message_id ?? `dc_${data.conv_id}_${data.timestamp ?? Date.now()}`;

  const normalized: InboundMessage = {
    channel: "datacrazy",
    externalConvId: data.conv_id,
    phone: normalizePhone(data.phone),
    leadId: data.lead_id ?? null,
    contactName: data.contact_name ?? null,
    text: (data.message_text ?? "").trim(),
    providerMsgId,
    messageType: data.message_type ?? "text",
    timestamp: data.timestamp ?? new Date().toISOString(),
  };

  if (data.attachment_url) {
    normalized.attachment = {
      url: data.attachment_url,
      type: data.attachment_type ?? "unknown",
    };
  }

  return normalized;
}

/** Padroniza phone: só dígitos, 13 chars típico Brasil (5511993909833). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Adiciona 55 se for 11 ou 10 dígitos
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}
