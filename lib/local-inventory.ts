export type InventoryRecord = {
  productId: string;
  available: boolean;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
};

export type InventoryMap = Record<string, InventoryRecord>;
export type InventoryItem = { productId: string; name: string; quantity: number };

export const INVENTORY_STORAGE_KEY = "flycdi:inventory:v1";
export const INVENTORY_CHANGED_EVENT = "flycdi:inventory-changed";

function readInventory(): InventoryMap {
  try {
    const value = window.localStorage.getItem(INVENTORY_STORAGE_KEY);
    return value ? (JSON.parse(value) as InventoryMap) : {};
  } catch {
    return {};
  }
}

function writeInventory(inventory: InventoryMap) {
  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  window.dispatchEvent(new CustomEvent(INVENTORY_CHANGED_EVENT));
}

function quantitiesByProduct(items: InventoryItem[]) {
  const quantities = new Map<string, InventoryItem>();
  for (const item of items) {
    const current = quantities.get(item.productId);
    quantities.set(item.productId, { ...item, quantity: (current?.quantity ?? 0) + item.quantity });
  }
  return [...quantities.values()];
}

export function readInventoryRecords() {
  return readInventory();
}

export function isProductAvailable(inventory: InventoryMap, productId: string) {
  return inventory[productId]?.available ?? true;
}

export function saveInventoryAvailability(
  productId: string,
  available: boolean,
  actor: { id: string; name: string; role: string },
) {
  if (actor.role !== "admin") throw new Error("Solo un administrador puede cambiar el inventario.");
  const record: InventoryRecord = {
    productId,
    available,
    updatedAt: new Date().toISOString(),
    updatedById: actor.id,
    updatedByName: actor.name,
  };
  writeInventory({ ...readInventory(), [productId]: record });
  return record;
}

export function validateInventoryAvailability(items: InventoryItem[]) {
  const inventory = readInventory();
  const requested = quantitiesByProduct(items);

  for (const item of requested) {
    if (!isProductAvailable(inventory, item.productId)) throw new Error(`${item.name} no está disponible en este momento.`);
  }
}
