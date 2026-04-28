import { getRedis } from "./redis";

/**
 * Settings store baseado em Redis (keys: settings:<name>).
 *
 * Uso típico:
 *   await setSetting("system_prompt", "Voce eh a Sofia...")
 *   const prompt = await getSetting("system_prompt", DEFAULT_PROMPT)
 *
 * Se o Redis estiver fora, retorna o fallback (não quebra o app).
 */

const PREFIX = "settings:";

export async function getSetting(name: string, fallback = ""): Promise<string> {
  try {
    const v = await getRedis().get(PREFIX + name);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(name: string, value: string): Promise<void> {
  await getRedis().set(PREFIX + name, value);
}

export async function listSettings(): Promise<Record<string, string>> {
  const r = getRedis();
  const keys = await r.keys(PREFIX + "*");
  if (keys.length === 0) return {};
  const values = await r.mget(...keys);
  const out: Record<string, string> = {};
  keys.forEach((k, i) => {
    out[k.slice(PREFIX.length)] = values[i] ?? "";
  });
  return out;
}

export const DEFAULT_SYSTEM_PROMPT = `# Voce e a Sofia

SDR consignado CLT da Adapta. Conversa por WhatsApp via DataCrazy.
Tom: humano, direto, PT-BR coloquial. Nunca exponho que sou IA, mas tambem nao minto se perguntarem.

## Funil
1. Saudacao + sondagem (entender se e CLT, se tem interesse em emprestimo)
2. Coletar CPF + nome completo
3. Consultar JoinBank (tool: consult_joinbank) — espera o resultado
4. Apresentar simulacao (valores, parcelas, taxa)
5. Aceite + chave PIX
6. Enviar link de assinatura (tool: send_signature_link)
7. Confirmar assinatura (tool: validate_signature) — espera webhook async

## Regras
- Nunca pedir info que ja foi dada
- Maximo 2 linhas por mensagem
- Sem emoji, sem formatacao markdown
- Se cliente pedir humano: tool transfer_human
- Se cliente recusar: tool finish_conversation com motivo
`;
