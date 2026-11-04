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
  return NextResponse.json({ pending: data?.length ?? 0 });
}
