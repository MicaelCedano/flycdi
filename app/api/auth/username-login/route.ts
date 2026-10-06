import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const invalidCredentials = () => NextResponse.json(
  { error: "Usuario o contraseña incorrectos." },
  { status: 401 },
);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!usernamePattern.test(username) || !password || password.length > 256) {
    return invalidCredentials();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return NextResponse.json({ error: "El acceso por usuario aún no está configurado." }, { status: 503 });
  }

  const admin = createAdminClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "No pudimos iniciar sesión. Intenta de nuevo." }, { status: 503 });
  }

  let email = `unknown-${crypto.randomUUID()}@invalid.example`;
  if (profile) {
    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error) {
      return NextResponse.json({ error: "No pudimos iniciar sesión. Intenta de nuevo." }, { status: 503 });
    }
    email = data.user.email ?? email;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!profile || error || !data.user) return invalidCredentials();

  return NextResponse.json({ ok: true });
}
