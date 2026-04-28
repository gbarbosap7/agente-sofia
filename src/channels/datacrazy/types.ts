/**
 * DataCrazy types — payloads de webhook (inbound) e responses (outbound).
 *
 * Schema deduzido de:
 *  - Sofia v1 (n8n workflow 7XYrgw0rUk5FdLhP)
 *  - Conexão Universal docs (help.datacrazy.io)
 *  - Nó "Requisição HTTP via JSON" do flow do CRM
 *
 * Webhook do flow envia um JSON customizável. Convencionamos o seguinte
 * shape mínimo (configurável no nó HTTP do flow):
 *
 * {
 *   "conv_id": "${conversation.id}",
 *   "phone": "${lead.phone}",
 *   "lead_id": "${lead.id}",
 *   "contact_name": "${lead.name}",
 *   "message_text": "${input.text}",
 *   "message_id": "${input.id}",
 *   "message_type": "text" | "audio" | "image",
 *   "attachment_url": "${input.media_url}",
 *   "timestamp": "${system.now}"
 * }
 */

export interface DcWebhookPayload {
  conv_id: string;
  phone: string;
  lead_id?: string;
  contact_name?: string;
  message_text?: string;
  message_id?: string;
  message_type?: "text" | "audio" | "image" | "document" | string;
  attachment_url?: string;
  attachment_type?: string;
  timestamp?: string;
  [k: string]: unknown;
}

/** Forma normalizada que o pipeline interno consome. */
export interface InboundMessage {
  channel: "datacrazy";
  externalConvId: string;
  phone: string;
  leadId?: string;
  contactName?: string;
  text: string;
  providerMsgId: string;
  messageType: "text" | "audio" | "image" | "document";
  attachment?: {
    url: string;
    type: string;
  };
  timestamp: Date;
  raw: DcWebhookPayload;
}

/** Resposta do POST /conversations/{id}/messages */
export interface DcSendResponse {
  id?: string;
  message_id?: string;
  status?: "sent" | "queued" | "failed";
  error?: string;
}

/** Resposta do GET /conversations/{id} */
export interface DcConversation {
  _id: string;
  phone?: string;
  contact_id?: string;
  contact?: {
    name?: string;
    phone?: string;
  };
  current_department_id?: string;
  current_agent_id?: string;
  finished?: boolean;
  initialized?: boolean;
  [k: string]: unknown;
}
