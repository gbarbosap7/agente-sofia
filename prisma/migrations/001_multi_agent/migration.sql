-- agente-sofia v2 — multi-agent migration
-- 1. v2_agents (Sofia, Brian, Ana, etc.)
-- 2. agent_id em conversations + kb_documents
-- 3. unique constraint (agent_id, phone) substitui (phone)

CREATE TABLE IF NOT EXISTS public.v2_agents (
  id              text PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  channel         text NOT NULL,                 -- datacrazy | evolution
  channel_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_prompt   text NOT NULL,
  enabled_tools   text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled         boolean NOT NULL DEFAULT true,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_agents_channel_idx ON public.v2_agents(channel);

DROP TRIGGER IF EXISTS v2_agents_touch ON public.v2_agents;
CREATE TRIGGER v2_agents_touch
  BEFORE UPDATE ON public.v2_agents
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();

-- =====================================================================
-- Seed: agente sofia (CLT, DataCrazy)
-- =====================================================================
INSERT INTO public.v2_agents (id, slug, name, channel, channel_config, system_prompt, enabled_tools)
VALUES (
  'agt_sofia',
  'sofia',
  'Sofia',
  'datacrazy',
  '{}'::jsonb,
  'Voce eh a Sofia, SDR consignado CLT da Adapta. Conversa por WhatsApp via DataCrazy. Tom humano direto PT-BR. Maximo 2 linhas por mensagem.',
  ARRAY['extract_cpf','consult_joinbank','send_signature_link','transfer_human','finish_conversation','alert_owner','rag_search']
)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- Backfill conversations existentes pra agent sofia
-- =====================================================================
ALTER TABLE public.v2_conversations
  ADD COLUMN IF NOT EXISTS agent_id text REFERENCES public.v2_agents(id) ON DELETE CASCADE;

UPDATE public.v2_conversations
   SET agent_id = 'agt_sofia'
 WHERE agent_id IS NULL;

ALTER TABLE public.v2_conversations
  ALTER COLUMN agent_id SET NOT NULL;

-- Substitui unique(phone) por unique(agent_id, phone) — phone sozinho era restritivo demais
ALTER TABLE public.v2_conversations
  DROP CONSTRAINT IF EXISTS v2_conversations_phone_key;

ALTER TABLE public.v2_conversations
  ADD CONSTRAINT v2_conversations_agent_phone_key UNIQUE (agent_id, phone);

CREATE INDEX IF NOT EXISTS v2_conversations_agent_idx ON public.v2_conversations(agent_id);

-- =====================================================================
-- KB documents — agent_id (null = shared)
-- =====================================================================
ALTER TABLE public.v2_kb_documents
  ADD COLUMN IF NOT EXISTS agent_id text REFERENCES public.v2_agents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS v2_kb_documents_agent_idx ON public.v2_kb_documents(agent_id);

-- =====================================================================
-- Seed: brian (Evolution) + ana (DataCrazy)
-- =====================================================================
INSERT INTO public.v2_agents (id, slug, name, channel, channel_config, system_prompt, enabled_tools)
VALUES (
  'agt_brian',
  'brian',
  'Brian',
  'evolution',
  '{"instance": "nayana", "apiKey": "nayana2025apikey", "baseUrl": "http://evolution-api:8080"}'::jsonb,
  'Voce eh o Brian, agente IA portabilidade INSS aposentado da Adapta. Conversa via WhatsApp Evolution. PT-BR humano, max 2 linhas.',
  ARRAY['extract_cpf','transfer_human','finish_conversation','alert_owner','rag_search']
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.v2_agents (id, slug, name, channel, channel_config, system_prompt, enabled_tools)
VALUES (
  'agt_ana',
  'ana',
  'Ana',
  'datacrazy',
  '{}'::jsonb,
  'Voce eh a Ana, agente de portabilidade da Adapta. PT-BR humano direto.',
  ARRAY['extract_cpf','transfer_human','finish_conversation','alert_owner','rag_search']
)
ON CONFLICT (slug) DO NOTHING;
