import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tools / RAG</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Documentos indexados (Gemini embeddings 768d, HNSW). A tool{" "}
          <code className="text-accent">rag_search</code> busca aqui durante a conversa.
        </p>
      </div>

      <RagUploader />

      <Card>
        <CardHeader>
          <CardTitle>Documentos ({docs.length})</CardTitle>
          <CardDescription>
            <Badge variant="accent">client</Badge> = Sofia pode usar ·{" "}
            <Badge variant="warn">internal</Badge> = oculto da Sofia
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <div className="px-5 py-6 text-muted-foreground text-sm">
              Nenhum documento ainda. Suba um no formulário acima.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{d.title}</span>
                      <Badge variant={d.audience === "internal" ? "warn" : "accent"}>
                        {d.audience}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {d.source && <span className="mr-3">{d.source}</span>}
                      <span>{m.get(d.id) ?? 0} chunks</span>
                      <span className="ml-3">
                        {new Date(d.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <DeleteDocButton id={d.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
