"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, ListFilter, LoaderCircle, LockKeyhole, Package, PackageCheck, Plus, RefreshCw, Search, Truck, X } from "lucide-react";
import { useLocalAccount } from "@/components/account/useLocalAccount";
import { money } from "@/lib/catalog";
import { statusFromDatabase, statusToDatabase, type ManagedOrder, type OrderStatus } from "@/lib/account";
import { isOrderHistory, orderStages, type OrderStage } from "@/lib/order-workflow";
import { createClient } from "@/lib/supabase/client";
import { OrderDetail, StatusBadge } from "@/components/orders/OrderDetail";

const StaffOrderForm = dynamic(() => import("@/components/orders/StaffOrderForm").then((module) => module.StaffOrderForm), { loading: () => <p role="status">Cargando formulario…</p> });
type ManagedOrderRow = { id: string; order_number: string; customer_id: string; status: string; total: number | string; managed_by: string | null; created_at: string; updated_at: string; profiles: { name: string; shop_name: string; phone: string } | null; order_items: Array<{ product_id: string | null; product_name: string; reference: string; quantity: number; unit_price: number | string; price_tier: number | null }> };
type View = "active" | "history";
type Filter = "all" | OrderStage;
const filters = [
  { id: "all", label: "Todos", icon: ListFilter },
  { id: "pending", label: "Por aceptar", icon: Clock3 },
  { id: "processing", label: "En preparación", icon: Package },
  { id: "ready", label: "Listos", icon: PackageCheck },
  { id: "transit", label: "En ruta", icon: Truck },
] as const;
const historyFilters = [{ id: "all", label: "Todos", icon: ListFilter }, { id: "delivered", label: "Entregados", icon: CheckCircle2 }, { id: "cancelled", label: "Cancelados", icon: X }] as const;
const shortDateFormat = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short" });
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const errorMessage = (error: unknown, fallback: string) => error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;

export function OrderManagement() {
  const { account, ready } = useLocalAccount();
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [orderView, setOrderView] = useState<View>("active");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const saving = useRef(false);
  const requestVersion = useRef(0);
  const canView = account?.role === "seller" || account?.role === "admin";

  const loadOrders = useCallback(async () => {
    if (saving.current) return;
    const version = ++requestVersion.current;
    setOrdersLoading(true);
    try {
      const { data, error } = await createClient().from("orders").select("id, order_number, customer_id, status, total, managed_by, created_at, updated_at, profiles!orders_customer_id_fkey(name, shop_name, phone), order_items(product_id, product_name, reference, quantity, unit_price, price_tier)").order("created_at", { ascending: false });
      if (error) throw error;
      if (version !== requestVersion.current) return;
      setOrders(((data ?? []) as unknown as ManagedOrderRow[]).map((row) => ({ id: row.order_number, databaseId: row.id, accountId: row.customer_id, createdAt: row.created_at, updatedAt: row.updated_at, status: statusFromDatabase[row.status] ?? "Pendiente de confirmación", total: Number(row.total), managedById: row.managed_by ?? undefined, items: row.order_items.map((item) => ({ productId: item.product_id ?? "", name: item.product_name, reference: item.reference, quantity: item.quantity, unitPrice: Number(item.unit_price), priceTier: item.price_tier as 1 | 2 | 3 | null })), customer: row.profiles ? { name: row.profiles.name, shopName: row.profiles.shop_name, phone: row.profiles.phone, email: "" } : null })));
      setLoadError("");
    } catch {
      if (version === requestVersion.current) setLoadError("No se pudieron actualizar los pedidos. Intenta de nuevo.");
    } finally {
      if (version === requestVersion.current) setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !canView) return;
    void loadOrders();
    const refresh = () => { if (document.visibilityState === "visible") void loadOrders(); };
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    return () => { ++requestVersion.current; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [ready, canView, loadOrders]);

  const activeOrders = useMemo(() => orders.filter((order) => !isOrderHistory(order.status)), [orders]);
  const historyOrders = useMemo(() => orders.filter((order) => isOrderHistory(order.status)), [orders]);
  const viewOrders = orderView === "active" ? activeOrders : historyOrders;
  const visibleOrders = useMemo(() => {
    const search = normalize(query.trim());
    return viewOrders.filter((order) => (filter === "all" || orderStages[order.status] === filter) && (!search || normalize([order.id, order.customer?.name, order.customer?.shopName, order.customer?.phone, ...order.items.flatMap((item) => [item.name, item.reference])].join(" ")).includes(search)));
  }, [viewOrders, filter, query]);
  const selectedOrder = visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0];

  function changeView(view: View) { setOrderView(view); setFilter("all"); setSelectedId(null); setMobileDetail(false); }

  async function changeStatus(order: ManagedOrder, status: OrderStatus): Promise<boolean> {
    if (!account || !canView || saving.current || order.status === status || ordersLoading) return false;
    saving.current = true;
    ++requestVersion.current;
    setSavingOrderId(order.id);
    setNotice(null);
    try {
      const { data, error } = await createClient().rpc("change_order_status", { target_order_id: order.databaseId, next_status: statusToDatabase[status] });
      if (error) throw error;
      const saved = (Array.isArray(data) ? data[0] : data) as { id?: string; status?: string; managed_by?: string; updated_at?: string } | null;
      if (!saved || saved.id !== order.databaseId || saved.status !== statusToDatabase[status]) throw new Error("No recibimos confirmación del cambio. Actualiza los pedidos antes de intentarlo de nuevo.");
      setOrders((current) => current.map((candidate) => candidate.id === order.id ? { ...candidate, status, managedById: saved.managed_by, managedByName: account.name, updatedAt: saved.updated_at } : candidate));
      if (isOrderHistory(status) !== (orderView === "history")) { setOrderView(isOrderHistory(status) ? "history" : "active"); setQuery(""); }
      setFilter("all");
      setSelectedId(order.id);
      setNotice({ kind: "success", message: `Pedido ${order.id}: ${status}.${isOrderHistory(status) ? " Guardado en el historial." : ""}` });
      return true;
    } catch (error) {
      setNotice({ kind: "error", message: errorMessage(error, "No se pudo guardar el estado. Intenta de nuevo.") });
      return false;
    } finally { saving.current = false; setSavingOrderId(null); }
  }

  if (!ready) return <main className="admin-shell"><div className="catalog-loading" aria-label="Comprobando acceso" /></main>;
  if (!account || !canView) return <main className="admin-shell admin-locked"><div className="catalog-lock-icon"><LockKeyhole /></div><p>ACCESO RESTRINGIDO</p><h1>Área exclusiva para ventas y administración</h1><span>Los técnicos pueden crear y consultar sus pedidos desde la tienda.</span><Link href="/">Ir a la tienda</Link></main>;

  const busy = savingOrderId !== null;
  return <main className="orders-workspace">
    <header className="inbox-header"><div><h1>Gestión de pedidos</h1><p>Acepta y prepara cada pedido desde un solo lugar.</p></div><div className="inbox-header-actions">{account.role === "admin" ? <Link className="inbox-button" href="/admin">Catálogo admin</Link> : null}<Link className="inbox-button" href="/">Ver tienda</Link><button className="inbox-primary" type="button" disabled={busy} aria-expanded={showNewOrder} aria-controls="inbox-new-order" onClick={() => setShowNewOrder(!showNewOrder)}>{showNewOrder ? <X /> : <Plus />}{showNewOrder ? "Cerrar formulario" : "Nuevo pedido"}</button></div></header>
    {showNewOrder ? <div id="inbox-new-order"><StaffOrderForm onCreated={(id) => { setShowNewOrder(false); changeView("active"); setQuery(""); setSelectedId(id); setNotice({ kind: "success", message: `Pedido ${id} registrado y confirmado.` }); void loadOrders(); }} /></div> : null}
    <nav className="inbox-tabs" aria-label="Vista de pedidos">{([{ id: "active", label: "Activos", count: activeOrders.length }, { id: "history", label: "Historial", count: historyOrders.length }] as const).map((view) => <button type="button" key={view.id} disabled={busy} aria-pressed={view.id === orderView} className={view.id === orderView ? "selected" : ""} onClick={() => changeView(view.id)}>{view.label}<span>{view.count}</span></button>)}</nav>
    <div className="inbox-toolbar"><nav className="inbox-filters" aria-label="Filtrar por etapa">{(orderView === "active" ? filters : historyFilters).map(({ id, label, icon: Icon }) => <button type="button" key={id} className={filter === id ? "selected" : ""} aria-pressed={filter === id} disabled={busy} onClick={() => { setFilter(id); setSelectedId(null); setMobileDetail(false); }}><Icon /><span>{label}</span><b>{id === "all" ? viewOrders.length : viewOrders.filter((order) => orderStages[order.status] === id).length}</b></button>)}</nav><div className="inbox-tools"><label className="inbox-search"><Search /><span className="sr-only">Buscar pedido, cliente o referencia</span><input type="search" value={query} disabled={busy} placeholder="Buscar pedido, cliente o referencia" onChange={(event) => { setQuery(event.target.value); setMobileDetail(false); }} /></label><button type="button" className="inbox-button" disabled={ordersLoading || busy} onClick={() => void loadOrders()}><RefreshCw className={ordersLoading ? "inbox-spin" : ""} /><span>Actualizar</span></button></div></div>
    {loadError ? <div className="inbox-alert error" role="alert"><AlertCircle /><span>{loadError}{orders.length ? " Se muestran los últimos datos cargados." : ""}</span><button type="button" className="inbox-button" disabled={ordersLoading || busy} onClick={() => void loadOrders()}>Reintentar</button></div> : null}
    {notice ? <div className={`inbox-alert ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.kind === "error" ? <AlertCircle /> : <CheckCircle2 />}<span>{notice.message}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)}><X /></button></div> : null}
    {ordersLoading && !orders.length ? <section className="inbox-empty" aria-label="Cargando pedidos"><LoaderCircle className="inbox-spin" /><h2>Cargando pedidos…</h2></section> : !visibleOrders.length ? <section className="inbox-empty"><PackageCheck /><h2>{loadError ? "No pudimos cargar tus pedidos" : query || filter !== "all" ? "No encontramos pedidos" : orderView === "history" ? "El historial está vacío" : "No hay pedidos activos"}</h2><p>{query || filter !== "all" ? "Prueba otro nombre, número de pedido o etapa." : "Los pedidos aparecerán aquí cuando estén disponibles."}</p>{query || filter !== "all" ? <button className="inbox-button" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Limpiar filtros</button> : null}</section> : <div className={`inbox-layout${mobileDetail ? " show-detail" : ""}`}>
      <section className="inbox-list" aria-label={orderView === "active" ? "Pedidos activos" : "Historial de pedidos"}><header><h2>{orderView === "active" ? "Pedidos activos" : "Historial"}</h2><p>{visibleOrders.length} {visibleOrders.length === 1 ? "pedido" : "pedidos"}{ordersLoading ? " · Actualizando…" : ""}</p></header><div className="inbox-rows">{visibleOrders.map((order) => <button type="button" className={`inbox-row${selectedOrder?.id === order.id ? " selected" : ""}`} key={order.id} aria-pressed={selectedOrder?.id === order.id} disabled={busy} onClick={() => { setSelectedId(order.id); setMobileDetail(true); }}><span className="inbox-row-main"><strong>{order.id}</strong><span>{order.customer?.name || "Cliente no disponible"}</span><small>{order.customer?.shopName || "Sin negocio registrado"}</small></span><span className="inbox-row-side"><StatusBadge status={order.status} compact /><strong>{money(order.total)}</strong><small>{shortDateFormat.format(new Date(order.createdAt))}</small></span><ChevronRight /></button>)}</div></section>
      {selectedOrder ? <OrderDetail key={`${selectedOrder.id}-${selectedOrder.status}`} order={selectedOrder} busy={busy || ordersLoading} onChange={(status) => changeStatus(selectedOrder, status)} onBack={() => setMobileDetail(false)} /> : null}
    </div>}
  </main>;
}
