"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@prisma/client";
import { ChevronDown, Bot, Send, MessagesSquare } from "lucide-react";

const channelIcon = {
  datacrazy: MessagesSquare,
  evolution: Send,
} as const;

export function AgentSwitcher({
  agents,
  currentSlug,
}: {
  agents: Agent[];
  currentSlug: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(slug: string) {
    if (slug === currentSlug) return;
    start(async () => {
      await fetch("/api/admin/current-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      router.refresh();
    });
  }

  const current = agents.find((a) => a.slug === currentSlug) ?? null;

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition border border-border"
        disabled={pending}
      >
        <span className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" />
          {current ? (
            <>
              <span className="font-medium">{current.name}</span>
              <span className="text-xs text-muted-foreground">{current.channel}</span>
            </>
          ) : (
            <span className="text-muted-foreground">selecione…</span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="absolute left-0 right-0 mt-1 rounded-md border border-border bg-card shadow-lg z-50 hidden group-focus-within:block group-hover:block">
        {agents.map((a) => {
          const Icon = channelIcon[a.channel as keyof typeof channelIcon] ?? Bot;
          const active = a.slug === currentSlug;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => pick(a.slug)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition ${
                active ? "text-accent" : "text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                {a.name}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase">
                {a.channel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
