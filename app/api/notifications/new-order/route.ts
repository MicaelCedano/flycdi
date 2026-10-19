import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  total: number | string;
  created_at: string;
};

type ItemRow = {
  product_name: string;
  reference: string;
  quantity: number;
  unit_price: number | string;
};

const money = (value: number) => `RD$${new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { orderId?: unknown } | null;
  if (typeof body?.orderId !== "string" || !uuidPattern.test(body.orderId)) {
    return NextResponse.json({ error: "Pedido no válido." }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) {
    return NextResponse.json({ error: "Telegram no está configurado." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, total, created_at")
    .eq("id", body.orderId)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (orderError || !orderData) {
    return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  }
  const order = orderData as OrderRow;

  const [{ data: profileData }, { data: itemData, error: itemsError }] = await Promise.all([
    supabase.from("profiles").select("name, shop_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("order_items").select("product_name, reference, quantity, unit_price").eq("order_id", order.id),
  ]);
  if (itemsError || !itemData?.length) {
    return NextResponse.json({ error: "No pudimos leer los productos del pedido." }, { status: 503 });
  }

  const profile = profileData as { name: string; shop_name: string; phone: string } | null;
  const items = itemData as ItemRow[];
  const itemLines = items.map((item) =>
    `• ${item.quantity} × ${item.product_name}${item.reference ? ` (${item.reference})` : ""} — ${money(Number(item.unit_price) * item.quantity)}`,
  );
  const createdAt = new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  }).format(new Date(order.created_at));
  const message = [
    `🛍️ Nuevo pedido ${order.order_number}`,
    `Cliente: ${profile?.name || user.email || "Sin nombre"}`,
    profile?.shop_name ? `Taller: ${profile.shop_name}` : "",
    profile?.phone ? `Teléfono: ${profile.phone}` : "",
    `Fecha: ${createdAt}`,
    "",
    ...itemLines,
    "",
    `Total: ${money(Number(order.total))}`,
  ].filter(Boolean).join("\n");

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
    cache: "no-store",
  }).catch(() => null);
  if (!telegramResponse?.ok) {
    console.error("No se pudo enviar el aviso de pedido por Telegram.");
    return NextResponse.json({ error: "Telegram no pudo entregar el aviso." }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
