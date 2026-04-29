import { env } from "./env";

/**
 * Cliente Evolution API minimal — envia WhatsApp pra um numero.
 * Usado pra alertar o dono (ALERT_PHONE) sobre conversoes.
 */

export async function sendEvoMessage(opts: {
  number: string;
  text: string;
  /** override do channelConfig do agent — se omitido usa env defaults */
  baseUrl?: string;
  apiKey?: string;
  instance?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = opts.apiKey ?? env.EVOLUTION_API_KEY;
  if (!apiKey) return { ok: false, error: "no_evolution_key" };
  const baseUrl = opts.baseUrl ?? env.EVOLUTION_BASE_URL;
  const instance = opts.instance ?? env.EVOLUTION_INSTANCE;
  const number = opts.number.replace(/\D/g, "");
  try {
    const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({ number, text: opts.text }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `evo ${res.status}: ${text.slice(0, 120)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Alerta o dono do bot com mensagem padronizada. */
export async function alertOwner(text: string) {
  return sendEvoMessage({ number: env.ALERT_PHONE, text: `[sofia] ${text}` });
}

/**
 * Baixa áudio de uma mensagem Evolution via getBase64FromMediaMessage.
 * Retorna base64 + mimeType para passar direto ao Gemini.
 */
export async function downloadEvoAudio(opts: {
  /** Objeto raw `data` do payload Evolution (key + message) */
  rawData: unknown;
  baseUrl?: string;
  apiKey?: string;
  instance?: string;
}): Promise<{ base64: string; mimeType: string }> {
  const apiKey = opts.apiKey ?? env.EVOLUTION_API_KEY;
  if (!apiKey) throw new Error("no_evolution_key");
  const baseUrl = opts.baseUrl ?? env.EVOLUTION_BASE_URL;
  const instance = opts.instance ?? env.EVOLUTION_INSTANCE;

  const res = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instance}`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000), // áudio pode ser grande
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify({ message: opts.rawData }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`evo_getBase64_failed:${res.status}:${body.slice(0, 120)}`);
  }

  const json = (await res.json()) as { base64?: string; mimetype?: string };
  if (!json.base64) throw new Error("evo_getBase64_empty_response");

  return {
    base64: json.base64,
    mimeType: (json.mimetype ?? "audio/ogg").split(";")[0].trim(),
  };
}
