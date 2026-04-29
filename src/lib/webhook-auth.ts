import type { NextRequest } from "next/server";

/**
 * Verifica autenticação de webhook via Bearer token.
 *
 * Se `secret` não estiver definido, passa (permite tráfego — útil em dev).
 * Em produção, defina DC_WEBHOOK_SECRET / EVO_WEBHOOK_SECRET no Easypanel.
 *
 * Header esperado: Authorization: Bearer <secret>
 */
export function verifyWebhookBearer(req: NextRequest, secret: string | undefined): boolean {
  if (!secret) return true; // sem secret configurado → permite (dev)
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // comparação constante (evita timing attack)
  return timingSafeStringEq(token, secret);
}

function timingSafeStringEq(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // percorre mesmo assim para não vazar tamanho por timing
    let diff = 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return false; // tamanhos diferentes = sempre falso, mas sem short-circuit
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
