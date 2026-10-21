import type { OrderStatus } from "@/lib/account";

export type OrderStage = "pending" | "processing" | "ready" | "transit" | "delivered" | "cancelled";
export type OrderAction = { label: string; status: OrderStatus };

export const orderStages: Record<OrderStatus, OrderStage> = {
  "Pendiente de confirmación": "pending",
  Confirmado: "processing",
  "Preparando pedido": "processing",
  "Listo para recoger": "ready",
  "Listo para enviar": "ready",
  "Listo para despacho": "ready",
  "En camino": "transit",
  Despachado: "transit",
  Entregado: "delivered",
  Cancelado: "cancelled",
};

export const stageLabels: Record<OrderStage, string> = {
  pending: "Por aceptar", processing: "En preparación", ready: "Listo", transit: "En ruta", delivered: "Entregado", cancelled: "Cancelado",
};

export function isOrderHistory(status: OrderStatus) {
  return status === "Entregado" || status === "Cancelado";
}

export function nextOrderActions(status: OrderStatus): { title: string; description: string; actions: OrderAction[] } {
  switch (status) {
    case "Pendiente de confirmación": return { title: "Aceptar este pedido", description: "Confirma que puedes atender los productos solicitados.", actions: [{ label: "Aceptar pedido", status: "Confirmado" }] };
    case "Confirmado": return { title: "Comenzar la preparación", description: "Separa y revisa los productos del pedido.", actions: [{ label: "Empezar a preparar", status: "Preparando pedido" }] };
    case "Preparando pedido": return { title: "¿Cómo se entregará?", description: "Cuando termines, indica si el cliente recogerá o si se enviará.", actions: [{ label: "Listo para recoger", status: "Listo para recoger" }, { label: "Listo para enviar", status: "Listo para enviar" }] };
    case "Listo para recoger": return { title: "Esperando al cliente", description: "Marca la entrega cuando el cliente reciba los productos.", actions: [{ label: "Marcar como entregado", status: "Entregado" }] };
    case "Listo para enviar":
    case "Listo para despacho": return { title: "Despachar este pedido", description: "Indica que el pedido salió hacia su destino.", actions: [{ label: "Marcar en camino", status: "En camino" }] };
    case "En camino":
    case "Despachado": return { title: "Confirmar la entrega", description: "Completa el pedido cuando el cliente lo reciba.", actions: [{ label: "Marcar como entregado", status: "Entregado" }] };
    case "Entregado": return { title: "Pedido completado", description: "Este pedido está guardado en el historial.", actions: [] };
    case "Cancelado": return { title: "Pedido cancelado", description: "Este pedido está guardado en el historial.", actions: [] };
  }
}

export function orderProgress(status: OrderStatus) {
  if (status === "Confirmado") return 1;
  if (status === "Preparando pedido") return 2;
  if (orderStages[status] === "ready" || orderStages[status] === "transit") return 3;
  if (status === "Entregado") return 4;
  return 0;
}
