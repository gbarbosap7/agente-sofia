"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ToggleAi({
  id,
  aiEnabled,
  reason,
}: {
  id: string;
  aiEnabled: boolean;
  reason: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [r, setR] = useState(reason ?? "");

  function toggle() {
    start(async () => {
      await fetch(`/api/admin/conversas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled: !aiEnabled, handoffReason: aiEnabled ? r : null }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">ia</div>
      <button
        onClick={toggle}
        disabled={pending}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 ${
          aiEnabled
            ? "bg-[#a3ff5c] text-zinc-950 hover:opacity-90"
            : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100"
        }`}
      >
        {aiEnabled ? "● on" : "○ off"}
      </button>
      {aiEnabled && (
        <input
          value={r}
          onChange={(e) => setR(e.target.value)}
          placeholder="motivo handoff (ao desligar)"
          className="text-xs px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 w-48 focus:border-[#a3ff5c] focus:outline-none"
        />
      )}
    </div>
  );
}
