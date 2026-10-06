"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, PackageCheck, Truck } from "lucide-react";
import { useLocalAccount } from "@/components/account/useLocalAccount";
import { money } from "@/lib/catalog";
import {
  ORDER_STATUSES,
  statusFromDatabase,
  statusToDatabase,
  type ManagedOrder,
  type OrderStatus,
} from "@/lib/account";
import { createClient } from "@/lib/supabase/client";

type ManagedOrderRow = { id: string; order_number: string; customer_id: string; status: string; total: number | string; managed_by: string | null; created_at: string; updated_at: string; profiles: { name: string; shop_name: string; phone: string } | null; order_items: Array<{ product_id: string | null; product_name: string; reference: string; quantity: number; unit_price: number | string }> };

const processingStatuses: OrderStatus[] = ["Confirmado", "Preparando pedido"];

export function OrderManagement() {
  const { account, ready } = useLocalAccount();
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [notice, setNotice] = useState("");
  const canView = account?.role === "seller" || account?.role === "admin";
  const canManage = account?.role === "seller";

  useEffect(() => {
    if (!ready || !canView) return;
    createClient().from("orders").select("id, order_number, customer_id, status, total, managed_by, created_at, updated_at, profiles!orders_customer_id_fkey(name, shop_name, phone), order_items(product_id, product_name, reference, quantity, unit_price)").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) { setNotice(error.message); return; }
      setOrders(((data ?? []) as unknown as ManagedOrderRow[]).map((row) => ({ id: row.order_number, databaseId: row.id, accountId: row.customer_id, createdAt: row.created_at, updatedAt: row.updated_at, status: statusFromDatabase[row.status] ?? "Pendiente de confirmación", total: Number(row.total), managedById: row.managed_by ?? undefined, items: row.order_items.map((item) => ({ productId: item.product_id ?? "", name: item.product_name, reference: item.reference, quantity: item.quantity, unitPrice: Number(item.unit_price) })), customer: row.profiles ? { name: row.profiles.name, shopName: row.profiles.shop_name, phone: row.profiles.phone, email: "" } : null })));
    });
  }, [ready, canView]);

  const counts = useMemo(() => ({
    pending: orders.filter((order) => order.status === "Pendiente de confirmación").length,
    processing: orders.filter((order) => processingStatuses.includes(order.status)).length,
    ready: orders.filter((order) => order.status === "Listo para despacho").length,
    dispatched: orders.filter((order) => order.status === "Despachado").length,
  }), [orders]);

  async function changeStatus(orderId: string, status: OrderStatus) {
    if (!account || !canManage) return;
    try {
      const order = orders.find((candidate) => candidate.id === orderId);
      if (!order) throw new Error("No encontramos ese pedido.");
      const { error } = await createClient().rpc("change_order_status", { target_order_id: order.databaseId, next_status: statusToDatabase[status] });
      if (error) throw error;
      setOrders((current) => current.map((candidate) => candidate.id === orderId ? { ...candidate, status, managedById: account.id, managedByName: account.name, updatedAt: new Date().toISOString() } : candidate));
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
