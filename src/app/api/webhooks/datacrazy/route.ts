import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * STUB — DataCrazy inbound webhook.
 *
 * Vai evoluir para:
 *  1. validar HMAC X-Signature (DC_WEBHOOK_SECRET)
 *  2. dedup por providerMsgId
 *  3. Redis lock(phone) + debounce 5s
 *  4. enfileirar pra worker BullMQ
 *  5. retornar 200 imediato
 *
 * Por enquanto só ecoa o payload pra validar o pipeline.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const headers = Object.fromEntries(req.headers.entries());

  // log estruturado pra ser scrappable
  console.log(JSON.stringify({
    event: "datacrazy.inbound",
    body,
    headers: { "user-agent": headers["user-agent"], signature: headers["x-signature"] },
    ts: Date.now(),
  }));

  return NextResponse.json({ ok: true, received: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST aqui com o webhook do DataCrazy",
  });
}
