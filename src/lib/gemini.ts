import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import { Prisma, type Agent, type Conversation } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";
import { getDeclarations, runTool } from "./tools";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
  return _client;
}

const MAX_TOOL_ITER = 5;
const HISTORY_LIMIT = 30;

async function buildHistory(conversationId: string): Promise<Content[]> {
  const msgs = await prisma.message.findMany({
    where: { conversationId, role: { in: ["user", "assistant", "system"] } },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });
  return msgs.map<Content>((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    // Mensagens system (ex: "cliente assinou") chegam ao Gemini como contexto user
    parts: [{ text: m.role === "system" ? `[Sistema]: ${m.content}` : m.content }],
  }));
}

function buildContextPrefix(conversation: Conversation): string {
  const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
  const lines: string[] = [];
  lines.push(`# Contexto da conversa`);
  lines.push(`- phone: ${conversation.phone}`);
  if (conversation.contactName) lines.push(`- nome: ${conversation.contactName}`);
  if (meta.cpf) lines.push(`- cpf: ${meta.cpf}`);
  if (meta.simulation) lines.push(`- simulacao: ${JSON.stringify(meta.simulation)}`);
  if (meta.signatureUrl) lines.push(`- link assinatura: ${meta.signatureUrl}`);
  return lines.join("\n");
}

/**
 * Roda um turno completo. Multi-agent: usa agent.systemPrompt + filtro de
 * tools por agent.enabledTools.
 */
export async function runTurn(
  agent: Agent,
  conversation: Conversation,
): Promise<{ reply: string | null; toolsRun: string[] }> {
  const ctxPrefix = buildContextPrefix(conversation);
  const history = await buildHistory(conversation.id);
  const toolsRun: string[] = [];
  const allowedTools = new Set(agent.enabledTools);
  const declarations = getDeclarations().filter((d) => allowedTools.has(d.name));

  const contents: Content[] = [...history];

  for (let iter = 0; iter < MAX_TOOL_ITER; iter++) {
    const res = await client().models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: `${agent.systemPrompt}\n\n---\n${ctxPrefix}`,
        temperature: 0.6,
        thinkingConfig: { thinkingBudget: 0 },
        tools: declarations.length
          ? [{ functionDeclarations: declarations as unknown as FunctionDeclaration[] }]
          : undefined,
      },
    });

    const modelParts: Part[] = res.candidates?.[0]?.content?.parts ?? [];
    const calls: FunctionCall[] = modelParts
      .map((p) => p.functionCall)
      .filter((c): c is FunctionCall => Boolean(c));

    if (calls.length === 0) {
      const text = (res.text ?? "").trim();
      if (!text) return { reply: null, toolsRun };
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: text,
          metadata: {
            agentSlug: agent.slug,
            model: env.GEMINI_MODEL,
            toolsRun,
          } as Prisma.InputJsonValue,
        },
      });
      return { reply: text, toolsRun };
    }

    contents.push({ role: "model", parts: modelParts });

    const responses: Content[] = [];
    for (const c of calls) {
      const name = c.name ?? "";
      const args = (c.args ?? {}) as Record<string, unknown>;

      // Bloqueio: se a tool nao esta habilitada pra esse agente, retorna erro
      if (!allowedTools.has(name)) {
        responses.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name,
                response: { error: `tool_disabled_for_agent:${agent.slug}` },
              },
            },
          ],
        });
        continue;
      }

      toolsRun.push(name);
      const result = await runTool(name, args, { agent, conversation });
      responses.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name,
              response: result.ok
                ? (result.output as Record<string, unknown>) ?? { ok: true }
                : { error: result.error ?? "unknown" },
            },
          },
        ],
      });
    }
    contents.push(...responses);
  }

  return { reply: null, toolsRun };
}
