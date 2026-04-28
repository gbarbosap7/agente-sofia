/**
 * Tipos do payload do Evolution API (event MESSAGES_UPSERT).
 *
 * Doc: https://doc.evolution-api.com/v2/api-reference/events/messages-upsert
 *
 * Estrutura simplificada — campos relevantes pra normalizar pra InboundMessage.
 */

export interface EvolutionUpsertPayload {
  event: string;                       // "messages.upsert"
  instance: string;                    // nome da instancia
  data: {
    key: {
      remoteJid: string;               // 5511993909833@s.whatsapp.net
      fromMe?: boolean;
      id?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;           // texto simples
      extendedTextMessage?: { text: string };
      // mídia, sticker, etc — ignoramos por enquanto
    };
    messageType?: string;              // conversation | extendedTextMessage | imageMessage | audioMessage | ...
    messageTimestamp?: number;         // unix
  };
  date_time?: string;
}

export interface InboundEvolution {
  channel: "evolution";
  phone: string;
  externalConvId: string | null;       // Evolution nao tem conv_id, usa remoteJid
  contactName: string | null;
  leadId: string | null;
  text: string;
  providerMsgId: string;
  messageType: string;
  timestamp: string;
}
