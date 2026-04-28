"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "credenciais inválidas");
      return;
    }
    const next = search.get("next") || "/admin";
    router.push(next);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="p-6 space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-accent/15 border border-accent/30 mb-3">
            <Bot className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-accent">agente-sofia</span>
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            Entre para gerenciar o agente.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Input
            type="password"
            placeholder="senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {err && <div className="text-destructive text-xs">{err}</div>}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "entrando…" : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
      <Suspense fallback={<div className="text-muted-foreground">…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
