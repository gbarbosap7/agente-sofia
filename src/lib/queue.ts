import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { prisma } from "./prisma";
import { joinbank } from "./joinbank";
import { dc } from "@/channels/datacrazy/client";
import { runTurn } from "./gemini";
import { alertOwner } from "./evolution";
import { Prisma } from "@prisma/client";

/**
 * Filas BullMQ pra trabalho assincrono que nao bloqueia o webhook DC.
 *
 * Filas:
 *  - signature-poll: verifica status de assinatura JoinBank a cada 60s,
 *    ate signed=true ou expira (24h).
 *  - delayed-reply: dispara um turno extra do Gemini depois que uma tool
 *    async terminou (ex: assinatura confirmada → Sofia manda parabens).
 *
 * Conexao Redis = a mesma do REDIS_URL.
 */

let _conn: IORedis | null = null;
function conn(): IORedis {
  if (_conn) return _conn;
  _conn = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return _conn;
}

// =====================================================================
// SignaturePoll — polla JoinBank periodicamente
// =====================================================================
export interface SignaturePollData {
  conversationId: string;
  contractId: string;
  attempt?: number;
}

export const signaturePollQueue = new Queue<SignaturePollData>("signature-poll", {
  connection: conn(),
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
  },
});

export async function enqueueSignaturePoll(data: SignaturePollData, delayMs = 60_000) {
  return signaturePollQueue.add("poll", data, { delay: delayMs });
}

// =====================================================================
// DelayedReply — gera turno extra Gemini fora do contexto webhook
// =====================================================================
export interface DelayedReplyData {
  conversationId: string;
  systemNote: string; // contexto extra que vai como mensagem "user" sintetica
}

export const delayedReplyQueue = new Queue<DelayedReplyData>("delayed-reply", {
  connection: conn(),
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
    attempts: 2,
  },
});

export async function enqueueDelayedReply(data: DelayedReplyData) {
  return delayedReplyQueue.add("reply", data);
}

// =====================================================================
// Workers — startWorkers() chamado uma vez no boot (instrumentation.ts)
// =====================================================================
let _workersStarted = false;

export function startWorkers() {
  if (_workersStarted) return;
  _workersStarted = true;
  console.log(JSON.stringify({ event: "workers.start" }));

  new Worker<SignaturePollData>(
    "signature-poll",
    async (job: Job<SignaturePollData>) => {
      const { conversationId, contractId, attempt = 0 } = job.data;

      // safety: max ~24h (1440 min / 1 min entre polls = 1440)
      if (attempt > 1440) {
        await alertOwner(`assinatura nao confirmada em 24h: ${contractId}`);
        return;
      }

      const status = await joinbank.getSignatureStatus(contractId);
      console.log(JSON.stringify({
        event: "signature.poll",
        conv_id: conversationId,
        contract_id: contractId,
        attempt,
        signed: status.signed,
        status: status.status,
      }));

      if (status.signed) {
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv) return;
        const meta = (conv.metadata as Record<string, unknown> | null) ?? {};
        meta.signed = true;
        meta.signedAt = status.signedAt;
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { metadata: meta as Prisma.InputJsonValue },
        });

        // alerta dono (conversao!)
        await alertOwner(
          `🟢 conversao: ${conv.contactName ?? conv.phone} assinou contrato ${contractId}`,
        );

        // turno extra do Gemini pra mandar parabens
        await enqueueDelayedReply({
          conversationId: conv.id,
          systemNote: `Cliente acabou de assinar o contrato ${contractId}. Mande uma mensagem curta confirmando o envio do dinheiro pelo PIX.`,
        });
        return;
      }

      // ainda nao assinou → re-enfileira
      await enqueueSignaturePoll({ ...job.data, attempt: attempt + 1 }, 60_000);
    },
    { connection: conn(), concurrency: 3 },
  ).on("failed", (job, err) => {
    console.error(JSON.stringify({
      event: "signature.poll.failed",
      job_id: job?.id,
      error: err.message,
    }));
  });

  new Worker<DelayedReplyData>(
    "delayed-reply",
    async (job: Job<DelayedReplyData>) => {
      const { conversationId, systemNote } = job.data;
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conv) return;
      if (!conv.aiEnabled) {
        console.log(JSON.stringify({
          event: "delayed.skip",
          reason: "ai_disabled",
          conv_id: conv.id,
        }));
        return;
      }

      // injeta nota como mensagem "system" sintetica via metadata extra do turno
      // (mantemos persistencia atraves de uma message role=system pra rastreabilidade)
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          role: "system",
          content: systemNote,
          metadata: { source: "delayed-reply" } as Prisma.InputJsonValue,
        },
      });

      const turn = await runTurn(conv);
      if (turn.reply && conv.externalConvId) {
        try {
          await dc.sendMessage({ conversationId: conv.externalConvId, text: turn.reply });
        } catch (err) {
          console.error(JSON.stringify({
            event: "delayed.send.error",
            conv_id: conv.id,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      }
    },
    { connection: conn(), concurrency: 5 },
  ).on("failed", (job, err) => {
    console.error(JSON.stringify({
      event: "delayed.reply.failed",
      job_id: job?.id,
      error: err.message,
    }));
  });
}
