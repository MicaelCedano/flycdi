"use client";

import { useState, type FormEvent } from "react";
import { PackagePlus, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { AccountProfile } from "@/lib/account";
import { createClient } from "@/lib/supabase/client";

export function ProductCreator({ account, products }: { account: AccountProfile; products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const product = {
        id: `custom-${crypto.randomUUID()}`,
        category: String(data.get("category")) as Product["category"],
        brand: String(data.get("brand")).trim(),
        model: String(data.get("model")).trim(),
        productType: String(data.get("productType")).trim(),
        variant: String(data.get("variant")).trim(),
        reference: String(data.get("reference")).trim().toUpperCase(),
        price1: Number(data.get("price1")),
        price2: Number(data.get("price2")),
        price3: Number(data.get("price3")),
      };
      if (!product.brand || !product.model || !product.productType || !product.reference) throw new Error("Completa marca, modelo, tipo y referencia.");
      if (product.price2 > product.price1 || product.price3 > product.price2) throw new Error("Los precios por volumen no pueden ser mayores que el precio anterior.");
      if (products.some((candidate) => candidate.reference.trim().toUpperCase() === product.reference)) throw new Error(`Ya existe un producto con la referencia ${product.reference}.`);
      const { error: insertError } = await createClient().from("products").insert({ id: product.id, category: product.category, brand: product.brand, model: product.model, product_type: product.productType, variant: product.variant, reference: product.reference, price_1: product.price1, price_2: product.price2, price_3: product.price3, available: true, active: true });
      if (insertError) throw new Error(insertError.message);
      window.dispatchEvent(new CustomEvent("flycdi:catalog-changed"));
      form.reset();
      setNotice(`${product.brand} ${product.model} fue agregado al catálogo.`);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el producto.");
    }
  }

  return <section className="product-creator">
    <div className="product-creator-bar">
      <div><strong>Productos del catálogo</strong><span>Agrega referencias nuevas y luego controla su disponibilidad.</span></div>
      <button type="button" className="new-product-button" onClick={() => { setOpen((current) => !current); setError(""); setNotice(""); }}>{open ? <X /> : <PackagePlus />}{open ? "Cerrar" : "Nuevo producto"}</button>
    </div>
    {notice ? <p className="product-create-notice" role="status">{notice}</p> : null}
    {open ? <form className="product-create-form" onSubmit={submit}>
      <label>Marca<input name="brand" required placeholder="Ej. Samsung" /></label>
      <label>Modelo<input name="model" required placeholder="Ej. A15" /></label>
      <label>Categoría<select name="category" defaultValue="Pantallas"><option>Pantallas</option><option>Cámaras traseras</option><option>Flex pin de carga</option></select></label>
      <label>Tipo o calidad<input name="productType" required defaultValue="LCD" placeholder="Ej. LCD, OLED o cámara" /></label>
      <label>Variante<input name="variant" placeholder="Ej. FLYCDI - Negro" /></label>
      <label>Referencia<input name="reference" required placeholder="Ej. C4001" /></label>
      <label>Precio 1–9<input name="price1" required type="number" inputMode="decimal" min="1" step="0.01" placeholder="0.00" /></label>
      <label>Precio 10–49<input name="price2" required type="number" inputMode="decimal" min="1" step="0.01" placeholder="0.00" /></label>
      <label>Precio 50+<input name="price3" required type="number" inputMode="decimal" min="1" step="0.01" placeholder="0.00" /></label>
      {error ? <p className="product-create-error" role="alert">{error}</p> : null}
      <button className="primary product-create-submit">Agregar al catálogo</button>
    </form> : null}
  </section>;
}
