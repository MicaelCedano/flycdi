"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { money } from "@/lib/catalog";
import type { TechnicianAccount } from "@/lib/local-account";
import { isProductAvailable, saveInventoryAvailability } from "@/lib/local-inventory";
import { useLocalInventory } from "@/components/inventory/useLocalInventory";

type Availability = "all" | "available" | "unavailable";

export function CatalogTable({ products, account }: { products: Product[]; account: TechnicianAccount }) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<Availability>("all");
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const deferred = useDeferredValue(query.toLocaleLowerCase("es"));
  const { inventory } = useLocalInventory();

  const metrics = useMemo(() => products.reduce((result, product) => {
    if (isProductAvailable(inventory, product.id)) result.available += 1;
    else result.unavailable += 1;
    return result;
  }, { available: 0, unavailable: 0 }), [products, inventory]);

  const rows = useMemo(() => products.filter((product) => {
    const isAvailable = isProductAvailable(inventory, product.id);
    const matchesAvailability = availability === "all" ||
      (availability === "available" && isAvailable) ||
      (availability === "unavailable" && !isAvailable);
    const haystack = `${product.brand} ${product.model} ${product.productType} ${product.variant} ${product.reference}`.toLocaleLowerCase("es");
    return matchesAvailability && haystack.includes(deferred);
  }), [products, inventory, availability, deferred]);

  const save = (product: Product) => {
    const available = drafts[product.id] ?? isProductAvailable(inventory, product.id);
    try {
      saveInventoryAvailability(product.id, available, account);
      setNotice(`${product.brand} ${product.model}: marcado como ${available ? "disponible" : "no disponible"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar la disponibilidad.");
    }
  };

  return <>
    <section className="admin-metrics inventory-metrics" aria-label="Resumen del inventario">
      <article><strong>{products.length}</strong><span>Productos del catálogo</span></article>
      <article><strong>{metrics.available}</strong><span>Referencias disponibles</span></article>
      <article><strong>{metrics.unavailable}</strong><span>No disponibles</span></article>
    </section>
    <section className="admin-catalog">
      <div className="admin-toolbar inventory-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelo o referencia" /></label>
        <select aria-label="Filtrar por disponibilidad" value={availability} onChange={(event) => setAvailability(event.target.value as Availability)}>
          <option value="all">Todos los estados</option>
          <option value="available">Disponibles</option>
          <option value="unavailable">No disponibles</option>
        </select>
        <span>{rows.length} resultados</span>
      </div>
      {notice ? <p className="inventory-notice" role="status">{notice}</p> : null}
      <div className="table-wrap"><table><thead><tr><th>Marca / modelo</th><th>Tipo</th><th>Referencia</th><th>Estado</th><th>Cambiar estado</th><th>Acción</th><th>1–9</th><th>10–49</th><th>50+</th></tr></thead><tbody>{rows.map((product) => {
        const available = isProductAvailable(inventory, product.id);
        return <tr key={product.id}>
          <td className="inventory-product" data-label="Producto"><strong>{product.brand}</strong><span>{product.model}{product.variant ? ` · ${product.variant}` : ""}</span></td>
          <td className="inventory-type" data-label="Tipo">{product.productType}</td>
          <td className="inventory-reference" data-label="Referencia"><code>{product.reference || "—"}</code></td>
          <td className="inventory-status" data-label="Estado"><span className={`inventory-badge ${available ? "available" : "unavailable"}`}>{available ? "Disponible" : "No disponible"}</span></td>
          <td className="inventory-change" data-label="Cambiar estado"><select className="availability-select" aria-label={`Disponibilidad de ${product.brand} ${product.model}`} value={String(drafts[product.id] ?? available)} onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: event.target.value === "true" }))}><option value="true">Disponible</option><option value="false">No disponible</option></select></td>
          <td className="inventory-action" data-label="Acción"><button type="button" className="stock-save" aria-label={`Guardar disponibilidad de ${product.brand} ${product.model}`} onClick={() => save(product)}>Guardar</button></td>
          <td className="inventory-price" data-label="1–9">{money(product.price1)}</td>
          <td className="inventory-price" data-label="10–49">{money(product.price2)}</td>
          <td className="inventory-price" data-label="50+">{money(product.price3)}</td>
        </tr>;
      })}</tbody></table></div>
    </section>
  </>;
}
