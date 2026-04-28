"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteDocButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function del() {
    if (!confirm("apagar esse documento e todos os chunks?")) return;
    start(async () => {
      await fetch(`/api/admin/rag?id=${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <button
      onClick={del}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50 transition"
      title="apagar"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "…" : "apagar"}
    </button>
  );
}
