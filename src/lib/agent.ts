import { type Agent } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Carrega agente por slug com cache de processo.
 * Falha (lança) se nao existir ou estiver disabled.
 */
const cache = new Map<string, { at: number; agent: Agent }>();
const TTL_MS = 30_000;

export async function loadAgent(slug: string): Promise<Agent> {
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.agent;

  const agent = await prisma.agent.findUnique({ where: { slug } });
  if (!agent) throw new Error(`agent_not_found:${slug}`);
  if (!agent.enabled) throw new Error(`agent_disabled:${slug}`);

  cache.set(slug, { at: Date.now(), agent });
  return agent;
}

export function clearAgentCache(slug?: string) {
  if (slug) cache.delete(slug);
  else cache.clear();
}

/** Configuracao de canal: usa o defaults do env como fallback. */
export interface ChannelConfig {
  // datacrazy
  dcToken?: string;
  dcBaseUrl?: string;
  // evolution
  baseUrl?: string;
  apiKey?: string;
  instance?: string;
}

export function getChannelConfig(agent: Agent): ChannelConfig {
  return (agent.channelConfig as ChannelConfig | null) ?? {};
}
