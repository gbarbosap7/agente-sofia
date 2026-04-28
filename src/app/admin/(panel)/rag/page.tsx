import { prisma } from "@/lib/prisma";
import { RagUploader } from "./uploader";
import { DeleteDocButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function RagPage() {
  const docs = await prisma.kbDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const counts = await prisma.kbChunk.groupBy({
    by: ["documentId"],
    _count: { _all: true },
  });
  const m = new Map(counts.map((c) => [c.documentId, c._count._all]));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">rag · base de conhecimento</h1>
        <p className="text-zinc-500 text-sm mt-1">
          documentos indexados (Gemini embeddings 768d, HNSW). A tool{" "}
          <code className="text-[#a3ff5c] font-mono">rag_search</code> busca aqui durante a conversa.
        </p>
      </div>

      <RagUploader />

      <div>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
          documentos ({docs.length})
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-900">
          {docs.length === 0 ? (
            <div className="p-4 text-zinc-500 text-sm">nenhum documento ainda.</div>
          ) : (
            docs.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-100">{d.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        d.audience === "internal"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-zinc-800/50 text-zinc-400 border border-zinc-700"
                      }`}
                    >
                      {d.audience}
                    </span>
                  </div>
                  <div className="text-zinc-500 text-xs mt-0.5">
                    {d.source && <span className="mr-3">{d.source}</span>}
                    <span>{m.get(d.id) ?? 0} chunks</span>
                    <span className="ml-3">
                      {new Date(d.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
                <DeleteDocButton id={d.id} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
