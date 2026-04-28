import Link from "next/link";
import { ArrowRight, MessagesSquare, Bot, Activity, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentAgent } from "@/lib/current-agent";

export const dynamic = "force-dynamic";

async function getStats(agentId: string) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [convsTotal, convsAiOn, msgs24h, msgsAssist24h, lastConvs] = await Promise.all([
    prisma.conversation.count({ where: { agentId } }),
    prisma.conversation.count({ where: { agentId, aiEnabled: true } }),
    prisma.message.count({
      where: { createdAt: { gte: since24h }, conversation: { agentId } },
    }),
    prisma.message.count({
      where: { createdAt: { gte: since24h }, role: "assistant", conversation: { agentId } },
    }),
    prisma.conversation.findMany({
      where: { agentId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, phone: true, contactName: true, aiEnabled: true, updatedAt: true },
    }),
  ]);
  return { convsTotal, convsAiOn, msgs24h, msgsAssist24h, lastConvs };
}

export default async function DashboardPage() {
  const agent = await getCurrentAgent();
  if (!agent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhum agente configurado</CardTitle>
          <CardDescription>
            <Link href="/admin/agents" className="text-accent hover:underline">
              Crie um agente
            </Link>{" "}
            pra começar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  let stats: Awaited<ReturnType<typeof getStats>> | null = null;
  let dbErr: string | null = null;
  try {
    stats = await getStats(agent.id);
  } catch (e) {
    dbErr = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          agente <span className="text-accent font-medium">{agent.name}</span> — últimas 24h
        </p>
      </div>

      {dbErr ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">DB indisponível</CardTitle>
            <CardDescription>
              <pre className="text-xs whitespace-pre-wrap mt-2 text-destructive/80">{dbErr}</pre>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={MessagesSquare}
              label="Conversas"
              value={stats!.convsTotal}
              hint={`${stats!.convsAiOn} com IA on`}
            />
            <StatCard icon={Activity} label="Mensagens 24h" value={stats!.msgs24h} />
            <StatCard icon={Bot} label="Respostas IA 24h" value={stats!.msgsAssist24h} />
            <StatCard
              icon={Activity}
              label="Resposta rate"
              value={
                stats!.msgs24h > 0
                  ? `${Math.round((stats!.msgsAssist24h / stats!.msgs24h) * 100)}%`
                  : "—"
              }
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Últimas conversas</CardTitle>
                <CardDescription>5 mais recentes</CardDescription>
              </div>
              <Link
                href="/admin/conversas"
                className="text-xs text-accent hover:underline flex items-center gap-1"
              >
                ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {stats!.lastConvs.length === 0 && (
                  <div className="p-5 text-sm text-muted-foreground">nenhuma conversa ainda.</div>
                )}
                {stats!.lastConvs.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/conversas/${c.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
                        {(c.contactName ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {c.contactName ?? <span className="text-muted-foreground">(sem nome)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{c.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={c.aiEnabled ? "accent" : "default"}>
                        {c.aiEnabled ? "ia on" : "ia off"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleString("pt-BR")}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
