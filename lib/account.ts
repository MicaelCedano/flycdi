export type AccountRole = "admin" | "seller" | "technician";

export type AccountProfile = {
  id: string;
  username: string;
  role: AccountRole;
  name: string;
  shopName: string;
  phone: string;
  email: string;
  createdAt: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  reference: string;
  quantity: number;
  unitPrice: number;
};

export const ORDER_STATUSES = [
  "Pendiente de confirmación",
  "Confirmado",
  "Preparando pedido",
  "Listo para despacho",
  "Despachado",
  "Cancelado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type TechnicianOrder = {
  id: string;
  databaseId: string;
  accountId: string;
  createdAt: string;
  updatedAt?: string;
  status: OrderStatus;
  managedById?: string;
  managedByName?: string;
  total: number;
  items: OrderItem[];
};

export type ManagedOrder = TechnicianOrder & {
  customer: Pick<AccountProfile, "name" | "shopName" | "phone" | "email"> | null;
};

export const statusToDatabase = {
  "Pendiente de confirmación": "pending",
  Confirmado: "confirmed",
  "Preparando pedido": "preparing",
  "Listo para despacho": "ready",
  Despachado: "dispatched",
  Cancelado: "cancelled",
} as const;

export const statusFromDatabase = Object.fromEntries(
  Object.entries(statusToDatabase).map(([label, value]) => [value, label]),
) as Record<string, OrderStatus>;
