"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";
import {
  CUSTOM_PRODUCTS_CHANGED_EVENT,
  CUSTOM_PRODUCTS_STORAGE_KEY,
  readCustomProducts,
} from "@/lib/local-catalog";

export function useLocalCatalog(baseProducts: Product[]) {
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const refresh = useCallback(() => setCustomProducts(readCustomProducts()), []);

  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CUSTOM_PRODUCTS_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CUSTOM_PRODUCTS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CUSTOM_PRODUCTS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  const products = useMemo(() => [...customProducts, ...baseProducts], [customProducts, baseProducts]);
  return { products, customProducts, refresh };
}
