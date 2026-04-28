import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
} from "@google/genai";
import { Prisma, type Conversation } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";
import { getDeclarations, runTool } from "./tools";
import { getSetting, DEFAULT_SYSTEM_PROMPT } from "./settings";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
  return _client;
}

const MAX_TOOL_ITER = 5;
const HISTORY_LIMIT = 30;

/**
 * Constroi o array de contents pra Gemini a partir do historico DB.
 * - role "user" → "user"
 * - role "assistant" → "model"
 * - role "tool"/"system" sao ignorados aqui (tool ja vai inline na iteracao)
 */
async function buildHistory(conversationId: string): Promise<Content[]> {
  const msgs = await prisma.message.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });
  return msgs.map<Content>((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function buildContextPrefix(conversation: Conversation): string {
  const meta = (conversation.metadata as Record<string, unknown> | null) ?? {};
  const lines: string[] = [];
  lines.push(`# Contexto da conversa`);
  lines.push(`- phone: ${conversation.phone}`);
  if (conversation.contactName) lines.push(`- nome: ${conversation.contactName}`);
  if (meta.cpf) lines.push(`- cpf: ${meta.cpf}`);
  if (meta.simulation) {
    lines.push(`- simulacao: ${JSON.stringify(meta.simulation)}`);
  }
  if (meta.signatureUrl) lines.push(`- link assinatura: ${meta.signatureUrl}`);
  return lines.join("\n");
}

/**
 * Roda um turno completo: usa o historico + tool calls em loop ate
 * o modelo retornar texto puro. Retorna a resposta final pra enviar
 * pro cliente. Persiste msg do assistente em v2_messages.
 */
export async function runTurn(conversation: Conversation): Promise<{
  reply: string | null;
  toolsRun: string[];
}> {
  const systemPrompt = await getSetting("system_prompt", DEFAULT_SYSTEM_PROMPT);
  const ctxPrefix = buildContextPrefix(conversation);
  const history = await buildHistory(conversation.id);
  const toolsRun: string[] = [];

  const contents: Content[] = [...history];

  for (let iter = 0; iter < MAX_TOOL_ITER; iter++) {
    const res = await client().models.generateContent({
      model: env.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: `${systemPrompt}\n\n---\n${ctxPrefix}`,
        temperature: 0.6,
        tools: [
          {
            functionDeclarations: getDeclarations() as unknown as FunctionDeclaration[],
          },
        ],
      },
    });

    const calls: FunctionCall[] = res.functionCalls ?? [];
    if (calls.length === 0) {
      const text = (res.text ?? "").trim();
      if (!text) return { reply: null, toolsRun };

      // persiste e retorna
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: text,
          metadata: {
            model: env.GEMINI_MODEL,
            toolsRun,
          } as Prisma.InputJsonValue,
        },
      });
      return { reply: text, toolsRun };
    }

    // adiciona o turno do modelo (com functionCalls) ao contents
    contents.push({
      role: "model",
      parts: calls.map((c) => ({
        functionCall: { name: c.name, args: c.args ?? {} },
      })),
    });

    // executa tools em sequencia e adiciona functionResponses
    const responses: Content[] = [];
    for (const c of calls) {
      const name = c.name ?? "";
      const args = (c.args ?? {}) as Record<string, unknown>;
      toolsRun.push(name);
      const result = await runTool(name, args, { conversation });
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

  // safeguard — passou do limite de iteracoes
  return { reply: null, toolsRun };
}
