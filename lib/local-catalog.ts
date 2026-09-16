import type { Product } from "@/lib/catalog";

export const CUSTOM_PRODUCTS_STORAGE_KEY = "flycdi:custom-products:v1";
export const CUSTOM_PRODUCTS_CHANGED_EVENT = "flycdi:custom-products-changed";

export type NewProductInput = Omit<Product, "id">;

export function readCustomProducts(): Product[] {
  try {
    const value = window.localStorage.getItem(CUSTOM_PRODUCTS_STORAGE_KEY);
    return value ? (JSON.parse(value) as Product[]) : [];
  } catch {
    return [];
  }
}

export function createCustomProduct(
  input: NewProductInput,
  actor: { role: string },
  existingProducts: Product[],
) {
  if (actor.role !== "admin") throw new Error("Solo un administrador puede crear productos.");

  const product: Product = {
    id: `custom-${crypto.randomUUID()}`,
    category: input.category,
    brand: input.brand.trim(),
    model: input.model.trim(),
    productType: input.productType.trim(),
    variant: input.variant.trim(),
    reference: input.reference.trim().toUpperCase(),
    price1: input.price1,
    price2: input.price2,
    price3: input.price3,
  };

  if (!product.brand || !product.model || !product.productType || !product.reference) {
    throw new Error("Completa marca, modelo, tipo y referencia.");
  }
  if (![product.price1, product.price2, product.price3].every((price) => Number.isFinite(price) && price > 0)) {
    throw new Error("Los tres precios deben ser mayores que cero.");
  }
  if (product.price2 > product.price1 || product.price3 > product.price2) {
    throw new Error("Los precios por volumen no pueden ser mayores que el precio anterior.");
  }
  if (existingProducts.some((candidate) => candidate.reference.trim().toUpperCase() === product.reference)) {
    throw new Error(`Ya existe un producto con la referencia ${product.reference}.`);
  }

  const products = [product, ...readCustomProducts()];
  window.localStorage.setItem(CUSTOM_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new CustomEvent(CUSTOM_PRODUCTS_CHANGED_EVENT));
  return product;
}
