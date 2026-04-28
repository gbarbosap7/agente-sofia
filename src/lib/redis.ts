import IORedis, { type Redis } from "ioredis";

/**
 * Lazy Redis singleton — NUNCA instanciar no top-level de um módulo, isso
 * quebra `next build` (collecting page data tenta carregar e falha sem REDIS_URL).
 */
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  _redis = new IORedis(url, {
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: false,
    lazyConnect: false,
  });
  return _redis;
}

/** Lock distribuído por chave (debounce + ownership). */
export async function withLock<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const redis = getRedis();
  const token = `${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const acquired = await redis.set(`lock:${key}`, token, "EX", ttlSec, "NX");
  if (acquired !== "OK") return null;

  try {
    return await fn();
  } finally {
    // Lua script — só libera se o token bater (evita liberar lock de outro)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    await redis.eval(script, 1, `lock:${key}`, token).catch(() => {});
  }
}
