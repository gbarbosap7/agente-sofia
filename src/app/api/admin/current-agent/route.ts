import { NextRequest, NextResponse } from "next/server";
import { setCurrentAgent } from "@/lib/current-agent";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug) {
    return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
  }
  const a = await prisma.agent.findUnique({ where: { slug: body.slug } });
  if (!a) return NextResponse.json({ ok: false, error: "agent_not_found" }, { status: 404 });
  await setCurrentAgent(body.slug);
  return NextResponse.json({ ok: true });
}
