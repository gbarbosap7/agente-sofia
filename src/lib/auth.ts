import { cookies } from "next/headers";

/**
 * Auth ultra-simples para o admin — Web Crypto API (edge-compatible).
 * Login: email + senha → assina HMAC-SHA256 com SESSION_SECRET → seta cookie httpOnly.
 * Verify: lê cookie, recomputa HMAC, timing-safe compare.
 */

const COOKIE = "sofia_admin";
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function secret(): string {
  return process.env.SESSION_SECRET || "dev-secret-change-me-in-prod-please";
}

function bytesToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const b = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(b)) return new Uint8Array();
    out[i] = b;
  }
  return out;
}

function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string): Promise<string> {
  const key = await importKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(sig);
}

export async function issueToken(email: string): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const body = `${email}:${exp}`;
  const sig = await sign(body);
  return `${body}:${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [email, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = await sign(`${email}:${exp}`);
  const a = hexToBytes(sig);
  const b = hexToBytes(expected);
  if (a.length === 0 || !timingSafeEq(a, b)) return null;
  return { email };
}

export async function getSession() {
  const c = await cookies();
  return verifyToken(c.get(COOKIE)?.value);
}

export async function setSession(email: string) {
  const c = await cookies();
  const token = await issueToken(email);
  c.set(COOKIE, token, {
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
