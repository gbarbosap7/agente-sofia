import { NextRequest, NextResponse } from "next/server";
import { normalizeDcPayload } from "@/channels/datacrazy";
import { dc } from "@/channels/datacrazy/client";
import { ensureConversation, dedupAndPersistInbound } from "@/lib/conversation";
import { withLock } from "@/lib/redis";
import { runTurn } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DataCrazy inbound webhook.
 *
 * Pipeline:
 *  1. Parse + validar payload (zod)
 *  2. Dedup por providerMsgId (Postgres unique)
 *  3. Lock distribuído por phone (5s) — evita races
 *  4. Persiste mensagem no v2_messages
 *  5. Enfileira processamento IA (BullMQ — sprint próximo)
 *  6. Retorna 200 imediato (DC não espera)
 *
 * NOTA: a IA ainda não responde — esse endpoint só PERSISTE o evento.
 * O pipeline Gemini + tools entra no próximo sprint.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  let normalized;
  try {
    normalized = normalizeDcPayload(raw);
  } catch (err) {
    console.warn(JSON.stringify({
      event: "dc.webhook.invalid_payload",
      error: err instanceof Error ? err.message : String(err),
      raw,
    }));
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // Lock por phone — evita 2 webhooks concorrentes processarem ao mesmo tempo
  const result = await withLock(`phone:${normalized.phone}`, 60, async () => {
    const conversation = await ensureConversation(normalized);

    if (!conversation.aiEnabled) {
      console.log(JSON.stringify({
        event: "dc.webhook.ai_disabled",
        phone: normalized.phone,
        conv_id: conversation.id,
      }));
      return { skipped: "ai_disabled", conversationId: conversation.id };
    }

    const { message, isDuplicate } = await dedupAndPersistInbound(normalized, conversation);

    console.log(JSON.stringify({
      event: "dc.webhook.received",
      phone: normalized.phone,
      conv_id: conversation.id,
      message_id: message.id,
      provider_msg_id: normalized.providerMsgId,
      is_duplicate: isDuplicate,
      text_preview: normalized.text.slice(0, 80),
    }));

    if (isDuplicate) return { duplicate: true, messageId: message.id };

    // pipeline IA — sincrono dentro do lock pra ordem de mensagens
    let aiReply: string | null = null;
    let aiError: string | null = null;
    let toolsRun: string[] = [];
    try {
      const turn = await runTurn(conversation);
      aiReply = turn.reply;
      toolsRun = turn.toolsRun;

      if (aiReply && conversation.externalConvId) {
        const sent = await dc.sendMessage({
          conversationId: conversation.externalConvId,
          text: aiReply,
        });
        console.log(JSON.stringify({
          event: "dc.send.ok",
          conv_id: conversation.id,
          dc_msg_id: sent.id,
          tools_run: toolsRun,
          text_preview: aiReply.slice(0, 80),
        }));
      } else if (aiReply && !conversation.externalConvId) {
        console.warn(JSON.stringify({
          event: "dc.send.skipped",
          reason: "no_external_conv_id",
          conv_id: conversation.id,
        }));
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({
        event: "ai.turn.error",
        conv_id: conversation.id,
        error: aiError,
      }));
    }

    return {
      messageId: message.id,
      conversationId: conversation.id,
      aiReply: aiReply ? aiReply.slice(0, 200) : null,
      toolsRun,
      aiError,
    };
  });

  if (result === null) {
    return NextResponse.json(
      { ok: true, deferred: true, hint: "lock contention — outro webhook do mesmo phone em andamento" },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST aqui com o webhook do DataCrazy. Schema esperado em src/channels/datacrazy/types.ts",
    sample_body: {
      conv_id: "abc123",
      phone: "5511993909833",
      lead_id: "lead-001",
      contact_name: "João Silva",
      message_text: "oi tudo bem",
      message_id: "dc-msg-uuid",
      message_type: "text",
      timestamp: "2026-04-28T08:00:00Z",
    },
  });
}
