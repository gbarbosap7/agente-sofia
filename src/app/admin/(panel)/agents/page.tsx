import Link from "next/link";
import { Bot, MessagesSquare, Send, Plus, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const channelIcon = {
  datacrazy: MessagesSquare,
  evolution: Send,
} as const;

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { conversations: true, kbDocuments: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agentes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cada agente tem seu próprio prompt, KB, tools e canal.
          </p>
        </div>
        <Link
          href="/admin/agents/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" /> Novo agente
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {agents.map((a) => {
          const Icon = channelIcon[a.channel as keyof typeof channelIcon] ?? Bot;
          return (
            <Link key={a.id} href={`/admin/agents/${a.slug}`}>
              <Card className="hover:border-accent/50 transition cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <CardTitle>{a.name}</CardTitle>
                        <CardDescription className="font-mono text-xs">
                          /api/webhooks/{a.channel}/{a.slug}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={a.enabled ? "accent" : "default"}>
                      {a.enabled ? "ativo" : "off"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex gap-4">
                    <span>{a._count.conversations} conversas</span>
                    <span>{a._count.kbDocuments} docs</span>
                    <span>{a.enabledTools.length} tools</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
