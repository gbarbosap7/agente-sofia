# agente-sofia

> SDR consignado CLT · Sofia v2 · Gemini 3.0 + DataCrazy + RAG

Reescrita event-driven da Sofia v1 (que vivia em n8n com 93k chars de jsCode).
Stack: Next.js 16 · TypeScript · Tailwind v4 · Prisma · pgvector · BullMQ + Redis · Gemini Flash.

## Status

Bootstrap em andamento.

## Endpoints

- `GET  /api/health` — healthcheck
- `POST /api/webhooks/datacrazy` — inbound DataCrazy

## Deploy

Easypanel @ `agente-sofia.sinext.xyz` (VPS Hostinger 187.77.237.198).

## Dev

```bash
pnpm install
cp .env.example .env.local  # preencher
pnpm dev
```
