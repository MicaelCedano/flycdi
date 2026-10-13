"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useLocalCatalog } from "@/components/catalog/useLocalCatalog";
import { createClient } from "@/lib/supabase/client";
import { money, productName, type Product } from "@/lib/catalog";

type TechnicianOption = { id: string; name: string; shop_name: string; phone: string };
type PriceTier = 1 | 2 | 3;
type DraftLine = { product: Product; quantity: number; priceTier: PriceTier };

const tierPrice = (product: Product, tier: PriceTier) =>
  tier === 1 ? product.price1 : tier === 2 ? product.price2 : product.price3;

export function StaffOrderForm({ onCreated }: { onCreated: (orderNumber: string) => void }) {
  const { products, loading: loadingProducts, error: productsError } = useLocalCatalog();
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [priceTier, setPriceTier] = useState<PriceTier>(1);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    createClient()
      .from("profiles")
      .select("id, name, shop_name, phone")
      .eq("role", "technician")
      .eq("approved", true)
      .order("name", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError("No se pudo cargar la lista de técnicos.");
        else setTechnicians((data ?? []) as TechnicianOption[]);
        setLoadingTechnicians(false);
      });
    return () => { active = false; };
  }, []);

  const availableProducts = useMemo(() => products.filter((product) => product.available !== false), [products]);
  const selectedProduct = availableProducts.find((product) => product.id === productId) ?? null;
  const total = useMemo(() => lines.reduce((sum, line) => sum + tierPrice(line.product, line.priceTier) * line.quantity, 0), [lines]);
  const selectedTechnician = technicians.find((technician) => technician.id === customerId);

  function addLine() {
    if (!selectedProduct || !Number.isSafeInteger(quantity) || quantity < 1) return;
    setError("");
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.product.id === selectedProduct.id);
      if (existingIndex === -1) return [...current, { product: selectedProduct, quantity, priceTier }];
      return current.map((line, index) => index === existingIndex
        ? { ...line, quantity: line.quantity + quantity, priceTier }
        : line);
    });
    setProductId("");
    setQuantity(1);
    setPriceTier(1);
  }

  function updateLine(index: number, updates: Partial<Pick<DraftLine, "quantity" | "priceTier">>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...updates } : line));
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId || !lines.length || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data, error: rpcError } = await createClient().rpc("create_staff_order", {
        target_customer_id: customerId,
        items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity, price_tier: line.priceTier })),
      });
      if (rpcError) throw rpcError;
      const result = data as unknown as { order_number: string } | null;
      if (!result?.order_number) throw new Error("No recibimos el número del pedido creado.");
      setLines([]);
      setCustomerId("");
      onCreated(result.order_number);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el pedido.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="staff-order-panel" aria-labelledby="staff-order-title">
    <div className="staff-order-heading">
      <div><p className="section-index">VENTA DIRECTA</p><h2 id="staff-order-title">Registrar pedido para un técnico</h2><p>Elige el precio de cada producto. La cantidad no cambia el nivel seleccionado.</p></div>
    </div>
    {error ? <p className="auth-error" role="alert">{error}</p> : null}
    <form onSubmit={(event) => void submitOrder(event)}>
      <label className="staff-customer-field">Técnico registrado
        <select required value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={loadingTechnicians || !technicians.length}>
          <option value="">{loadingTechnicians ? "Cargando técnicos…" : technicians.length ? "Selecciona una persona" : "No hay técnicos habilitados"}</option>
          {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}{technician.shop_name ? ` · ${technician.shop_name}` : ""}</option>)}
        </select>
        {selectedTechnician?.phone ? <small>WhatsApp: {selectedTechnician.phone}</small> : null}
      </label>

      <fieldset className="staff-product-adder">
        <legend>Agregar producto</legend>
        <label>Producto
          <select value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loadingProducts || !availableProducts.length}>
            <option value="">{loadingProducts ? "Cargando catálogo…" : productsError ? "Catálogo no disponible" : "Selecciona una pieza"}</option>
            {availableProducts.map((product) => <option value={product.id} key={product.id}>{productName(product)}{product.reference ? ` · ${product.reference}` : ""}</option>)}
          </select>
        </label>
        <label>Cantidad
          <input type="number" min={1} step={1} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
        </label>
        <label>Precio para esta persona
          <select value={priceTier} onChange={(event) => setPriceTier(Number(event.target.value) as PriceTier)}>
            <option value={1}>Precio 1 · 1–9 · {selectedProduct ? money(selectedProduct.price1) : ""}</option>
            <option value={2}>Precio 2 · 10–49 · {selectedProduct ? money(selectedProduct.price2) : ""}</option>
            <option value={3}>Precio 3 · 50+ · {selectedProduct ? money(selectedProduct.price3) : ""}</option>
          </select>
        </label>
        <button className="secondary staff-add-button" type="button" disabled={!selectedProduct || !Number.isSafeInteger(quantity) || quantity < 1} onClick={addLine}><Plus /> Agregar</button>
      </fieldset>

      <div className="staff-order-lines">
        {!lines.length ? <p>Los productos que agregues aparecerán aquí.</p> : lines.map((line, index) => <article className="staff-order-line" key={line.product.id}>
          <div className="staff-line-product"><strong>{productName(line.product)}</strong><small>{line.product.reference || "Sin referencia"}</small></div>
          <label>Cantidad<input type="number" min={1} step={1} inputMode="numeric" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></label>
          <label>Precio unitario<select value={line.priceTier} onChange={(event) => updateLine(index, { priceTier: Number(event.target.value) as PriceTier })}>
            <option value={1}>Precio 1 · {money(line.product.price1)}</option>
            <option value={2}>Precio 2 · {money(line.product.price2)}</option>
            <option value={3}>Precio 3 · {money(line.product.price3)}</option>
          </select></label>
          <strong className="staff-line-total">{money(tierPrice(line.product, line.priceTier) * line.quantity)}</strong>
          <button type="button" className="staff-remove-line" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Quitar ${productName(line.product)}`}><Trash2 /></button>
        </article>)}
      </div>

      <div className="staff-order-summary"><span>Total del pedido</span><strong>{money(total)}</strong></div>
      <button className="primary staff-submit-button" type="submit" disabled={saving || !customerId || !lines.length || loadingTechnicians || !technicians.length}>
        {saving ? "Registrando…" : "Registrar pedido"}
      </button>
      <small className="staff-order-hint"><CheckCircle2 /> El precio escogido queda guardado en cada producto del pedido.</small>
    </form>
  </section>;
}
