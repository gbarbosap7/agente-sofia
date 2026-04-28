"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Power, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";

interface AgentData {
  id: string;
  slug: string;
  name: string;
  systemPrompt: string;
  enabledTools: string[];
  enabled: boolean;
  channelConfig: Record<string, unknown> | null;
  channel: string;
}

export function AgentEditor({
  agent,
  allTools,
}: {
  agent: AgentData;
  allTools: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(agent.name);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [tools, setTools] = useState(new Set(agent.enabledTools));
  const [config, setConfig] = useState(JSON.stringify(agent.channelConfig ?? {}, null, 2));
  const [enabled, setEnabled] = useState(agent.enabled);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function toggleTool(t: string) {
    const n = new Set(tools);
    if (n.has(t)) n.delete(t);
    else n.add(t);
    setTools(n);
  }

  function save() {
    setMsg(null);
    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(config || "{}");
    } catch {
      setMsg({ kind: "err", text: "channelConfig: JSON invalido" });
      return;
    }
    start(async () => {
      const res = await fetch(`/api/admin/agents/${agent.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          systemPrompt,
          enabledTools: [...tools],
          channelConfig: parsedConfig,
          enabled,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ kind: "err", text: j.error ?? "falha" });
        return;
      }
      setMsg({ kind: "ok", text: "salvo" });
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground block mb-1">
              Nome do agente
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={enabled ? "default" : "outline"}
              size="sm"
              onClick={() => setEnabled(!enabled)}
            >
              <Power className="h-3.5 w-3.5" /> {enabled ? "Habilitado" : "Desabilitado"}
            </Button>
            <span className="text-xs text-muted-foreground">
              quando off, webhook responde 404
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System prompt</CardTitle>
          <CardDescription>
            Personalidade, funil, regras de confidencialidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="h-[50vh] font-mono text-sm leading-relaxed"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tools habilitadas</CardTitle>
          <CardDescription>
            Apenas as tools aqui podem ser chamadas pelo Gemini.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {allTools.map((t) => {
            const on = tools.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTool(t)}
                className={cn(
                  "px-3 py-1.5 rounded-md border text-xs font-mono transition",
                  on
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {on ? "● " : "○ "}
                {t}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel config (JSON)</CardTitle>
          <CardDescription>
            {agent.channel === "evolution"
              ? "Ex: { instance: 'nayana', apiKey: '...', baseUrl: 'http://evolution-api:8080' }"
              : "Ex: { dcToken: 'override-opcional' } — vazio usa env DC_TOKEN."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            className="h-32 font-mono text-xs"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          <Save className="h-4 w-4" /> {pending ? "salvando…" : "Salvar"}
        </Button>
        {msg && (
          <span
            className={cn(
              "text-xs flex items-center gap-1",
              msg.kind === "ok" ? "text-accent" : "text-destructive",
            )}
          >
            {msg.kind === "ok" && <Check className="h-3.5 w-3.5" />}
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
