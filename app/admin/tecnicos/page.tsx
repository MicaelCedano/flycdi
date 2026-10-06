"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocalAccount } from "@/components/account/useLocalAccount";

type PendingProfile = {
  id: string;
  username: string;
  name: string;
  shop_name: string;
  phone: string;
  created_at: string;
};

export default function PendingTechniciansPage() {
  const { account, ready } = useLocalAccount();
  const [supabase] = useState(() => createClient());
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id, username, name, shop_name, phone, created_at")
      .eq("role", "technician")
      .eq("approved", false)
      .order("created_at", { ascending: true });
    if (queryError) setError("No pudimos cargar las solicitudes pendientes.");
    else setPending((data ?? []) as PendingProfile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (ready && account?.role === "admin") void loadPending();
  }, [account?.role, loadPending, ready]);

  async function approve(profile: PendingProfile) {
    setBusyId(profile.id);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ approved: true })
      .eq("id", profile.id);
    if (updateError) {
      setError("No pudimos habilitar esta cuenta. Inténtalo de nuevo.");
    } else {
      setPending((rows) => rows.filter((row) => row.id !== profile.id));
      setNotice(`La cuenta de ${profile.name} quedó habilitada. Ya puede iniciar sesión.`);
    }
    setBusyId(null);
  }

  if (!ready) return <main className="admin-shell"><div className="catalog-loading" aria-label="Comprobando acceso" /></main>;
  if (!account || account.role !== "admin") return <main className="admin-shell admin-locked"><div className="catalog-lock-icon" /><p>ACCESO RESTRINGIDO</p><h1>Inicia sesión como administrador</h1><Link href="/">Ir a la tienda</Link></main>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p>FLYCDI / ADMINISTRACIÓN</p><h1>Solicitudes de técnicos</h1><span className="admin-subtitle">Revisa los datos y habilita manualmente las cuentas verificadas.</span></div>
        <div className="admin-header-actions"><Link href="/admin">Volver al catálogo</Link><Link href="/">Ver tienda</Link></div>
      </header>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
      {loading ? <div className="catalog-loading" aria-label="Cargando solicitudes" /> : pending.length ? (
        <section className="pending-technicians" aria-label="Solicitudes pendientes">
          {pending.map((profile) => <article className="pending-technician" key={profile.id}>
            <div><span>@{profile.username}</span><h2>{profile.name}</h2><p>{profile.shop_name || "Taller sin nombre"}</p><p>{profile.phone || "Sin WhatsApp"}</p><small>Solicitud: {new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.created_at))}</small></div>
            <button className="primary" disabled={busyId === profile.id} onClick={() => void approve(profile)}>{busyId === profile.id ? "Guardando…" : "Habilitar cuenta"}</button>
          </article>)}
        </section>
      ) : <section className="pending-empty"><h2>No hay solicitudes pendientes</h2><p>Las nuevas cuentas aparecerán aquí para revisión.</p></section>}
    </main>
  );
}
