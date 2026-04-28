import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { embed, embedMany } from "./embeddings";

/**
 * RAG simples — chunking por paragrafo, embeddings Gemini 768d,
 * busca por cosine similarity via index HNSW (criado na migration).
 *
 * Tabelas:
 *  - v2_kb_documents: 1 linha por arquivo
 *  - v2_kb_chunks: N linhas por doc, embedding vector(768)
 */

const CHUNK_TARGET = 700;  // chars por chunk (~150 tokens)
const CHUNK_OVERLAP = 100; // chars de overlap

function chunkText(text: string): string[] {
  // primeiro tenta quebrar por paragrafos duplos
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > CHUNK_TARGET && buf) {
      chunks.push(buf);
      // overlap: pega ultima parte do buf
      buf = buf.slice(-CHUNK_OVERLAP) + "\n\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf) chunks.push(buf);

  // se algum chunk ficou gigante (paragrafo > target), corta hard
  return chunks.flatMap((c) => {
    if (c.length <= CHUNK_TARGET * 2) return [c];
    const parts: string[] = [];
    for (let i = 0; i < c.length; i += CHUNK_TARGET) {
      parts.push(c.slice(i, i + CHUNK_TARGET + CHUNK_OVERLAP));
    }
    return parts;
  });
}

function vecLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export async function ingestDocument(input: {
  title: string;
  source?: string;
  content: string;
  audience?: "client" | "internal";
  agentId?: string | null;            // null = compartilhado
  metadata?: Record<string, unknown>;
}): Promise<{ documentId: string; chunkCount: number }> {
  const chunks = chunkText(input.content);
  if (chunks.length === 0) throw new Error("empty_content");

  const doc = await prisma.kbDocument.create({
    data: {
      title: input.title,
      source: input.source ?? null,
      audience: input.audience ?? "client",
      agentId: input.agentId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  // gera embeddings em paralelo controlado
  const embeddings = await embedMany(chunks);

  // insere chunks via raw SQL (vector type nao tem suporte direto no Prisma)
  for (let i = 0; i < chunks.length; i++) {
    const id = `c_${doc.id}_${i}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.v2_kb_chunks (id, document_id, content, embedding, ord)
       VALUES ($1, $2, $3, $4::vector, $5)`,
      id,
      doc.id,
      chunks[i],
      vecLiteral(embeddings[i]),
      i,
    );
  }

  return { documentId: doc.id, chunkCount: chunks.length };
}

export async function deleteDocument(id: string) {
  // chunks caem por cascade
  await prisma.kbDocument.delete({ where: { id } });
}

export interface RagHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  similarity: number;
}

export async function searchRag(
  query: string,
  topK = 4,
  audience: "client" | "internal" = "client",
  agentId?: string,
): Promise<RagHit[]> {
  const qVec = await embed(query);
  // Filtros: audience + (agent_id = X OR agent_id IS NULL) — null = compartilhado
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      document_id: string;
      title: string;
      content: string;
      sim: number;
    }>
  >(
    `SELECT c.id, c.document_id, d.title, c.content,
            1 - (c.embedding <=> $1::vector) AS sim
     FROM public.v2_kb_chunks c
     JOIN public.v2_kb_documents d ON d.id = c.document_id
     WHERE d.audience = $3
       AND ($4::text IS NULL OR d.agent_id IS NULL OR d.agent_id = $4)
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    vecLiteral(qVec),
    topK,
    audience,
    agentId ?? null,
  );
  return rows.map((r) => ({
    chunkId: r.id,
    documentId: r.document_id,
    documentTitle: r.title,
    content: r.content,
    similarity: Number(r.sim),
  }));
}
