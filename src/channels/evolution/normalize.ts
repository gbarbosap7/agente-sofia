import { z } from "zod";
import type { EvolutionUpsertPayload, InboundEvolution } from "./types";

const schema = z.object({
  event: z.string().optional(),
  instance: z.string().optional(),
  data: z.object({
    key: z.object({
      remoteJid: z.string(),
      fromMe: z.boolean().optional(),
      id: z.string().optional(),
    }),
    pushName: z.string().optional(),
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({ text: z.string() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
    messageType: z.string().optional(),
    messageTimestamp: z.union([z.number(), z.string()]).optional(),
  }),
});

export function normalizeEvoPayload(raw: unknown): InboundEvolution | null {
  const parsed = schema.parse(raw);
  const d = parsed.data;

  // Ignora mensagens enviadas pelo proprio bot (echo)
  if (d.key.fromMe) return null;

  const text =
    d.message?.conversation ??
    d.message?.extendedTextMessage?.text ??
    "";

  if (!text || text.trim().length === 0) return null;

  // remoteJid: "5511993909833@s.whatsapp.net" → "5511993909833"
  const phone = d.key.remoteJid.split("@")[0].replace(/\D/g, "");
  if (!phone) return null;

  const ts = d.messageTimestamp;
  let timestamp: string;
  if (typeof ts === "number") timestamp = new Date(ts * 1000).toISOString();
  else if (typeof ts === "string") timestamp = ts;
  else timestamp = new Date().toISOString();

  const providerMsgId = d.key.id ?? `evo_${phone}_${Date.now()}`;

  return {
    channel: "evolution",
    phone,
    externalConvId: phone, // Evolution usa o phone como id de conversa
    contactName: d.pushName ?? null,
    leadId: null,
    text: text.trim(),
    providerMsgId,
    messageType: d.messageType ?? "conversation",
    timestamp,
  };
}
