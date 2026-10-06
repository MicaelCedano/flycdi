"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Clock3, LayoutDashboard, LogOut, PackageCheck, RefreshCw, ShieldCheck, UserRound, X, XCircle } from "lucide-react";
import { money } from "@/lib/catalog";
import type { AccountProfile, OrderStatus, TechnicianOrder } from "@/lib/account";

type RegisterInput = { name: string; username: string; shopName: string; phone: string; email: string; password: string };
const roleLabels = { admin: "Administrador", seller: "Vendedor", technician: "Cliente técnico" } as const;

export function AccountDrawer({ open, account, orders, onClose, onRegister, onLogin, onLogout, onRefreshOrders }: {
  open: boolean;
  account: AccountProfile | null;
  orders: TechnicianOrder[];
  onClose: () => void;
  onRegister: (input: RegisterInput) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
  onRefreshOrders: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"register" | "login">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || account?.role !== "technician") return;
    void onRefreshOrders().catch(() => {});
    const interval = window.setInterval(() => { void onRefreshOrders().catch(() => {}); }, 20_000);
    return () => window.clearInterval(interval);
  }, [account?.id, account?.role, onRefreshOrders, open]);

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
      {account.role === "admin" ? <div className="role-dashboard-links"><Link className="role-dashboard-link" href="/admin"><LayoutDashboard /> Administración</Link><Link className="role-dashboard-link secondary" href="/ventas"><PackageCheck /> Gestionar pedidos</Link></div> : null}
      {account.role === "technician" ? <><div className="account-title"><h3>Seguimiento de pedidos</h3><span>{orders.length}</span><button className="orders-refresh" onClick={() => { void onRefreshOrders().catch(() => {}); }} aria-label="Actualizar pedidos"><RefreshCw />Actualizar</button></div>
      <div className="order-history">{orders.length ? orders.map((order) => <OrderTrackingCard key={order.id} order={order} />) : <div className="orders-empty"><PackageCheck /><strong>Todavía no tienes pedidos</strong><span>Cuando confirmes uno, podrás seguir aquí su preparación y entrega.</span></div>}</div></> : null}
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

const orderStatusDescriptions: Record<OrderStatus, string> = {
  "Pendiente de confirmación": "Recibimos el pedido. El equipo confirmará existencias, precio final y forma de entrega.",
  Confirmado: "El pedido fue confirmado y ya está en la fila de preparación.",
  "Preparando pedido": "Estamos reuniendo y revisando las piezas de tu pedido.",
  "Listo para recoger": "Tu pedido está listo para retirar. Coordina la hora con ventas.",
  "Listo para enviar": "Tu pedido está listo para despacho. Ventas coordinará el envío contigo.",
  "En camino": "El pedido salió y va en camino a su destino.",
  Entregado: "El pedido figura como entregado. Si necesitas ayuda, contacta a ventas.",
  Cancelado: "Este pedido fue cancelado. Contacta a ventas si necesitas aclarar algo.",
  "Listo para despacho": "El pedido está listo. Contacta a ventas para confirmar si se retira o se envía.",
  Despachado: "El pedido fue despachado. Contacta a ventas para coordinar la entrega.",
};

const orderProgress: Record<OrderStatus, number> = {
  "Pendiente de confirmación": 0,
  Confirmado: 1,
  "Preparando pedido": 2,
  "Listo para recoger": 3,
  "Listo para enviar": 3,
  "En camino": 4,
  Entregado: 4,
  Cancelado: -1,
  "Listo para despacho": 3,
  Despachado: 4,
};

function OrderTrackingCard({ order }: { order: TechnicianOrder }) {
  const stage = orderProgress[order.status];
  const readyLabel = order.status === "Listo para recoger"
    ? "Listo para recoger"
    : order.status === "Listo para enviar"
      ? "Listo para enviar"
      : "Listo para entrega";
  const finalLabel = order.status === "En camino" || order.status === "Despachado"
    ? "En camino"
    : order.status === "Entregado"
      ? "Entregado"
      : order.status === "Listo para recoger"
        ? "Recogido"
        : order.status === "Listo para enviar"
          ? "Enviado"
          : "Completado";
  const steps = ["Recibido", "Confirmado", "En preparación", readyLabel, finalLabel];
  const updatedAt = order.updatedAt ?? order.createdAt;
  const updatedDate = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(updatedAt));
  const createdDate = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt));

  return <article className="tracked-order">
    <div className="tracked-order-head">
      <div><strong>{order.id}</strong><span>{createdDate}</span></div>
      <span className={`tracking-status ${order.status === "Cancelado" ? "cancelled" : ""}`}>{order.status}</span>
    </div>
    <p className="tracking-description">{orderStatusDescriptions[order.status]}</p>
    {stage < 0 ? <div className="tracking-cancelled"><XCircle /> Pedido cancelado</div> : <ol className="order-progress" aria-label={`Progreso del pedido ${order.id}`}>
      {steps.map((label, index) => <li key={`${order.id}-${label}`} className={index < stage ? "complete" : index === stage ? "current" : "upcoming"}>
        <span className="progress-dot">{index < stage ? <Check /> : null}</span><span>{label}</span>
      </li>)}
    </ol>}
    <div className="tracking-footer">
      <span><Clock3 /> Última actualización: {updatedDate}</span>
      <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} piezas · {money(order.total)}</span>
    </div>
  </article>;
}
