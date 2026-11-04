# WhatsApp rollout

- Signed webhook GET verification and POST HMAC validation.
- Persist incoming verified payloads to `public.whatsapp_webhook_events` before acknowledging.
- Idempotency is based on raw request SHA-256.
- Event inbox is private (RLS enabled; no anon/authenticated grants).
- Incoming events are **not yet automatically answered or converted to orders**.
- Do not subscribe Meta to messages until an authenticated processing worker, retry policy, monitoring, and approved outbound sender credentials are in place.
- Keep production site working; test deployments before merging.
