export type InventoryRecord = {
  productId: string;
  available: boolean;
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
};

export type InventoryMap = Record<string, InventoryRecord>;

export function isProductAvailable(inventory: InventoryMap, productId: string) {
  return inventory[productId]?.available ?? true;
}
