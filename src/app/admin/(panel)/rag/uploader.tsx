"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RagUploader() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function readFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setContent(text);
      if (!title) setTitle(f.name.replace(/\.(txt|md|markdown)$/i, ""));
      setSource(f.name);
    };
    reader.readAsText(f);
  }

  function submit() {
    if (!title || !content) {
      setMsg({ kind: "err", text: "preencha titulo e conteudo" });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await fetch("/api/admin/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, source: source || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ kind: "err", text: j.error ?? "falha" });
        return;
      }
      const j = await res.json();
      setMsg({
        kind: "ok",
        text: `ok · ${j.chunkCount} chunks indexados`,
      });
      setTitle("");
      setContent("");
      setSource("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">novo documento</div>

      <div className="grid grid-cols-2 gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="titulo (ex: Politica de comissionamento 2026)"
          className="px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 focus:border-[#a3ff5c] focus:outline-none text-sm"
        />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="source (opcional, ex: arquivo.pdf)"
          className="px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 focus:border-[#a3ff5c] focus:outline-none text-sm"
        />
      </div>

      <input
        type="file"
        accept=".txt,.md,.markdown,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
        }}
        className="text-xs text-zinc-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-zinc-800 file:bg-zinc-900 file:text-zinc-300 hover:file:border-[#a3ff5c]/40 hover:file:text-[#a3ff5c] cursor-pointer"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="cole o conteudo aqui (txt/md). PDF chega depois."
        className="w-full h-48 px-3 py-2 rounded-md bg-zinc-950 border border-zinc-800 focus:border-[#a3ff5c] focus:outline-none text-sm font-mono"
        spellCheck={false}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending}
          className="px-4 py-1.5 rounded-md bg-[#a3ff5c] text-zinc-950 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "indexando…" : "indexar"}
        </button>
        {msg && (
          <span
            className={`text-xs ${msg.kind === "ok" ? "text-[#a3ff5c]" : "text-red-400"}`}
          >
            {msg.text}
          </span>
        )}
        <span className="text-zinc-600 text-xs ml-auto">{content.length} chars</span>
      </div>
    </div>
  );
}
