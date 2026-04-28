import { NextRequest, NextResponse } from "next/server";
import { POST as agentPost, GET as agentGet } from "./[slug]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook legacy sem slug → roteia pra agente 'sofia' por default.
 * Novos flows devem usar /api/webhooks/datacrazy/{slug}.
 */
function fakeCtx(): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug: "sofia" }) };
}

export async function POST(req: NextRequest) {
  return agentPost(req, fakeCtx());
}

export async function GET(req: NextRequest) {
  return agentGet(req, fakeCtx());
}

// re-export pra evitar dead-code warnings
void NextResponse;
