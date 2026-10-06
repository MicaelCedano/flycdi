"use client";

import { useCallback, useEffect, useState } from "react";
import type { InventoryMap } from "@/lib/local-inventory";
import { createClient } from "@/lib/supabase/client";

export function useLocalInventory() {
  const [inventory, setInventory] = useState<InventoryMap>({});

  const refresh = useCallback(async () => {
    const { data, error } = await createClient().from("products").select("id, available, updated_at, updated_by");
    if (error) return;
    setInventory(Object.fromEntries((data ?? []).map((row) => [row.id, { productId: row.id, available: row.available, updatedAt: row.updated_at, updatedById: row.updated_by ?? "", updatedByName: "" }])));
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => refresh().catch(() => undefined), 0));
    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  return { inventory, refresh };
}
