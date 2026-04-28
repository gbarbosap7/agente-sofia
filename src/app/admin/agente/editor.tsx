"use client";

import { useState, useTransition } from "react";

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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-[60vh] px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-[#a3ff5c] focus:outline-none text-sm font-mono leading-relaxed"
        spellCheck={false}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="px-4 py-1.5 rounded-md bg-[#a3ff5c] text-zinc-950 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "salvando…" : "salvar"}
        </button>
        <button
          onClick={reset}
          className="px-4 py-1.5 rounded-md border border-zinc-800 text-zinc-400 text-sm hover:text-zinc-100"
        >
          restaurar padrao
        </button>
        {saved && <span className="text-[#a3ff5c] text-xs">✓ salvo</span>}
        {err && <span className="text-red-400 text-xs">{err}</span>}
        <span className="text-zinc-600 text-xs ml-auto">{text.length} chars</span>
      </div>
    </div>
  );
}
