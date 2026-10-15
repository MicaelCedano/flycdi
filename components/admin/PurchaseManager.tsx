"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import type { AccountProfile } from "@/lib/account";
import type { Product } from "@/lib/catalog";
import { readPurchaseWorkbook } from "@/lib/purchase-excel";
import { createClient } from "@/lib/supabase/client";

type PurchaseLine = { productId: string; reference: string; quantity: string; unitCost: string };
type PurchaseHistoryItem = { id: string; supplier: string; invoice_number: string; purchase_date: string; total: number; purchase_items: { quantity: number }[] };

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function numberValue(value: string) {
  let clean = value.trim().replace(/[^\d,.-]/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.lastIndexOf(",") > clean.lastIndexOf(".") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (clean.includes(",")) {
    clean = /,\d{3}$/.test(clean) ? clean.replace(/,/g, "") : clean.replace(",", ".");
  }
  return Number(clean);
}

const emptyLine = (): PurchaseLine => ({ productId: "", reference: "", quantity: "1", unitCost: "" });
const purchaseMoney = (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace("DOP", "RD$");

export function PurchaseManager({ account, products }: { account: AccountProfile; products: Product[] }) {
  const [mode, setMode] = useState<"excel" | "manual">("excel");
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const productByReference = useMemo(() => new Map(products.map((product) => [product.reference.trim().toLocaleUpperCase(), product])), [products]);

  const loadHistory = useCallback(async () => {
    const { data, error: loadError } = await createClient()
      .from("purchases")
      .select("id, supplier, invoice_number, purchase_date, total, purchase_items(quantity)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (loadError) throw loadError;
    setHistory((data ?? []) as unknown as PurchaseHistoryItem[]);
  }, []);

  useEffect(() => {
    if (account.role === "admin") void loadHistory().catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial."));
  }, [account.role, loadHistory]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const imported = await readPurchaseWorkbook(file);
      const nextLines = imported.map((line) => {
        const reference = line.reference.trim().toLocaleUpperCase();
        const product = productByReference.get(reference);
        return { productId: product?.id ?? "", reference, quantity: line.quantity.trim(), unitCost: String(numberValue(line.unitCost)) };
      });
      setLines(nextLines);
      setFileName(file.name);
      setMode("excel");
      setNotice(`Leí ${nextLines.length} línea${nextLines.length === 1 ? "" : "s"}. Revisa las referencias, cantidades y costos antes de guardar.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo leer el Excel.");
    }
  };

  const changeLine = (index: number, patch: Partial<PurchaseLine>) => setLines((current) => current.map((line, lineIndex) => {
    if (lineIndex !== index) return line;
    const updated = { ...line, ...patch };
    if (patch.productId) {
      const product = products.find((candidate) => candidate.id === patch.productId);
      if (product) updated.reference = product.reference;
    }
    return updated;
  }));

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (index: number) => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (numberValue(line.unitCost) || 0), 0);
  const matchedLines = lines.filter((line) => line.productId);

  const save = async () => {
    setError("");
    setNotice("");
    if (account.role !== "admin") { setError("Solo un administrador puede registrar compras."); return; }
    if (!supplier.trim()) { setError("Escribe el proveedor de la compra."); return; }
    if (!purchaseDate) { setError("Selecciona la fecha de la compra."); return; }
    if (lines.length === 0) { setError("Agrega o importa al menos un producto."); return; }
    if (lines.some((line) => !line.productId || !Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0 || !Number.isFinite(numberValue(line.unitCost)) || numberValue(line.unitCost) < 0)) {
      setError("Completa el producto, la cantidad entera y el costo de cada línea. Las referencias sin coincidencia deben seleccionarse manualmente.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: saveError } = await createClient().rpc("create_purchase", {
        p_supplier: supplier.trim(),
        p_invoice_number: invoiceNumber.trim(),
        p_purchase_date: purchaseDate,
        p_items: lines.map((line) => ({ product_id: line.productId, quantity: Number(line.quantity), unit_cost: numberValue(line.unitCost).toFixed(2) })),
      });
      if (saveError) throw saveError;
      if (!data) throw new Error("No se confirmó el registro de la compra.");
      setNotice("La compra se guardó en el historial.");
      try {
        await loadHistory();
      } catch {
        setNotice("La compra se guardó, pero no se pudo actualizar el historial. Actualiza la página para verla.");
      }
      setLines([]);
      setSupplier("");
      setInvoiceNumber("");
      setPurchaseDate(today());
      setFileName("");
      setMode("excel");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la compra.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <section className="purchase-entry">
      <div className="purchase-entry-heading"><div><strong>Registrar compra</strong><span>Importa los artículos desde Excel o ingrésalos a mano.</span></div>
        <div className="purchase-mode" role="tablist" aria-label="Forma de ingresar la compra">
          <button type="button" role="tab" aria-selected={mode === "excel"} className={mode === "excel" ? "active" : ""} onClick={() => setMode("excel")}>Desde Excel</button>
          <button type="button" role="tab" aria-selected={mode === "manual"} className={mode === "manual" ? "active" : ""} onClick={() => { setMode("manual"); if (!lines.length) setLines([emptyLine()]); }}>Manual</button>
        </div>
      </div>
      <div className="purchase-meta">
        <label>Proveedor<input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Nombre del proveedor" /></label>
        <label>Número de factura <span>(opcional)</span><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Ej. INV-1024" /></label>
        <label>Fecha de compra<input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label>
      </div>
      {mode === "excel" ? <div className="purchase-upload"><label className="purchase-file"><FileSpreadsheet /><span>{fileName || "Seleccionar Excel .xlsx"}</span><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void onFile(event)} /></label><small>La primera hoja debe incluir Referencia, Cantidad y Costo unitario.</small></div> : null}
      {lines.length ? <div className="purchase-lines-wrap"><div className="purchase-lines-head"><strong>Productos de la compra</strong><button type="button" onClick={addLine}><Plus />Añadir producto</button></div>
        <div className="purchase-lines"><div className="purchase-line purchase-line-labels"><span>Referencia / producto</span><span>Cantidad</span><span>Costo unitario</span><span></span></div>
          {lines.map((line, index) => <div className="purchase-line" key={`${index}-${line.reference}`}>
            <label><span className="purchase-mobile-label">Referencia / producto</span><select aria-label={`Producto de línea ${index + 1}`} value={line.productId} onChange={(event) => changeLine(index, { productId: event.target.value })}><option value="">{line.reference ? `Sin coincidencia: ${line.reference}` : "Selecciona una referencia"}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.reference} · {product.brand} {product.model}{product.variant ? ` · ${product.variant}` : ""}</option>)}</select></label>
            <label><span className="purchase-mobile-label">Cantidad</span><input aria-label={`Cantidad de línea ${index + 1}`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => changeLine(index, { quantity: event.target.value })} /></label>
            <label><span className="purchase-mobile-label">Costo unitario</span><input aria-label={`Costo unitario de línea ${index + 1}`} type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => changeLine(index, { unitCost: event.target.value })} /></label>
            <button type="button" className="purchase-remove" aria-label={`Quitar línea ${index + 1}`} onClick={() => removeLine(index)}><Trash2 /></button>
          </div>)}
        </div>
        <div className="purchase-total"><span>{matchedLines.length} de {lines.length} líneas listas</span><strong>Total de compra: {purchaseMoney(total)}</strong></div>
      </div> : <p className="purchase-empty-lines">Selecciona un Excel o añade productos para empezar.</p>}
      {error ? <p className="purchase-error" role="alert">{error}</p> : null}
      {notice ? <p className="purchase-notice" role="status">{notice}</p> : null}
      <div className="purchase-actions"><button type="button" className="purchase-save" disabled={busy || !lines.length} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar compra"}</button></div>
    </section>
    <section className="purchase-history"><div className="purchase-history-heading"><div><strong>Historial de compras</strong><span>Las últimas 20 compras registradas</span></div><span>{history.length}</span></div>
      {history.length ? <div className="purchase-history-list">{history.map((purchase) => <article key={purchase.id} className="purchase-history-item"><div className="purchase-history-main"><strong>{purchase.supplier || "Proveedor sin nombre"}</strong><span>{purchase.purchase_date}{purchase.invoice_number ? ` · Factura ${purchase.invoice_number}` : ""}</span></div><div className="purchase-history-count">{purchase.purchase_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0} unidades</div><strong className="purchase-history-total">{purchaseMoney(Number(purchase.total))}</strong></article>)}</div> : <p className="purchase-empty-lines">Todavía no hay compras registradas.</p>}
    </section>
  </>;
}
