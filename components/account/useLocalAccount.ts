"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  statusFromDatabase,
  type AccountProfile,
  type OrderItem,
  type TechnicianOrder,
} from "@/lib/account";

type ProfileRow = { id: string; username: string; role: AccountProfile["role"]; name: string; shop_name: string; phone: string; created_at: string };
type ItemRow = { product_id: string | null; product_name: string; reference: string; quantity: number; unit_price: number | string };
type OrderRow = { id: string; order_number: string; customer_id: string; status: string; total: number | string; created_at: string; updated_at: string; order_items: ItemRow[] };

function mapAccount(user: User, profile: ProfileRow): AccountProfile {
  return { id: profile.id, username: profile.username, role: profile.role, name: profile.name, shopName: profile.shop_name, phone: profile.phone, email: user.email ?? "", createdAt: profile.created_at };
}

function mapOrder(row: OrderRow): TechnicianOrder {
  return {
    id: row.order_number,
    databaseId: row.id,
    accountId: row.customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: statusFromDatabase[row.status] ?? "Pendiente de confirmación",
    total: Number(row.total),
    items: row.order_items.map((item) => ({ productId: item.product_id ?? "", name: item.product_name, reference: item.reference, quantity: item.quantity, unitPrice: Number(item.unit_price) })),
  };
}

export function useLocalAccount() {
  const supabase = useMemo(() => createClient(), []);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [orders, setOrders] = useState<TechnicianOrder[]>([]);
  const [ready, setReady] = useState(false);

  const loadOrders = useCallback(async (accountId: string) => {
    const { data, error } = await supabase.from("orders").select("id, order_number, customer_id, status, total, created_at, updated_at, order_items(product_id, product_name, reference, quantity, unit_price)").eq("customer_id", accountId).order("created_at", { ascending: false });
    if (error) throw error;
    setOrders(((data ?? []) as OrderRow[]).map(mapOrder));
  }, [supabase]);

  const loadAccount = useCallback(async (user: User | null) => {
    if (!user) { setAccount(null); setOrders([]); setReady(true); return; }
    const { data, error } = await supabase.from("profiles").select("id, username, role, name, shop_name, phone, created_at").eq("id", user.id).single();
    if (error) throw error;
    const profile = mapAccount(user, data as ProfileRow);
    setAccount(profile);
    if (profile.role === "technician") await loadOrders(profile.id);
    else setOrders([]);
    setReady(true);
  }, [loadOrders, supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => loadAccount(data.user)).catch(() => setReady(true));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => loadAccount(session?.user ?? null).catch(() => setReady(true)), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadAccount, supabase]);

  return {
    account,
    orders,
    ready,
    async register(input: { name: string; username: string; shopName: string; phone: string; email: string; password: string }) {
      const { data, error } = await supabase.auth.signUp({ email: input.email.trim().toLowerCase(), password: input.password, options: { data: { name: input.name.trim(), username: input.username.trim().toLowerCase(), shop_name: input.shopName.trim(), phone: input.phone.trim() } } });
      if (error) throw new Error(error.message);
      if (!data.session) throw new Error("Revisa tu correo para confirmar la cuenta y luego inicia sesión.");
      await loadAccount(data.user);
    },
    async login(username: string, password: string) {
      const response = await fetch("/api/auth/username-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Usuario o contraseña incorrectos.");
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error("Usuario o contraseña incorrectos.");
      await loadAccount(data.user);
    },
    async logout() {
      await supabase.auth.signOut();
      setAccount(null);
      setOrders([]);
    },
    async saveOrder(items: OrderItem[], _total: number) {
      if (!account) throw new Error("Debes iniciar sesión.");
      if (account.role !== "technician") throw new Error("Solo los clientes técnicos pueden crear pedidos.");
      const { data, error } = await supabase.rpc("place_order", { items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })) });
      if (error) throw new Error(error.message);
      await loadOrders(account.id);
      return { id: String(data.order_number) };
    },
  };
}
