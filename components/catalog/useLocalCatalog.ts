"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/client";

type ProductRow = { id: string; category: Product["category"]; brand: string; model: string; product_type: string; variant: string; reference: string; price_1: number | string; price_2: number | string; price_3: number | string; available: boolean };

const mapProduct = (row: ProductRow): Product => ({ id: row.id, category: row.category, brand: row.brand, model: row.model, productType: row.product_type, variant: row.variant, reference: row.reference, price1: Number(row.price_1), price2: Number(row.price_2), price3: Number(row.price_3), available: row.available });

export function useLocalCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: queryError } = await createClient().from("products").select("id, category, brand, model, product_type, variant, reference, price_1, price_2, price_3, available").eq("active", true).order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setProducts(((data ?? []) as ProductRow[]).map(mapProduct));
    } catch {
      setProducts([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => refresh().catch(() => undefined), 0));
    const onCatalogChanged = () => refresh().catch(() => undefined);
    window.addEventListener("flycdi:catalog-changed", onCatalogChanged);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("flycdi:catalog-changed", onCatalogChanged);
    };
  }, [refresh]);

  return { products, loading, error, refresh };
}
