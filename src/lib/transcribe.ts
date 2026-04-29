import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

/**
 * Transcrição de áudio com Gemini.
 *
 * Usa GEMINI_API_KEY_TRANSCRIBE (chave dedicada pra separar custo do agente).
 * Se não definida, cai no GOOGLE_API_KEY.
 */

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    const apiKey = env.GEMINI_API_KEY_TRANSCRIBE || env.GOOGLE_API_KEY;
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

const TRANSCRIBE_PROMPT =
  "Transcreva fielmente este áudio em português brasileiro. " +
  "Retorne APENAS a transcrição, sem prefixo, comentário ou marcação. " +
  "Se o áudio for inaudível ou silencioso, retorne exatamente: [INAUDIVEL]";

export type TranscribeResult = {
  text: string;
  durationMs: number;
  inaudible: boolean;
};

/** Baixa o áudio do URL e retorna { mimeType, base64 }. */
async function fetchAudioAsBase64(
  url: string,
): Promise<{ mimeType: string; base64: string }> {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`audio_fetch_failed:${r.status}`);
  const ct = r.headers.get("content-type") ?? "audio/ogg";
  const buf = Buffer.from(await r.arrayBuffer());
  return { mimeType: ct.split(";")[0].trim(), base64: buf.toString("base64") };
}

/** Núcleo da transcrição — recebe base64 + mimeType já resolvidos. */
async function transcribeBase64(base64: string, mimeType: string): Promise<TranscribeResult> {
  const t0 = Date.now();
  const res = await client().models.generateContent({
    model: env.GEMINI_TRANSCRIBE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: TRANSCRIBE_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const text = (res.text ?? "").trim();
  const inaudible = text === "[INAUDIVEL]" || text.length === 0;
  return { text: inaudible ? "" : text, durationMs: Date.now() - t0, inaudible };
}

/**
 * Transcreve base64 já obtido (ex: Evolution getBase64FromMediaMessage).
 */
export async function transcribeAudioBase64(
  base64: string,
  mimeType: string,
): Promise<TranscribeResult> {
  return transcribeBase64(base64, mimeType);
}

/**
 * Transcreve um áudio remoto via Gemini.
 * @param audioUrl  URL pública do arquivo (DC media URL ou Evolution download)
 * @param mimeOverride  Se já souber o mime (ex: "audio/ogg; codecs=opus")
 */
export async function transcribeAudio(
  audioUrl: string,
  mimeOverride?: string,
): Promise<TranscribeResult> {
  const { mimeType, base64 } = await fetchAudioAsBase64(audioUrl);
  const finalMime = mimeOverride?.split(";")[0].trim() || mimeType;
  return transcribeBase64(base64, finalMime);
}
