# Busy Business — AI Triage Dashboard

> **5 concurrent requests. 2 staff. 3 slots. 1 AI.**
> Real-time priority triage engine powered by DeepSeek v4-flash.

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:3000
```

## How It Works

```
Customer Requests ──► AI Triage Engine ──► Priority Queue + Decisions
                          │
                    ┌─────┴─────┐
                    ▼           ▼
              DeepSeek v4    Rules Engine
              (dynamic)     (deterministic fallback)
```

Every click of **Re-run Triage** generates 5 fresh, AI-created support scenarios and makes real triage decisions with unique confidence scores, reasoning, and responses.

## Docs

- **[PROMPTS.md](./PROMPTS.md)** — All AI prompts used in the system
- Edge Function: `supabase/functions/triage/index.ts`
- SQL Schema: `supabase/migrations/001_initial_schema.sql`

## Built With

- Next.js 14 + React + Tailwind CSS
- Supabase (PostgreSQL + Edge Functions)
- DeepSeek v4-flash (OpenAI-compatible API)
- Resend (email notifications)
