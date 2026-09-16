"use client";

import { useCallback, useEffect, useState } from "react";
import {
  INVENTORY_CHANGED_EVENT,
  INVENTORY_STORAGE_KEY,
  readInventoryRecords,
  type InventoryMap,
} from "@/lib/local-inventory";

export function useLocalInventory() {
  const [inventory, setInventory] = useState<InventoryMap>({});

  const refresh = useCallback(() => setInventory(readInventoryRecords()), []);

  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === INVENTORY_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(INVENTORY_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(INVENTORY_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { inventory, refresh };
}
