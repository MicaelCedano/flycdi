"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, LoaderCircle, Phone, X } from "lucide-react";
import { ORDER_STATUS_OPTIONS, type ManagedOrder, type OrderStatus } from "@/lib/account";
import { money } from "@/lib/catalog";
import { isOrderHistory, nextOrderActions, orderProgress, orderStages, stageLabels } from "@/lib/order-workflow";

const dateFormat = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" });

export function StatusBadge({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  return <span className={`inbox-status ${orderStages[status]}`}>{compact ? stageLabels[orderStages[status]] : status}</span>;
}

export function OrderDetail({ order, busy, onChange, onBack }: { order: ManagedOrder; busy: boolean; onChange: (status: OrderStatus) => Promise<boolean>; onBack: () => void }) {
  const [otherStatesOpen, setOtherStatesOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderStatus | null>(null);
  const workflow = nextOrderActions(order.status);
  const step = orderProgress(order.status);
  const closed = isOrderHistory(order.status);
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);

  async function confirmChange() {
    if (confirmation && await onChange(confirmation)) { setConfirmation(null); setOtherStatesOpen(false); }
  }

  return <article className="inbox-detail" aria-label={`Detalle del pedido ${order.id}`} aria-busy={busy}>
    <button type="button" className="inbox-back" onClick={onBack} disabled={busy}><ArrowLeft />Volver a pedidos</button>
    <header className="inbox-detail-head"><div><h2>{order.id}</h2><p>{dateFormat.format(new Date(order.createdAt))}</p></div><StatusBadge status={order.status} /></header>
    {order.status !== "Cancelado" ? <ol className="inbox-progress" aria-label="Avance del pedido">{["Recibido", "Confirmado", "Preparación", orderStages[order.status] === "transit" ? "En ruta" : "Listo", "Entregado"].map((label, index) => <li key={index} className={`${index < step ? "complete" : ""} ${index === step ? "current" : ""}`} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check /> : null}</span>{label}</li>)}</ol> : <p className="inbox-cancelled"><X />Este pedido fue cancelado.</p>}
    <div className="inbox-customer"><div><strong>{order.customer?.name || "Cliente no disponible"}</strong><span>{order.customer?.shopName || "Sin negocio registrado"}</span></div>{order.customer?.phone ? <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`}><Phone />{order.customer.phone}</a> : <span>Sin teléfono</span>}</div>
    <div className="inbox-items">
      <table><caption className="sr-only">Productos del pedido {order.id}</caption><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={`${item.productId}-${index}`}><td><strong>{item.name}</strong><span>Ref. {item.reference || "—"}{item.priceTier ? ` · Precio ${item.priceTier}` : ""}</span><small>{money(item.unitPrice)} / unidad</small></td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table>
      <div className="inbox-total"><span>{pieces} {pieces === 1 ? "pieza" : "piezas"}</span><span>Total <strong>{money(order.total)}</strong></span></div>
    </div>
    <section className="inbox-actions" aria-label="Acciones del pedido">
      <div className="inbox-next-copy"><h3>{workflow.title}</h3><p>{workflow.description}</p></div>
      <div className="inbox-action-buttons">
        {workflow.actions.map((action) => <button type="button" className="inbox-primary" key={action.status} disabled={busy || confirmation !== null} onClick={() => void onChange(action.status)}>{busy ? <LoaderCircle className="inbox-spin" /> : null}{action.label}<ArrowRight /></button>)}
        <div className="inbox-secondary-actions"><button type="button" className="inbox-button" aria-expanded={otherStatesOpen} aria-controls="inbox-other-states" disabled={busy || confirmation !== null} onClick={() => setOtherStatesOpen(!otherStatesOpen)}>{closed ? "Corregir estado" : "Otros estados"}<ChevronDown /></button>{!closed ? <button type="button" className="inbox-button inbox-cancel-button" disabled={busy} onClick={() => { setConfirmation("Cancelado"); setOtherStatesOpen(false); }}>Cancelar pedido</button> : null}</div>
      </div>
      {otherStatesOpen && !confirmation ? <div className="inbox-other-states" id="inbox-other-states"><p>Selecciona un estado para revisar el cambio.</p><div>{ORDER_STATUS_OPTIONS.filter((status) => status !== order.status && (closed || status !== "Cancelado")).map((status) => <button type="button" className="inbox-button" key={status} disabled={busy} onClick={() => setConfirmation(status)}>{status}<ChevronRight /></button>)}</div></div> : null}
      {confirmation ? <div className="inbox-confirm" role="group" aria-labelledby="inbox-confirm-title"><div><strong id="inbox-confirm-title">{confirmation === "Cancelado" ? `¿Cancelar ${order.id}?` : `Cambiar a “${confirmation}”`}</strong><p>{confirmation === "Cancelado" ? "El pedido pasará al historial y el cliente verá la cancelación." : `Estado actual: ${order.status}. El cliente verá el nuevo estado.`}</p></div><div><button autoFocus type="button" className="inbox-button" disabled={busy} onClick={() => setConfirmation(null)}>Volver</button><button type="button" className="inbox-primary" disabled={busy} onClick={() => void confirmChange()}>{busy ? "Guardando…" : confirmation === "Cancelado" ? "Confirmar cancelación" : "Confirmar cambio"}</button></div></div> : null}
    </section>
    {order.updatedAt ? <p className="inbox-updated">Última actualización: {dateFormat.format(new Date(order.updatedAt))}{order.managedByName ? ` · ${order.managedByName}` : ""}</p> : null}
  </article>;
}
