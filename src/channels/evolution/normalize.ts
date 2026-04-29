import { z } from "zod";
import type { EvolutionUpsertPayload, InboundEvolution } from "./types";
import type { InboundMessage } from "@/lib/inbound";

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
        audioMessage: z
          .object({
            mimetype: z.string().optional(),
            seconds: z.number().optional(),
            ptt: z.boolean().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    messageType: z.string().optional(),
    messageTimestamp: z.union([z.number(), z.string()]).optional(),
  }),
});

export function normalizeEvoPayload(raw: unknown): InboundMessage | null {
  const parsed = schema.parse(raw);
  const d = parsed.data;

  // Ignora mensagens enviadas pelo proprio bot (echo)
  if (d.key.fromMe) return null;

  // remoteJid: "5511993909833@s.whatsapp.net" → "5511993909833"
  const phone = d.key.remoteJid.split("@")[0].replace(/\D/g, "");
  if (!phone) return null;

  const ts = d.messageTimestamp;
  let timestamp: string;
  if (typeof ts === "number") timestamp = new Date(ts * 1000).toISOString();
  else if (typeof ts === "string") timestamp = ts;
  else timestamp = new Date().toISOString();

  const providerMsgId = d.key.id ?? `evo_${phone}_${Date.now()}`;

  const base: InboundMessage = {
    channel: "evolution",
    phone,
    externalConvId: phone, // Evolution usa o phone como id de conversa
    contactName: d.pushName ?? null,
    leadId: null,
    text: "",
    providerMsgId,
    messageType: d.messageType ?? "conversation",
    timestamp,
  };

  // Mensagem de áudio (nota de voz ou arquivo de áudio)
  if (d.messageType === "audioMessage" && d.message?.audioMessage) {
    const mime = d.message.audioMessage.mimetype ?? "audio/ogg; codecs=opus";
    return {
      ...base,
      messageType: "audio",
      attachment: {
        url: "", // sem URL pública — download via Evolution getBase64FromMediaMessage
        type: "audio",
        mime,
      },
    };
  }

  // Mensagem de texto
  const text =
    d.message?.conversation ??
    d.message?.extendedTextMessage?.text ??
    "";

  if (!text || text.trim().length === 0) return null;

  return { ...base, text: text.trim() };
}
