import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return new NextResponse("Webhook not configured", { status: 503, headers: noStore });
  }

  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = Buffer.from(verifyToken, "utf8");
  const provided = Buffer.from(token ?? "", "utf8");

  if (
    mode !== "subscribe" ||
    challenge === null ||
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return new NextResponse("Forbidden", { status: 403, headers: noStore });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return new NextResponse("Webhook not configured", { status: 503, headers: noStore });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    return new NextResponse("Unauthorized", { status: 401, headers: noStore });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const digest = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`, "utf8");
  const provided = Buffer.from(signature.toLowerCase(), "utf8");

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return new NextResponse("Unauthorized", { status: 401, headers: noStore });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return new NextResponse("Invalid JSON", { status: 400, headers: noStore });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("object" in payload) ||
    payload.object !== "whatsapp_business_account"
  ) {
    return new NextResponse("Unsupported event", { status: 400, headers: noStore });
  }

  // Transport verification only. Do not acknowledge messages as processed
  // until durable storage, idempotency, and asynchronous handling are implemented.
  return new NextResponse("Message processing not enabled", { status: 503, headers: noStore });
}
