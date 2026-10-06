"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LayoutDashboard, LogOut, PackageCheck, ShieldCheck, UserRound, X } from "lucide-react";
import { money } from "@/lib/catalog";
import type { AccountProfile, TechnicianOrder } from "@/lib/account";

type RegisterInput = { name: string; username: string; shopName: string; phone: string; email: string; password: string };
const roleLabels = { admin: "Administrador", seller: "Vendedor", technician: "Cliente técnico" } as const;

export function AccountDrawer({ open, account, orders, onClose, onRegister, onLogin, onLogout }: {
  open: boolean;
  account: AccountProfile | null;
  orders: TechnicianOrder[];
  onClose: () => void;
  onRegister: (input: RegisterInput) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      if (mode === "register") {
        await onRegister({ name: String(data.get("name")), username: String(data.get("username")), shopName: String(data.get("shopName")), phone: String(data.get("phone")), email: String(data.get("email")), password: String(data.get("password")) });
        setNotice("Recibimos tu solicitud. El equipo revisará tus datos y habilitará tu cuenta personalmente.");
        form.reset();
      } else {
        await onLogin(String(data.get("username")), String(data.get("password")));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos completar el acceso.");
    } finally { setBusy(false); }
  }

  return <aside className={`account-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
    <div className="drawer-head"><div><small>{account ? roleLabels[account.role].toUpperCase() : "ÁREA DE TÉCNICOS"}</small><h2>{account ? `Hola, ${account.name.split(" ")[0]}` : "Tu cuenta mayorista"}</h2></div><button aria-label="Cerrar cuenta" onClick={onClose}><X /></button></div>
    {account ? <div className="account-content">
      <section className="profile-card"><div className="profile-icon"><UserRound /></div><div><strong>{account.name}</strong><span>@{account.username} · {account.shopName}</span><small>{account.email} · {account.phone}</small><em>{roleLabels[account.role]}</em></div></section>
      {account.role === "seller" ? <Link className="role-dashboard-link" href="/ventas"><LayoutDashboard /> Gestionar pedidos</Link> : null}
      {account.role === "admin" ? <div className="role-dashboard-links"><Link className="role-dashboard-link" href="/admin"><LayoutDashboard /> Administración</Link><Link className="role-dashboard-link secondary" href="/ventas"><PackageCheck /> Supervisar pedidos</Link></div> : null}
      {account.role === "technician" ? <><div className="account-title"><h3>Mis pedidos</h3><span>{orders.length}</span></div>
      <div className="order-history">{orders.length ? orders.map((order) => <article key={order.id}><div><strong>{order.id}</strong><span>{new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</span></div><div><span><PackageCheck /> {order.items.reduce((sum, item) => sum + item.quantity, 0)} piezas</span><strong>{money(order.total)}</strong></div><small>{order.status}</small></article>) : <div className="orders-empty"><PackageCheck /><strong>Todavía no tienes pedidos</strong><span>Arma tu carrito y confirma el primero.</span></div>}</div></> : null}
      <button className="logout-button" onClick={onLogout}><LogOut /> Cerrar sesión</button>
    </div> : <div className="account-content">
      <div className="local-mode"><ShieldCheck /><div><strong>Acceso seguro FLYCDI</strong><span>Tu cuenta, catálogo y pedidos están protegidos.</span></div></div>
      <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Iniciar sesión</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setNotice(""); }}>Crear cuenta</button></div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" ? <><label>Nombre completo<input required name="name" autoComplete="name" placeholder="Ej. Carlos Rodríguez" /></label><label>Nombre de usuario<input required name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,29}" title="Usa entre 3 y 30 letras, números, puntos, guiones o guiones bajos." placeholder="admin" /></label><label>Nombre del taller<input required name="shopName" placeholder="Ej. Taller Móvil CR" /></label><label>WhatsApp<input required name="phone" type="tel" autoComplete="tel" placeholder="809 555 0000" /></label><label>Correo electrónico de contacto<input required name="email" type="email" autoComplete="email" placeholder="tu@correo.com" /><small>El equipo revisará tus datos personalmente.</small></label></> : null}
        {mode === "login" ? <label>Nombre de usuario<input required name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Tu nombre de usuario" /></label> : null}
        <label>Contraseña<input required name="password" type="password" minLength={6} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Mínimo 6 caracteres" /></label>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
        <button className="primary auth-submit" disabled={busy}>{busy ? "Procesando…" : mode === "register" ? "Registrarme como técnico" : "Entrar a mi cuenta"}</button>
      </form>
    </div>}
  </aside>;
}
