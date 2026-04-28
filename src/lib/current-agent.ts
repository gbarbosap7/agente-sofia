import { cookies } from "next/headers";
import { type Agent } from "@prisma/client";
import { prisma } from "./prisma";

const COOKIE = "current_agent";

/** Lista todos os agentes habilitados (pra dropdown). */
export async function listAgents(): Promise<Agent[]> {
  return prisma.agent.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Carrega agente atual do admin baseado em cookie. Se nao tiver cookie ou
 * o slug for invalido, retorna o primeiro agente habilitado.
 */
export async function getCurrentAgent(): Promise<Agent | null> {
  const c = await cookies();
  const slug = c.get(COOKIE)?.value;
  if (slug) {
    const a = await prisma.agent.findUnique({ where: { slug } });
    if (a && a.enabled) return a;
  }
  // fallback: primeiro habilitado
  const first = await prisma.agent.findFirst({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  return first;
}

export async function setCurrentAgent(slug: string) {
  const c = await cookies();
  c.set(COOKIE, slug, {
    httpOnly: false, // client lê pra UI
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
