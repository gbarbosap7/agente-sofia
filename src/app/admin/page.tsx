import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [convsTotal, convsAiOn, msgs24h, msgsAssist24h, lastConvs] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.count({ where: { aiEnabled: true } }),
    prisma.message.count({ where: { createdAt: { gte: since24h } } }),
    prisma.message.count({ where: { createdAt: { gte: since24h }, role: "assistant" } }),
    prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, phone: true, contactName: true, aiEnabled: true, updatedAt: true },
    }),
  ]);
  return { convsTotal, convsAiOn, msgs24h, msgsAssist24h, lastConvs };
}

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-zinc-500 text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-zinc-600 mt-1">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getStats>> | null = null;
  let dbErr: string | null = null;
  try {
    stats = await getStats();
  } catch (e) {
    dbErr = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">visao geral do agente nas ultimas 24h.</p>
      </div>

      {dbErr ? (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm">
          <div className="text-red-400 font-medium">DB indisponivel</div>
          <pre className="text-red-300 text-xs mt-2 whitespace-pre-wrap">{dbErr}</pre>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Card label="conversas" value={stats!.convsTotal} hint={`${stats!.convsAiOn} com IA on`} />
            <Card label="mensagens 24h" value={stats!.msgs24h} />
            <Card label="respostas IA 24h" value={stats!.msgsAssist24h} />
            <Card
              label="resposta rate"
              value={
                stats!.msgs24h > 0
                  ? `${Math.round((stats!.msgsAssist24h / stats!.msgs24h) * 100)}%`
                  : "—"
              }
            />
          </div>

          <div>
            <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-3">
              ultimas conversas
            </h2>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-900">
              {stats!.lastConvs.length === 0 && (
                <div className="p-4 text-sm text-zinc-500">nenhuma conversa ainda.</div>
              )}
              {stats!.lastConvs.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/conversas/${c.id}`}
                  className="flex items-center justify-between p-3 hover:bg-zinc-900/60 transition text-sm"
                >
                  <div>
                    <span className="text-zinc-200">{c.contactName ?? "—"}</span>
                    <span className="text-zinc-500 ml-2 font-mono text-xs">{c.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={
                        c.aiEnabled ? "text-[#a3ff5c]" : "text-zinc-600"
                      }
                    >
                      {c.aiEnabled ? "● ia on" : "○ ia off"}
                    </span>
                    <span className="text-zinc-600">
                      {new Date(c.updatedAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
