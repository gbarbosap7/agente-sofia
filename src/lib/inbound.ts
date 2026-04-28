/**
 * Tipo unificado de mensagem inbound — aceita tanto DataCrazy quanto Evolution.
 *
 * Adicionar novos canais (Cloud API, Instagram, etc) só amplia o channel
 * literal — o resto do pipeline (conversation, gemini, tools) é agnóstico.
 */

export interface InboundMessage {
  channel: "datacrazy" | "evolution";
  phone: string;
  externalConvId: string | null;
  contactName: string | null;
  leadId: string | null;
  text: string;
  providerMsgId: string;
  messageType: string;
  timestamp: string;
  attachment?: { url: string; type?: string; mime?: string };
}
