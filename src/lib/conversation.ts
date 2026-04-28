import { Prisma, type Conversation, type Message } from "@prisma/client";
import { prisma } from "./prisma";
import type { InboundMessage } from "./inbound";

/**
 * Conversation Service (multi-agent).
 *
 * Unique key: (agentId, phone). Mesmo phone pode existir em agentes
 * diferentes — cada agente tem sua propria conversa.
 */

export async function ensureConversation(
  agentId: string,
  input: InboundMessage,
): Promise<Conversation> {
  try {
    return await prisma.conversation.create({
      data: {
        agentId,
        channel: input.channel,
        phone: input.phone,
        externalConvId: input.externalConvId,
        contactName: input.contactName,
        leadId: input.leadId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.conversation.findUnique({
        where: { agentId_phone: { agentId, phone: input.phone } },
      });
      if (!existing) throw err;
      if (existing.externalConvId !== input.externalConvId) {
        return await prisma.conversation.update({
          where: { id: existing.id },
          data: {
            externalConvId: input.externalConvId,
            contactName: input.contactName ?? existing.contactName,
            leadId: input.leadId ?? existing.leadId,
          },
        });
      }
      return existing;
    }
    throw err;
  }
}

export async function dedupAndPersistInbound(
  input: InboundMessage,
  conversation: Conversation,
): Promise<{ message: Message; isDuplicate: boolean }> {
  const existing = await prisma.message.findUnique({
    where: { providerMsgId: input.providerMsgId },
  });
  if (existing) return { message: existing, isDuplicate: true };

  try {
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: input.text,
        providerMsgId: input.providerMsgId,
        attachments: input.attachment ? [input.attachment] : undefined,
        metadata: { messageType: input.messageType, timestamp: input.timestamp },
      },
    });
    return { message, isDuplicate: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const dup = await prisma.message.findUnique({
        where: { providerMsgId: input.providerMsgId },
      });
      if (dup) return { message: dup, isDuplicate: true };
    }
    throw err;
  }
}

export async function recordAssistantMessage(
  conversationId: string,
  content: string,
  metadata?: Prisma.InputJsonValue,
): Promise<Message> {
  return prisma.message.create({
    data: {
      conversationId,
      role: "assistant",
      content,
      metadata: metadata ?? Prisma.JsonNull,
    },
  });
}

export async function getRecentMessages(conversationId: string, limit = 30) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function setAiEnabled(conversationId: string, enabled: boolean, reason?: string) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { aiEnabled: enabled, handoffReason: reason ?? null },
  });
}
