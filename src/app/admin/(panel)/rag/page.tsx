import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RagPage() {
  let docs: Awaited<ReturnType<typeof prisma.kbDocument.findMany>> = [];
  try {
    docs = await prisma.kbDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    // db indisponivel — segue exibindo vazio
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">rag · base de conhecimento</h1>
        <p className="text-zinc-500 text-sm mt-1">
          documentos indexados (pgvector). Upload + reindex chega no proximo sprint.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        <div className="font-medium text-zinc-200 mb-1">em construcao</div>
        Upload de PDF + chunking + embeddings Gemini 768d sera adicionado no proximo deploy. Por
        enquanto a tabela <code className="text-[#a3ff5c] font-mono">v2_kb_documents</code> existe
        e esta vazia.
      </div>

      <div>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">documentos</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-900">
          {docs.length === 0 ? (
            <div className="p-4 text-zinc-500 text-sm">nenhum documento.</div>
          ) : (
            docs.map((d) => (
              <div key={d.id} className="px-4 py-2 text-sm flex justify-between">
                <span>{d.title}</span>
                <span className="text-zinc-500 text-xs">
                  {new Date(d.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
