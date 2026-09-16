"use client";

import { useEffect, useState } from "react";
import {
  createLocalOrder,
  currentAccount,
  loginTechnician,
  logoutTechnician,
  ordersFor,
  registerTechnician,
  type OrderItem,
  type TechnicianAccount,
  type TechnicianOrder,
} from "@/lib/local-account";

export function useLocalAccount() {
  const [account, setAccount] = useState<TechnicianAccount | null>(null);
  const [orders, setOrders] = useState<TechnicianOrder[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = currentAccount();
    setAccount(stored);
    setOrders(stored ? ordersFor(stored.id) : []);
    setReady(true);
  }, []);

  return {
    account,
    orders,
    ready,
    async register(input: Parameters<typeof registerTechnician>[0]) {
      const created = await registerTechnician(input);
      setAccount(created);
      setOrders([]);
    },
    async login(email: string, password: string) {
      const found = await loginTechnician(email, password);
      setAccount(found);
      setOrders(ordersFor(found.id));
    },
    logout() {
      logoutTechnician();
      setAccount(null);
      setOrders([]);
    },
    saveOrder(items: OrderItem[], total: number) {
      if (!account) throw new Error("Debes iniciar sesión.");
      if (account.role !== "technician") throw new Error("Solo los clientes técnicos pueden crear pedidos.");
      const order = createLocalOrder(account.id, items, total);
      setOrders((current) => [order, ...current]);
      return order;
    },
  };
}
