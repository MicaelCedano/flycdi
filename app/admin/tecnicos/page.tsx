"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocalAccount } from "@/components/account/useLocalAccount";

type TechnicianProfile = {
  id: string;
  username: string;
  name: string;
  shop_name: string;
  phone: string;
  created_at: string;
  approved: boolean;
};

type TechnicianView = "no-access" | "active";

export default function RegisteredTechniciansPage() {
  const { account, ready } = useLocalAccount();
  const [supabase] = useState(() => createClient());
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [view, setView] = useState<TechnicianView>("no-access");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTechnicians = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id, username, name, shop_name, phone, created_at, approved")
      .eq("role", "technician")
      .order("created_at", { ascending: false });
    if (queryError) setError("No pudimos cargar la lista de técnicos.");
    else setTechnicians((data ?? []) as TechnicianProfile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (ready && account?.role === "admin") void loadTechnicians();
  }, [account?.role, loadTechnicians, ready]);

  const counts = useMemo(() => technicians.reduce((result, technician) => {
    if (technician.approved) result.active += 1;
    else result.noAccess += 1;
    return result;
  }, { noAccess: 0, active: 0 }), [technicians]);

  const visibleTechnicians = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return technicians.filter((technician) => {
      const matchesView = view === "active" ? technician.approved : !technician.approved;
      const matchesSearch = !query || `${technician.name} ${technician.username} ${technician.shop_name} ${technician.phone}`
        .toLocaleLowerCase("es")
        .includes(query);
      return matchesView && matchesSearch;
    });
  }, [search, technicians, view]);

  async function setApproval(profile: TechnicianProfile, approved: boolean) {
    setBusyId(profile.id);
    setError("");
    setNotice("");
    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ approved })
        .eq("id", profile.id)
        .eq("approved", profile.approved)
        .select("id")
        .maybeSingle();
      if (updateError || !data) {
        setError(`No pudimos ${approved ? "habilitar" : "suspender"} esta cuenta. Actualiza la lista e inténtalo de nuevo.`);
        return;
      }
      setTechnicians((rows) => rows.map((row) => row.id === profile.id ? { ...row, approved } : row));
      setNotice(approved
        ? `La cuenta de ${profile.name} quedó habilitada.`
        : `Se suspendió el acceso de ${profile.name}. Su cuenta y sus pedidos se conservaron.`);
    } catch {
      setError(`No pudimos ${approved ? "habilitar" : "suspender"} esta cuenta. Inténtalo de nuevo.`);
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <main className="admin-shell"><div className="catalog-loading" aria-label="Comprobando acceso" /></main>;
  if (!account || account.role !== "admin") return <main className="admin-shell admin-locked"><div className="catalog-lock-icon" /><p>ACCESO RESTRINGIDO</p><h1>Inicia sesión como administrador</h1><Link href="/">Ir a la tienda</Link></main>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p>FLYCDI / ADMINISTRACIÓN</p><h1>Técnicos registrados</h1><span className="admin-subtitle">Revisa solicitudes, administra accesos y conserva el historial de cada cuenta.</span></div>
        <div className="admin-header-actions"><Link href="/admin">Volver al catálogo</Link><Link href="/">Ver tienda</Link></div>
      </header>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
      <section className="technician-manager" aria-label="Administrar técnicos">
        <div className="technician-manager-toolbar">
          <div className="technician-tabs" role="tablist" aria-label="Estado de los técnicos">
            {([
              ["no-access", "Sin acceso", counts.noAccess],
              ["active", "Habilitados", counts.active],
            ] as const).map(([tab, label, count]) => <button key={tab} type="button" role="tab" aria-selected={view === tab} className={view === tab ? "active" : ""} onClick={() => setView(tab)}>{label}<span>{count}</span></button>)}
          </div>
          <label className="technician-search"><input aria-label="Buscar técnicos" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, taller o WhatsApp" /></label>
        </div>
        {loading ? <div className="catalog-loading" aria-label="Cargando técnicos" /> : visibleTechnicians.length ? (
          <div className="pending-technicians" role="tabpanel">
            {visibleTechnicians.map((profile) => <article className="pending-technician" key={profile.id}>
              <div><span>@{profile.username}</span><h2>{profile.name}</h2><p>{profile.shop_name || "Taller sin nombre"}</p><p>{profile.phone || "Sin WhatsApp"}</p><small>Registro: {new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.created_at))}</small></div>
              <button className={profile.approved ? "technician-disable" : "primary"} disabled={busyId === profile.id} onClick={() => void setApproval(profile, !profile.approved)}>{busyId === profile.id ? "Guardando…" : profile.approved ? "Suspender acceso" : "Habilitar cuenta"}</button>
            </article>)}
          </div>
        ) : <section className="pending-empty"><h2>{search ? "No hay coincidencias" : view === "no-access" ? "No hay técnicos sin acceso" : "No hay técnicos habilitados"}</h2><p>{search ? "Prueba con otro nombre, taller o WhatsApp." : view === "no-access" ? "Las cuentas nuevas o suspendidas aparecerán aquí." : "Los técnicos habilitados aparecerán aquí."}</p></section>}
      </section>
    </main>
  );
}
