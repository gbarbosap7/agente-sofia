import { getRedis } from "./redis";

/**
 * Rate limiter por phone usando sliding window no Redis.
 *
 * Usa INCR + EXPIRE para contar requests por janela.
 * Retorna { allowed, remaining, resetInMs }.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Verifica e incrementa o contador de rate limit.
 *
 * @param phone  Identificador único (phone normalizado)
 * @param limit  Máximo de requests na janela (default: 30)
 * @param windowSec  Tamanho da janela em segundos (default: 60)
 */
export async function checkRateLimit(
  phone: string,
  limit = 30,
  windowSec = 60,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const key = `rl:phone:${phone}`;

  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.ttl(key);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) ?? 1;
  const ttl = (results?.[1]?.[1] as number) ?? -1;

  // Seta expiração apenas na primeira request da janela
  if (ttl === -1) {
    await redis.expire(key, windowSec);
  }

  const remaining = Math.max(0, limit - count);
  const resetInMs = ttl > 0 ? ttl * 1000 : windowSec * 1000;

  return {
    allowed: count <= limit,
    remaining,
    resetInMs,
  };
}
