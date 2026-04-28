import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestDocument, deleteDocument } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const docs = await prisma.kbDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // count chunks per doc
  const counts = await prisma.kbChunk.groupBy({
    by: ["documentId"],
    _count: { _all: true },
  });
  const m = new Map(counts.map((c) => [c.documentId, c._count._all]));
  return NextResponse.json({
    ok: true,
    docs: docs.map((d) => ({ ...d, chunkCount: m.get(d.id) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    content?: string;
    source?: string;
    audience?: "client" | "internal";
    agentId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.title || !body.content) {
    return NextResponse.json({ ok: false, error: "missing_title_or_content" }, { status: 400 });
  }
  if (!body.agentId) {
    return NextResponse.json({ ok: false, error: "missing_agentId" }, { status: 400 });
  }
  if (body.content.length > 200_000) {
    return NextResponse.json({ ok: false, error: "content_too_large" }, { status: 400 });
  }
  const result = await ingestDocument({
    title: body.title,
    content: body.content,
    source: body.source,
    audience: body.audience === "internal" ? "internal" : "client",
    agentId: body.agentId,
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
