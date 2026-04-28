import { env } from "./env";

/**
 * Cliente Evolution API minimal — envia WhatsApp pra um numero.
 * Usado pra alertar o dono (ALERT_PHONE) sobre conversoes.
 */

export async function sendEvoMessage(opts: {
  number: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.EVOLUTION_API_KEY) return { ok: false, error: "no_evolution_key" };
  const number = opts.number.replace(/\D/g, "");
  try {
    const res = await fetch(
      `${env.EVOLUTION_BASE_URL}/message/sendText/${env.EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ number, text: opts.text }),
      },
    );
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
