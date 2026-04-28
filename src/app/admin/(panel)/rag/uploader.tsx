"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Lock, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export function RagUploader({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [audience, setAudience] = useState<"client" | "internal">("client");
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
      setMsg({ kind: "err", text: "preencha título e conteúdo" });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await fetch("/api/admin/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          source: source || undefined,
          audience,
          agentId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ kind: "err", text: j.error ?? "falha" });
        return;
      }
      const j = await res.json();
      setMsg({ kind: "ok", text: `${j.chunkCount} chunks indexados` });
      setTitle("");
      setContent("");
      setSource("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent" /> Novo documento
        </CardTitle>
        <CardDescription>
          Upload de .txt/.md ou cole o conteúdo. Será scoped para{" "}
          <span className="text-accent font-medium">{agentName}</span> apenas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="título (ex: Limites e prazos CLT 2026)"
          />
          <Input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="source opcional (ex: arquivo.pdf)"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide mr-1">audience:</span>
          <button
            type="button"
            onClick={() => setAudience("client")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition",
              audience === "client"
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Globe className="h-3 w-3" /> client
          </button>
          <button
            type="button"
            onClick={() => setAudience("internal")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition",
              audience === "internal"
                ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Lock className="h-3 w-3" /> internal (NUNCA pro cliente)
          </button>
        </div>

        <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-muted/20 hover:bg-muted/40 cursor-pointer text-sm text-muted-foreground transition">
          <FileText className="h-4 w-4" />
          <span>Selecionar arquivo .txt ou .md…</span>
          <input
            type="file"
            accept=".txt,.md,.markdown,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
            }}
            className="hidden"
          />
        </label>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="ou cole o conteúdo aqui (txt/md)…"
          className="h-48 font-mono text-sm"
          spellCheck={false}
        />

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={pending}>
            <Upload className="h-4 w-4" /> {pending ? "indexando…" : "Indexar"}
          </Button>
          {msg && (
            <span
              className={cn(
                "text-xs",
                msg.kind === "ok" ? "text-accent" : "text-destructive",
              )}
            >
              {msg.text}
            </span>
          )}
          <span className="text-muted-foreground text-xs ml-auto">{content.length} chars</span>
        </div>
      </CardContent>
    </Card>
  );
}
