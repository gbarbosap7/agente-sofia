import { NextRequest, NextResponse } from "next/server";
import { normalizeDcPayload } from "@/channels/datacrazy";
import { dc } from "@/channels/datacrazy/client";
import { ensureConversation, dedupAndPersistInbound } from "@/lib/conversation";
import { withLock } from "@/lib/redis";
import { runTurn } from "@/lib/gemini";
import { loadAgent } from "@/lib/agent";
import { transcribeAudio } from "@/lib/transcribe";
import { verifyWebhookBearer } from "@/lib/webhook-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DataCrazy inbound webhook por agente.
 *
 * URL: POST /api/webhooks/datacrazy/{agent_slug}
 *
 * Pipeline:
 *  1. Carrega agente pelo slug (404 se nao existir / 423 se desabilitado)
 *  2. Valida payload + dedup
 *  3. Lock por (agent, phone)
 *  4. Persist + runTurn(agent, conversation)
 *  5. Send via dc.sendMessage (canal datacrazy)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  // Auth — Bearer token (DC_WEBHOOK_SECRET). Passa se secret não configurado (dev).
  if (!verifyWebhookBearer(req, env.DC_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let agent;
  try {
    agent = await loadAgent(slug);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "agent_error" },
      { status: 404 },
    );
  }
  if (agent.channel !== "datacrazy") {
    return NextResponse.json(
      { ok: false, error: `agent_${slug}_is_${agent.channel}_not_datacrazy` },
      { status: 400 },
    );
  }

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
      agent: slug,
      error: err instanceof Error ? err.message : String(err),
      raw,
    }));
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // Rate limit por phone (30 req/min)
  const rl = await checkRateLimit(normalized.phone);
  if (!rl.allowed) {
    console.warn(JSON.stringify({
      event: "dc.webhook.rate_limited",
      agent: slug,
      phone: normalized.phone,
    }));
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  // Transcrição de áudio (Gemini) — roda fora do lock pra nao segurar a fila.
  let transcript: { text: string; durationMs: number; inaudible: boolean } | null = null;
  if (normalized.messageType === "audio" && normalized.attachment?.url) {
    try {
      transcript = await transcribeAudio(normalized.attachment.url, normalized.attachment.mime);
      console.log(JSON.stringify({
        event: "dc.transcribe.ok",
        agent: slug,
        phone: normalized.phone,
        duration_ms: transcript.durationMs,
        inaudible: transcript.inaudible,
        preview: transcript.text.slice(0, 80),
      }));
      if (!transcript.inaudible) normalized.text = transcript.text;
    } catch (err) {
      console.error(JSON.stringify({
        event: "dc.transcribe.error",
        agent: slug,
        phone: normalized.phone,
        url: normalized.attachment.url,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  const result = await withLock(`agent:${agent.id}:phone:${normalized.phone}`, 60, async () => {
    const conversation = await ensureConversation(agent.id, normalized);

    if (!conversation.aiEnabled) {
      console.log(JSON.stringify({
        event: "dc.webhook.ai_disabled",
        agent: slug,
        phone: normalized.phone,
        conv_id: conversation.id,
      }));
      return { skipped: "ai_disabled", conversationId: conversation.id };
    }

    const { message, isDuplicate } = await dedupAndPersistInbound(normalized, conversation);

    console.log(JSON.stringify({
      event: "dc.webhook.received",
      agent: slug,
      phone: normalized.phone,
      conv_id: conversation.id,
      message_id: message.id,
      provider_msg_id: normalized.providerMsgId,
      is_duplicate: isDuplicate,
      text_preview: normalized.text.slice(0, 80),
    }));

    if (isDuplicate) return { duplicate: true, messageId: message.id };

    let aiReply: string | null = null;
    let aiError: string | null = null;
    let toolsRun: string[] = [];
    try {
      const turn = await runTurn(agent, conversation);
      aiReply = turn.reply;
      toolsRun = turn.toolsRun;

      if (aiReply && conversation.externalConvId) {
        const sent = await dc.sendMessage({
          conversationId: conversation.externalConvId,
          text: aiReply,
        });
        console.log(JSON.stringify({
          event: "dc.send.ok",
          agent: slug,
          conv_id: conversation.id,
          dc_msg_id: sent.id,
          tools_run: toolsRun,
          text_preview: aiReply.slice(0, 80),
        }));
      } else if (aiReply && !conversation.externalConvId) {
        console.warn(JSON.stringify({
          event: "dc.send.skipped",
          reason: "no_external_conv_id",
          agent: slug,
          conv_id: conversation.id,
        }));
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({
        event: "ai.turn.error",
        agent: slug,
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
      { ok: true, deferred: true, hint: "lock contention" },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok: true, agent: slug, ...result });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return NextResponse.json({
    ok: true,
    hint: `POST aqui o webhook do DataCrazy pra o agente '${slug}'`,
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
