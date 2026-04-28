import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ToggleAi } from "./toggle";

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
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/conversas" className="text-zinc-500 text-xs hover:text-zinc-300">
        ← voltar
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {conv.contactName ?? <span className="text-zinc-500">(sem nome)</span>}
          </h1>
          <div className="text-zinc-500 text-sm mt-1 font-mono">{conv.phone}</div>
          <div className="text-zinc-600 text-xs mt-2">
            channel <span className="text-zinc-400">{conv.channel}</span>
            {conv.externalConvId && (
              <>
                {" · "}
                ext_conv <span className="text-zinc-400">{conv.externalConvId.slice(0, 12)}…</span>
              </>
            )}
            {conv.leadId && (
              <>
                {" · "}
                lead <span className="text-zinc-400">{conv.leadId}</span>
              </>
            )}
          </div>
        </div>

        <ToggleAi id={conv.id} aiEnabled={conv.aiEnabled} reason={conv.handoffReason} />
      </div>

      <div className="space-y-3">
        {conv.messages.length === 0 && (
          <div className="text-zinc-500 text-sm">sem mensagens.</div>
        )}
        {conv.messages.map((m) => {
          const isUser = m.role === "user";
          const isAssistant = m.role === "assistant";
          const isTool = m.role === "tool";
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                  isUser
                    ? "bg-zinc-900 border border-zinc-800"
                    : isAssistant
                      ? "bg-[#a3ff5c]/10 border border-[#a3ff5c]/30 text-zinc-100"
                      : "bg-zinc-950 border border-zinc-800 text-zinc-500 font-mono text-xs"
                }`}
              >
                <div className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">
                  {m.role}
                  {" · "}
                  {new Date(m.createdAt).toLocaleString("pt-BR")}
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
