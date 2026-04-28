import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const SAFE_KEYS = [
  "NODE_ENV",
  "APP_BASE_URL",
  "GEMINI_MODEL",
  "GEMINI_EMBED_MODEL",
  "DC_BASE_URL",
  "JOINBANK_BASE_URL",
  "SUPABASE_URL",
  "EVOLUTION_BASE_URL",
  "EVOLUTION_INSTANCE",
  "ALERT_PHONE",
] as const;

const MASKED_KEYS = [
  "GOOGLE_API_KEY",
  "DC_TOKEN",
  "DC_WEBHOOK_SECRET",
  "JOINBANK_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "REDIS_URL",
  "OPENAI_API_KEY",
  "EVOLUTION_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "ADMIN_PASSWORD_HASH",
  "SESSION_SECRET",
] as const;

function mask(v: string | undefined) {
  if (!v) return "—";
  if (v.length < 12) return "•".repeat(v.length);
  return v.slice(0, 4) + "•".repeat(8) + v.slice(-4);
}

export default function ConfigsPage() {
  const e = env as Record<string, string | undefined>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">configs</h1>
        <p className="text-zinc-500 text-sm mt-1">
          variaveis de ambiente. Edicao via Easypanel UI ou tRPC.
        </p>
      </div>

      <Section title="basico">
        {SAFE_KEYS.map((k) => (
          <Row key={k} k={k} v={e[k] ?? "—"} />
        ))}
      </Section>

      <Section title="secrets (mascarados)">
        {MASKED_KEYS.map((k) => (
          <Row key={k} k={k} v={mask(e[k])} mono />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{title}</h2>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-900">
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm">
      <span className="text-zinc-400 font-mono text-xs">{k}</span>
      <span className={mono ? "text-zinc-200 font-mono text-xs" : "text-zinc-200"}>{v}</span>
    </div>
  );
}
