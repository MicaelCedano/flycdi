import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_WORKER_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("whatsapp_webhook_events")
    .select("id,status,received_at").eq("status", "pending")
    .order("received_at", { ascending: true }).limit(10);
  if (error) return NextResponse.json({ error: "Inbox unavailable" }, { status: 503 });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const sendEnabled = process.env.WHATSAPP_SEND_ENABLED === "true";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (sendEnabled && (!accessToken || !phoneId)) return NextResponse.json({ error: "Meta not configured" }, { status: 503 });
  const results: Array<{ id: number; reply: string }> = [];
  for (const event of data ?? []) {
    const { data: full } = await db.from("whatsapp_webhook_events")
      .select("payload").eq("id", event.id).maybeSingle();
    const payload = full?.payload as {
      entry?: Array<{ changes?: Array<{ value?: {
        messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }>
      } }> }>
    } | undefined;
    const messages = (payload?.entry ?? []).flatMap(entry =>
      (entry.changes ?? []).flatMap(change => change.value?.messages ?? []));
    // Fail closed for batched messages until per-message delivery tracking is implemented.
    if (sendEnabled && messages.length > 1) {
      await db.from("whatsapp_webhook_events").update({
        status: "failed", last_error: "Multiple messages in one event require individual delivery tracking"
      }).eq("id", event.id).eq("status", "pending");
      continue;
    }
    if (sendEnabled && messages.length === 0) {
      await db.from("whatsapp_webhook_events").update({
        status: "processed", processed_at: new Date().toISOString()
      }).eq("id", event.id).eq("status", "pending");
      continue;
    }
    for (const message of messages) {
      const question = message.type === "text" ? message.text?.body?.trim() : "";
      if (!question) continue;
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          max_tokens: 180,
          messages: [
            { role: "system", content: "Eres el asistente de prueba de FLYCDI. Responde brevemente en español. No inventes precios, existencias ni pedidos. No reveles precios privados. Ofrece confirmación por un asesor humano." },
            { role: "user", content: question.slice(0, 1200) }
          ]
        }),
        cache: "no-store"
      });
      if (!response.ok) return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
      const answer = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const reply = answer.choices?.[0]?.message?.content?.slice(0, 1000) || "Un asesor de FLYCDI puede ayudarte.";
      if (sendEnabled && message.id && message.from && /^\\d{8,15}$/.test(message.from)) {
        const { data: claimed } = await db.from("whatsapp_webhook_events")
          .update({ status: "processing" }).eq("id", event.id).eq("status", "pending").select("id").maybeSingle();
        if (!claimed) continue;
        const sent = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneId!)}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: message.from, type: "text", text: { body: reply }, context: { message_id: message.id } }),
          cache: "no-store"
        });
        await db.from("whatsapp_webhook_events").update({
          status: sent.ok ? "processed" : "failed",
          processed_at: sent.ok ? new Date().toISOString() : null,
          last_error: sent.ok ? null : `Meta HTTP ${sent.status}`
        }).eq("id", event.id);
      }
      results.push({ id: event.id, reply: sendEnabled ? "[sent or attempted]" : reply });
    }
  }
  // Sending remains disabled unless WHATSAPP_SEND_ENABLED=true is explicitly configured.
  return NextResponse.json({ pending: data?.length ?? 0, dryRun: !sendEnabled, results });
}
