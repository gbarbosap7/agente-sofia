import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkDb(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const redis = getRedis();
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const allOk = db.ok && redis.ok;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      service: "agente-sofia",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: { db, redis },
    },
    { status: allOk ? 200 : 503 },
  );
}
