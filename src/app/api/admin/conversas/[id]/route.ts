import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/conversas/[id]
 * Atualiza aiEnabled / handoffReason / state.
 *
 * (auth garantida pelo middleware — só chega aqui se sessao valida)
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: { aiEnabled?: boolean; handoffReason?: string | null; state?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.aiEnabled === "boolean") data.aiEnabled = body.aiEnabled;
  if ("handoffReason" in body) data.handoffReason = body.handoffReason ?? null;
  if (typeof body.state === "string") data.state = body.state;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing_to_update" }, { status: 400 });
  }

  const updated = await prisma.conversation.update({ where: { id }, data });
  return NextResponse.json({ ok: true, conversation: updated });
}
