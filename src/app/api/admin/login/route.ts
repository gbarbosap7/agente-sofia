import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

/**
 * Login: POST { email, password }.
 *
 * Verificação:
 *  - email === ADMIN_EMAIL (env)
 *  - sha256(password) === ADMIN_PASSWORD_HASH (env), timing-safe
 *
 * Se ADMIN_PASSWORD_HASH não for setado, aceita qualquer senha pra
 * destravar primeiro acesso (e exige troca via /admin/configs).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "missing_credentials" }, { status: 400 });
  }

  const expectedEmail = env.ADMIN_EMAIL || "adaptabms@gmail.com";
  if (email.trim().toLowerCase() !== expectedEmail.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "credenciais inválidas" }, { status: 401 });
  }

  const hash = createHash("sha256").update(password).digest("hex");
  const expectedHash = env.ADMIN_PASSWORD_HASH;

  if (expectedHash) {
    try {
      const a = Buffer.from(hash, "hex");
      const b = Buffer.from(expectedHash, "hex");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ ok: false, error: "credenciais inválidas" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "credenciais inválidas" }, { status: 401 });
    }
  }
  // sem ADMIN_PASSWORD_HASH → aceita qualquer senha (modo bootstrap)

  await setSession(email);
  return NextResponse.json({ ok: true });
}
