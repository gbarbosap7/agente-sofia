import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Variáveis de ambiente atuais. Edição via Easypanel ou tRPC.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Básico</CardTitle>
          <CardDescription>Valores não-sensíveis</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {SAFE_KEYS.map((k) => (
              <Row key={k} k={k} v={e[k] ?? "—"} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Secrets</CardTitle>
          <CardDescription>Mascarados — primeiro/últimos 4 chars apenas</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {MASKED_KEYS.map((k) => (
              <Row key={k} k={k} v={mask(e[k])} mono />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 text-sm">
      <span className="text-muted-foreground font-mono text-xs">{k}</span>
      <span className={mono ? "text-foreground font-mono text-xs" : "text-foreground"}>{v}</span>
    </div>
  );
}
