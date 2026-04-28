"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

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
      className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-50"
    >
      {pending ? "…" : "apagar"}
    </button>
  );
}
