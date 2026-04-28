import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AgentEditor } from "./editor";

export const dynamic = "force-dynamic";

const ALL_TOOLS = [
  "extract_cpf",
  "consult_joinbank",
  "send_signature_link",
  "transfer_human",
  "finish_conversation",
  "alert_owner",
  "rag_search",
] as const;

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await prisma.agent.findUnique({ where: { slug } });
  if (!agent) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/agents"
        className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> agentes
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          slug <code className="text-accent">{agent.slug}</code> · canal{" "}
          <code className="text-accent">{agent.channel}</code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>Cole essa URL no flow do canal correspondente.</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block px-3 py-2 rounded-md bg-muted/30 text-sm font-mono text-accent break-all border border-border">
            POST /api/webhooks/{agent.channel}/{agent.slug}
          </code>
        </CardContent>
      </Card>

      <AgentEditor
        agent={{
          id: agent.id,
          slug: agent.slug,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          enabledTools: agent.enabledTools,
          enabled: agent.enabled,
          channelConfig: agent.channelConfig as Record<string, unknown> | null,
          channel: agent.channel,
        }}
        allTools={[...ALL_TOOLS]}
      />
    </div>
  );
}
