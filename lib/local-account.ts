import { validateInventoryAvailability } from "@/lib/local-inventory";

export type AccountRole = "admin" | "seller" | "technician";

export type TechnicianAccount = {
  id: string;
  role: AccountRole;
  name: string;
  shopName: string;
  phone: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  reference: string;
  quantity: number;
  unitPrice: number;
};

export type TechnicianOrder = {
  id: string;
  accountId: string;
  createdAt: string;
  updatedAt?: string;
  status: OrderStatus;
  managedById?: string;
  managedByName?: string;
  total: number;
  items: OrderItem[];
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

export type ManagedOrder = TechnicianOrder & {
  customer: Pick<TechnicianAccount, "name" | "shopName" | "phone" | "email"> | null;
};

const ACCOUNTS_KEY = "flycdi:accounts:v1";
const SESSION_KEY = "flycdi:session:v1";
const ORDERS_KEY = "flycdi:orders:v1";
const DEMO_ACCOUNTS = [
  { id: "flycdi-demo-admin", role: "admin", name: "Administrador FLYCDI", shopName: "FLYCDI", phone: "—", email: "admin@flycdi.com", password: "FlyCdiAdmin2026!" },
  { id: "flycdi-demo-seller", role: "seller", name: "Vendedor FLYCDI", shopName: "Equipo de ventas", phone: "809 555 0100", email: "ventas@flycdi.com", password: "FlyCdiVentas2026!" },
  { id: "flycdi-demo-technician", role: "technician", name: "Técnico de prueba", shopName: "Taller Demo", phone: "809 555 0200", email: "cliente@flycdi.com", password: "FlyCdiCliente2026!" },
] satisfies Array<Omit<TechnicianAccount, "passwordHash" | "createdAt"> & { password: string }>;

function read<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(`flycdi-local:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function currentAccount(): TechnicianAccount | null {
  const accountId = read<string | null>(SESSION_KEY, null);
  if (!accountId) return null;
  return read<TechnicianAccount[]>(ACCOUNTS_KEY, []).find((account) => account.id === accountId) ?? null;
}

export async function registerTechnician(input: Omit<TechnicianAccount, "id" | "role" | "passwordHash" | "createdAt"> & { password: string }) {
  const accounts = read<TechnicianAccount[]>(ACCOUNTS_KEY, []);
  const email = input.email.trim().toLowerCase();
  if (DEMO_ACCOUNTS.some((account) => account.email === email)) throw new Error("Ese correo está reservado para el equipo de FLYCDI.");
  if (accounts.some((account) => account.email === email)) throw new Error("Ya existe una cuenta con ese correo.");
  const account: TechnicianAccount = {
    id: crypto.randomUUID(),
    role: "technician",
    name: input.name.trim(),
    shopName: input.shopName.trim(),
    phone: input.phone.trim(),
    email,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  write(ACCOUNTS_KEY, [...accounts, account]);
  write(SESSION_KEY, account.id);
  return account;
}

export async function loginTechnician(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const accounts = read<TechnicianAccount[]>(ACCOUNTS_KEY, []);
  let account = accounts.find((candidate) => candidate.email === email && candidate.passwordHash === passwordHash);
  const demoAccount = DEMO_ACCOUNTS.find((candidate) => candidate.email === email && candidate.password === password);

  if (demoAccount) {
    account = {
      id: demoAccount.id,
      role: demoAccount.role,
      name: demoAccount.name,
      shopName: demoAccount.shopName,
      phone: demoAccount.phone,
      email: demoAccount.email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    write(ACCOUNTS_KEY, [...accounts.filter((candidate) => candidate.id !== demoAccount.id), account]);
  }

  if (!account) throw new Error("Correo o contraseña incorrectos.");
  write(SESSION_KEY, account.id);
  return account;
}

export function logoutTechnician() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function ordersFor(accountId: string) {
  return read<TechnicianOrder[]>(ORDERS_KEY, []).filter((order) => order.accountId === accountId).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function allOrdersWithCustomers(): ManagedOrder[] {
  const accounts = new Map(read<TechnicianAccount[]>(ACCOUNTS_KEY, []).map((account) => [account.id, account]));
  return read<TechnicianOrder[]>(ORDERS_KEY, []).map((order) => {
    const customer = accounts.get(order.accountId);
    return {
      ...order,
      customer: customer ? { name: customer.name, shopName: customer.shopName, phone: customer.phone, email: customer.email } : null,
    };
  }).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateOrderStatus(orderId: string, status: OrderStatus, seller: TechnicianAccount) {
  if (seller.role !== "seller") throw new Error("Solo los vendedores pueden actualizar pedidos.");
  const orders = read<TechnicianOrder[]>(ORDERS_KEY, []);
  const current = orders.find((order) => order.id === orderId);
  if (!current) throw new Error("No encontramos ese pedido.");
  const updated: TechnicianOrder = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
    managedById: seller.id,
    managedByName: seller.name,
  };
  write(ORDERS_KEY, orders.map((order) => order.id === orderId ? updated : order));
  return updated;
}

export function createLocalOrder(accountId: string, items: OrderItem[], total: number) {
  const orders = read<TechnicianOrder[]>(ORDERS_KEY, []);
  const now = new Date();
  validateInventoryAvailability(items);
  const order: TechnicianOrder = {
    id: `FLY-${now.toISOString().slice(2, 10).replaceAll("-", "")}-${String(orders.length + 1).padStart(4, "0")}`,
    accountId,
    createdAt: now.toISOString(),
    status: "Pendiente de confirmación",
    total,
    items,
  };
  write(ORDERS_KEY, [...orders, order]);
  return order;
}
