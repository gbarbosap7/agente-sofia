import { NextRequest, NextResponse } from "next/server";
import { normalizeEvoPayload } from "@/channels/evolution/normalize";
import { sendEvoMessage } from "@/lib/evolution";
import { ensureConversation, dedupAndPersistInbound } from "@/lib/conversation";
import { withLock } from "@/lib/redis";
import { runTurn } from "@/lib/gemini";
import { loadAgent, getChannelConfig } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Evolution API inbound webhook por agente.
 *
 * URL: POST /api/webhooks/evolution/{agent_slug}
 *
 * Configurar no Evolution:
 *   instance.webhook.url = https://agente-sofia.sinext.xyz/api/webhooks/evolution/{slug}
 *   instance.webhook.events = ["MESSAGES_UPSERT"]
 *
 * Eventos sao filtrados — so MESSAGES_UPSERT (mensagem nova de cliente) gera turno.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let agent;
  try {
    agent = await loadAgent(slug);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "agent_error" },
      { status: 404 },
    );
  }
  if (agent.channel !== "evolution") {
    return NextResponse.json(
      { ok: false, error: `agent_${slug}_is_${agent.channel}_not_evolution` },
      { status: 400 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const event = (raw as { event?: string })?.event ?? "";
  if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
    // Ignora outros eventos (status update, etc) com 200 pra Evolution nao retentar
    return NextResponse.json({ ok: true, ignored: event });
  }

  let normalized;
  try {
    normalized = normalizeEvoPayload(raw);
  } catch (err) {
    console.warn(JSON.stringify({
      event: "evo.webhook.invalid_payload",
      agent: slug,
      error: err instanceof Error ? err.message : String(err),
    }));
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  if (!normalized) {
    // fromMe=true, mensagem vazia, mídia nao-texto, etc
    return NextResponse.json({ ok: true, ignored: "non_text_or_self" });
  }

  const cfg = getChannelConfig(agent);

  const result = await withLock(`agent:${agent.id}:phone:${normalized.phone}`, 60, async () => {
    const conversation = await ensureConversation(agent.id, normalized);

    if (!conversation.aiEnabled) {
      return { skipped: "ai_disabled", conversationId: conversation.id };
    }

    const { message, isDuplicate } = await dedupAndPersistInbound(normalized, conversation);

    console.log(JSON.stringify({
      event: "evo.webhook.received",
      agent: slug,
      phone: normalized.phone,
      conv_id: conversation.id,
      message_id: message.id,
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

      if (aiReply) {
        const sent = await sendEvoMessage({
          number: conversation.phone,
          text: aiReply,
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          instance: cfg.instance,
        });
        console.log(JSON.stringify({
          event: "evo.send",
          agent: slug,
          conv_id: conversation.id,
          ok: sent.ok,
          error: sent.ok ? undefined : sent.error,
          text_preview: aiReply.slice(0, 80),
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
    return NextResponse.json({ ok: true, deferred: true }, { status: 202 });
  }
  return NextResponse.json({ ok: true, agent: slug, ...result });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return NextResponse.json({
    ok: true,
    hint: `POST aqui o webhook do Evolution pra o agente '${slug}'`,
    expected_event: "messages.upsert",
  });
}
