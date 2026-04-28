"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="flex flex-col items-end gap-2 min-w-48">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">IA</span>
      <Button
        onClick={toggle}
        disabled={pending}
        variant={aiEnabled ? "default" : "outline"}
        size="sm"
      >
        <Power className="h-3.5 w-3.5" />
        {aiEnabled ? "Desligar IA" : "Reativar IA"}
      </Button>
      {aiEnabled && (
        <Input
          value={r}
          onChange={(e) => setR(e.target.value)}
          placeholder="motivo do handoff (opcional)"
          className="text-xs h-8"
        />
      )}
    </div>
  );
}
