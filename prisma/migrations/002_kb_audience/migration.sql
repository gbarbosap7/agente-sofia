-- Migration 002: adiciona coluna audience em v2_kb_documents
-- Corrige drift entre schema.prisma (audience String @default("client"))
-- e o SQL inicial (000_init) que nao tinha essa coluna.

ALTER TABLE public.v2_kb_documents
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'client';

-- Backfill: documentos existentes sem agentId ficam como audience=client (default)
-- Nao ha dados de producao afetados neste ponto.
