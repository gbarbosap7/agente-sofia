import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Auth ultra-simples para o admin.
 * Login: email + senha → assina HMAC com SESSION_SECRET → seta cookie httpOnly.
 * Verify: lê cookie, recomputa HMAC, timing-safe compare.
 *
 * Não é production-grade (sem rotation, sem revoke, single-user) — é só pra
 * trancar /admin enquanto não migramos pra NextAuth/Clerk.
 */

const COOKIE = "sofia_admin";
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function secret(): string {
  return env.SESSION_SECRET || "dev-secret-change-me-in-prod-please";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function issueToken(email: string): string {
  const exp = Date.now() + TTL_MS;
  const body = `${email}:${exp}`;
  const sig = sign(body);
  return `${body}:${sig}`;
}

export function verifyToken(token: string | undefined): { email: string } | null {
  if (!token) return null;
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [email, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = sign(`${email}:${exp}`);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { email };
}

export async function getSession() {
  const c = await cookies();
  return verifyToken(c.get(COOKIE)?.value);
}

export async function setSession(email: string) {
  const c = await cookies();
  c.set(COOKIE, issueToken(email), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export const ADMIN_COOKIE = COOKIE;
