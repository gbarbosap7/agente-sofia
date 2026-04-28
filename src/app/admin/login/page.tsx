"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
      setErr(j.error ?? "Falha no login");
      return;
    }
    const next = search.get("next") || "/admin";
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-[#a3ff5c]">sofia</span> · admin
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Entre pra gerenciar o agente.</p>
      </div>

      <div className="space-y-3">
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 focus:border-[#a3ff5c] focus:outline-none text-sm"
        />
        <input
          type="password"
          placeholder="senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 focus:border-[#a3ff5c] focus:outline-none text-sm"
        />
      </div>

      {err && <div className="text-red-400 text-sm">{err}</div>}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2 rounded-md bg-[#a3ff5c] text-zinc-950 font-medium hover:opacity-90 disabled:opacity-50 text-sm"
      >
        {busy ? "entrando…" : "entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-6">
      <Suspense fallback={<div className="text-zinc-500">…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
