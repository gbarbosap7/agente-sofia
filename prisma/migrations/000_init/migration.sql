-- agente-sofia v2 — initial migration
-- Apply via Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/jdywpxuimcjattyqexdc/sql/new

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- v2_conversations
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.v2_conversations (
  id              text PRIMARY KEY,
  channel         text NOT NULL,
  external_conv_id text,
  phone           text NOT NULL UNIQUE,
  contact_name    text,
  lead_id         text,
  state           text NOT NULL DEFAULT 'active',
  ai_enabled      boolean NOT NULL DEFAULT true,
  handoff_reason  text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_conversations_phone_idx ON public.v2_conversations(phone);
CREATE INDEX IF NOT EXISTS v2_conversations_external_idx ON public.v2_conversations(external_conv_id);

-- =====================================================================
-- v2_messages
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.v2_messages (
  id              text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES public.v2_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL,
  content         text NOT NULL,
  provider_msg_id text UNIQUE,
  attachments     jsonb,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v2_messages_conv_created_idx
  ON public.v2_messages(conversation_id, created_at);

-- =====================================================================
-- v2_tool_calls
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.v2_tool_calls (
  id              text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES public.v2_conversations(id) ON DELETE CASCADE,
  tool_name       text NOT NULL,
  input           jsonb NOT NULL,
  output          jsonb,
  status          text NOT NULL,
  error           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE INDEX IF NOT EXISTS v2_tool_calls_conv_idx ON public.v2_tool_calls(conversation_id);
CREATE INDEX IF NOT EXISTS v2_tool_calls_status_idx ON public.v2_tool_calls(status);

-- =====================================================================
-- v2_kb_documents + v2_kb_chunks (RAG pgvector)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.v2_kb_documents (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  source      text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.v2_kb_chunks (
  id          text PRIMARY KEY,
  document_id text NOT NULL REFERENCES public.v2_kb_documents(id) ON DELETE CASCADE,
  content     text NOT NULL,
  embedding   vector(768),
  ord         integer NOT NULL,
  metadata    jsonb
);

CREATE INDEX IF NOT EXISTS v2_kb_chunks_doc_idx ON public.v2_kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS v2_kb_chunks_embedding_idx
  ON public.v2_kb_chunks USING hnsw (embedding vector_cosine_ops);

-- =====================================================================
-- v2_human_feedback (RLHF caseiro)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.v2_human_feedback (
  id          text PRIMARY KEY,
  message_id  text,
  rating      integer NOT NULL,
  reviewer    text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- updated_at trigger (touch on UPDATE)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_touch_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS v2_conversations_touch ON public.v2_conversations;
CREATE TRIGGER v2_conversations_touch
  BEFORE UPDATE ON public.v2_conversations
  FOR EACH ROW EXECUTE FUNCTION public.v2_touch_updated_at();

-- =====================================================================
-- RLS — disabled por enquanto (acesso só via API server-side com service role)
-- =====================================================================
ALTER TABLE public.v2_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_tool_calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_kb_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_kb_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_human_feedback DISABLE ROW LEVEL SECURITY;
