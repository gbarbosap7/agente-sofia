"use client";

import { useState, useTransition } from "react";
import { Save, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function PromptEditor({ initial, fallback }: { initial: string; fallback: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setErr(null);
    setSaved(false);
    start(async () => {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "system_prompt", value: text }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "falha ao salvar");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function reset() {
    setText(fallback);
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-[60vh] font-mono text-sm leading-relaxed"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "salvando…" : "Salvar"}
        </Button>
        <Button onClick={reset} variant="outline">
          <RotateCcw className="h-4 w-4" />
          Restaurar padrão
        </Button>
        {saved && (
          <span className="text-accent text-xs flex items-center gap-1">
            <Check className="h-3.5 w-3.5" /> salvo
          </span>
        )}
        {err && <span className="text-destructive text-xs">{err}</span>}
        <span className="text-muted-foreground text-xs ml-auto">{text.length} chars</span>
      </div>
    </div>
  );
}
