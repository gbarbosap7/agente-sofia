import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await clearSession();
  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
