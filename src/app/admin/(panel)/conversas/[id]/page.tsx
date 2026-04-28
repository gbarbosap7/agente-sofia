import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleAi } from "./toggle";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function ConversaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conv) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/conversas"
        className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> voltar
      </Link>

      <Card>
        <CardContent className="flex items-start justify-between p-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {conv.contactName ?? <span className="text-muted-foreground">(sem nome)</span>}
            </h1>
            <div className="text-muted-foreground text-sm mt-1 font-mono">{conv.phone}</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline">{conv.channel}</Badge>
              <span>·</span>
              <Badge variant={conv.aiEnabled ? "accent" : "default"}>
                {conv.aiEnabled ? "ia on" : "ia off"}
              </Badge>
              {conv.handoffReason && <span>· motivo: {conv.handoffReason}</span>}
              {conv.leadId && (
                <>
                  <span>·</span>
                  <span>lead {conv.leadId}</span>
                </>
              )}
            </div>
          </div>
          <ToggleAi id={conv.id} aiEnabled={conv.aiEnabled} reason={conv.handoffReason} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {conv.messages.length === 0 && (
          <div className="text-muted-foreground text-sm text-center py-8">
            sem mensagens.
          </div>
        )}
        {conv.messages.map((m) => {
          const isUser = m.role === "user";
          const isAssistant = m.role === "assistant";
          return (
            <div key={m.id} className={cn("flex", isUser ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-4 py-2 text-sm border",
                  isUser
                    ? "bg-card border-border"
                    : isAssistant
                      ? "bg-accent/10 border-accent/30 text-foreground"
                      : "bg-muted/30 border-border text-muted-foreground font-mono text-xs",
                )}
              >
                <div className="text-muted-foreground text-[10px] uppercase tracking-wide mb-1">
                  {m.role} · {new Date(m.createdAt).toLocaleString("pt-BR")}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
