import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clearAgentCache } from "@/lib/agent";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: {
    name?: string;
    systemPrompt?: string;
    enabledTools?: string[];
    channelConfig?: unknown;
    enabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const data: Prisma.AgentUpdateInput = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.systemPrompt === "string") data.systemPrompt = body.systemPrompt;
  if (Array.isArray(body.enabledTools))
    data.enabledTools = body.enabledTools.filter((t) => typeof t === "string");
  if (body.channelConfig !== undefined)
    data.channelConfig = (body.channelConfig ?? {}) as Prisma.InputJsonValue;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  const agent = await prisma.agent.update({ where: { slug }, data });
  clearAgentCache(slug);
  return NextResponse.json({ ok: true, agent });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const agent = await prisma.agent.findUnique({ where: { slug } });
  if (!agent) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, agent });
}
