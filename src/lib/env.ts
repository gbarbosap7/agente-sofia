import { z } from "zod";

/**
 * Env schema — single source of truth.
 * Lazy-loaded para não quebrar `next build` quando ENV ainda não existe.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  GOOGLE_API_KEY: z.string().min(20, "GOOGLE_API_KEY ausente"),
  // Chave dedicada pra transcrição de áudio — separa custo do agente.
  // Default: cai no GOOGLE_API_KEY se não definida.
  GEMINI_API_KEY_TRANSCRIBE: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  GEMINI_TRANSCRIBE_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_EMBED_MODEL: z.string().default("gemini-embedding-001"),

  DC_BASE_URL: z.string().url().default("https://api.g1.datacrazy.io/api/v1"),
  DC_TOKEN: z.string().min(20),
  DC_WEBHOOK_SECRET: z.string().optional(),
  EVO_WEBHOOK_SECRET: z.string().optional(),

  JOINBANK_BASE_URL: z.string().url().default("https://integration.ajin.io"),
  JOINBANK_KEY: z.string().min(20),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  OPENAI_API_KEY: z.string().optional(),

  EVOLUTION_BASE_URL: z.string().url().default("http://evolution-api:8080"),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().default("nayana"),
  ALERT_PHONE: z.string().default("5511993909833"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Env inválido:\n", JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    throw new Error("Variáveis de ambiente inválidas/ausentes — veja .env.example");
  }
  _env = parsed.data;
  return _env;
}

/** Use ONLY em routes/server actions, nunca em top-level de módulo. */
export const env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
