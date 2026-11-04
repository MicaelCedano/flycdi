-- Durable inbox for verified WhatsApp webhook deliveries.
create table if not exists public.whatsapp_webhook_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','processed','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);
create index if not exists whatsapp_webhook_events_pending_idx
  on public.whatsapp_webhook_events (received_at) where status = 'pending';
alter table public.whatsapp_webhook_events enable row level security;
revoke all on public.whatsapp_webhook_events from anon, authenticated;
-- Only the server-side Supabase secret/service role may access this inbox.
