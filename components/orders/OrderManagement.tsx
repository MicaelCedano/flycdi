"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, PackageCheck, Truck } from "lucide-react";
import { useLocalAccount } from "@/components/account/useLocalAccount";
import { money } from "@/lib/catalog";
import {
  allOrdersWithCustomers,
  ORDER_STATUSES,
  updateOrderStatus,
  type ManagedOrder,
  type OrderStatus,
} from "@/lib/local-account";

const processingStatuses: OrderStatus[] = ["Confirmado", "Preparando pedido"];

export function OrderManagement() {
  const { account, ready } = useLocalAccount();
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [notice, setNotice] = useState("");
  const canView = account?.role === "seller" || account?.role === "admin";
  const canManage = account?.role === "seller";

  useEffect(() => {
    if (ready && canView) setOrders(allOrdersWithCustomers());
  }, [ready, canView]);

  const counts = useMemo(() => ({
    pending: orders.filter((order) => order.status === "Pendiente de confirmación").length,
    processing: orders.filter((order) => processingStatuses.includes(order.status)).length,
    ready: orders.filter((order) => order.status === "Listo para despacho").length,
    dispatched: orders.filter((order) => order.status === "Despachado").length,
  }), [orders]);

  function changeStatus(orderId: string, status: OrderStatus) {
    if (!account || !canManage) return;
    try {
      updateOrderStatus(orderId, status, account);
      setOrders(allOrdersWithCustomers());
      setNotice(`Pedido ${orderId} actualizado a “${status}”.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar el pedido.");
    }
    window.setTimeout(() => setNotice(""), 3500);
  }

  if (!ready) return <main className="admin-shell"><div className="catalog-loading" aria-label="Comprobando acceso" /></main>;
  if (!account || !canView) return <main className="admin-shell admin-locked"><div className="catalog-lock-icon"><LockKeyhole /></div><p>ACCESO RESTRINGIDO</p><h1>Área exclusiva para ventas y administración</h1><span>Los técnicos pueden crear y consultar sus pedidos desde la tienda.</span><Link href="/">Ir a la tienda</Link></main>;

  return <main className="admin-shell sales-shell">
    <header className="admin-header sales-header">
      <div><p>FLYCDI / {canManage ? "VENTAS" : "SUPERVISIÓN"}</p><h1>Gestión de pedidos</h1><span>{canManage ? "Actualiza cada pedido hasta completar su despacho." : "Vista administrativa de todos los pedidos."}</span></div>
      <div className="admin-header-actions">{account.role === "admin" ? <Link href="/admin">Catálogo admin</Link> : null}<Link href="/">Ver tienda</Link></div>
    </header>

    <section className="admin-metrics sales-metrics" aria-label="Resumen de pedidos">
      <article><Clock3 /><strong>{counts.pending}</strong><span>Pendientes</span></article>
      <article><PackageCheck /><strong>{counts.processing}</strong><span>En proceso</span></article>
      <article><CheckCircle2 /><strong>{counts.ready}</strong><span>Listos</span></article>
      <article><Truck /><strong>{counts.dispatched}</strong><span>Despachados</span></article>
    </section>

    {!orders.length ? <section className="sales-empty"><PackageCheck /><h2>No hay pedidos todavía</h2><p>Los pedidos creados por técnicos en este dispositivo aparecerán aquí.</p></section> : <section className="sales-orders" aria-label="Pedidos recibidos">
      {orders.map((order) => <article className="sales-order" key={order.id}>
        <div className="sales-order-head"><div><strong>{order.id}</strong><span>{new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}</span></div><span className="order-status">{order.status}</span></div>
        <div className="sales-customer"><div><small>CLIENTE TÉCNICO</small><strong>{order.customer?.name ?? "Cliente no disponible"}</strong><span>{order.customer?.shopName ?? "—"}</span></div><div><span>{order.customer?.phone ?? "—"}</span><span>{order.customer?.email ?? "—"}</span></div></div>
        <div className="sales-items">{order.items.map((item) => <div key={`${order.id}-${item.productId}`}><span>{item.quantity} × {item.name}</span><small>{item.reference || "Sin referencia"}</small><strong>{money(item.unitPrice * item.quantity)}</strong></div>)}</div>
        <div className="sales-order-foot"><div><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} piezas</span><strong>{money(order.total)}</strong></div>{canManage ? <label>Estado del pedido<select value={order.status} onChange={(event) => changeStatus(order.id, event.target.value as OrderStatus)}>{ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label> : <div className="supervision-note">Solo el vendedor asignado procesa el pedido.</div>}</div>
        {order.managedByName ? <small className="managed-by">Última gestión: {order.managedByName}</small> : null}
      </article>)}
    </section>}
    {notice ? <div className="order-notice" role="status"><CheckCircle2 />{notice}</div> : null}
  </main>;
}
