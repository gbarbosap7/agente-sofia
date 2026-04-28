import { NextRequest, NextResponse } from "next/server";
import { setSetting, listSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, settings: await listSettings() });
}

export async function POST(req: NextRequest) {
  let body: { name?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.name || typeof body.value !== "string") {
    return NextResponse.json({ ok: false, error: "missing_name_or_value" }, { status: 400 });
  }
  if (body.value.length > 50_000) {
    return NextResponse.json({ ok: false, error: "value_too_large" }, { status: 400 });
  }
  await setSetting(body.name, body.value);
  return NextResponse.json({ ok: true });
}
