export type CatalogProduct = { category: string; brand: string; model: string; product_type: string; variant: string | null; reference: string | null; available: boolean | null };
export type CatalogQuery = { kind: "battery" | "screen" | "camera" | "charging" | null; model: string | null; brand: string | null; reference: string | null; variant: string | null; wantsPrice: boolean };

export function normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

export function parseCatalogQuestion(question: string): CatalogQuery | null {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const reference = text.match(/\b(?:fb|c)\s*\d{3,6}\b/i)?.[0]?.replace(/\s/g, "") ?? null;
  const kind = /\bbater[iy]as?\b|\bpila\b/.test(text) ? "battery" : /\bpantallas?\b|\bdisplay\b|\bdisplays\b/.test(text) ? "screen" : /\bcamaras?\b/.test(text) ? "camera" : /\bflex\b|\bpin\s+de\s+carga\b|\bpuerto\s+de\s+carga\b/.test(text) ? "charging" : null;
  if (!kind && !reference) return null;
  const iphone = text.match(/\biphone\s*(\d{1,2}(?:\s*(?:pro\s*max|pro|plus|mini))?|xs\s*max|xr|xs|x|se(?:\s*2020)?)(?![a-z0-9])/i);
  const android = text.match(/\b([asm]\s*\d{1,3}[a-z]?(?:\s*(?:ultra|plus|core|5g|4g))?)(?![a-z0-9])/i);
  const model = iphone?.[1] ?? android?.[1] ?? null;
  const brand = iphone ? "iphone" : /\bsamsung\b|\bgalaxy\b/.test(text) ? "samsung" : /\bmotorola\b|\bmoto\b/.test(text) ? "motorola" : /\bxiaomi\b|\bredmi\b|\bpoco\b/.test(text) ? "xiaomi" : null;
  const variant = /\boled\b/.test(text) ? "oled" : /\blcd\b/.test(text) ? "lcd" : null;
  return { kind, model, brand, reference, variant, wantsPrice: /\bprecio\b|\bcuanto\b|\bcosto\b|\bcuesta\b/.test(text) };
}

export function searchCatalog(products: CatalogProduct[], query: CatalogQuery): CatalogProduct[] {
  const model = query.model ? normalize(query.model) : null;
  return products.filter(p => {
    if (query.reference && normalize(p.reference ?? "") !== normalize(query.reference)) return false;
    if (query.brand && normalize(p.brand) !== query.brand) return false;
    const category = normalize(p.category + " " + p.product_type);
    if (query.kind === "battery" && !category.includes("bater")) return false;
    if (query.kind === "screen" && !category.includes("pantalla")) return false;
    if (query.kind === "camera" && !category.includes("camara")) return false;
    if (query.kind === "charging" && !category.includes("flex") && !category.includes("carga")) return false;
    if (model && !p.model.split("/").some(part => normalize(part.replace(/^ss\s+/i, "")) === model)) return false;
    if (query.variant && !normalize(p.variant ?? "").includes(query.variant) && !normalize(p.product_type).includes(query.variant)) return false;
    return true;
  });
}

export function formatCatalogResult(query: CatalogQuery, products: CatalogProduct[], truncated: boolean): string {
  if (!query.reference && !query.model) return "¿De qué modelo exacto necesitas el repuesto? Por ejemplo: batería de iPhone 11 o pantalla Samsung A12.";
  if (products.length === 0) return truncated ? "La búsqueda es muy amplia para confirmarla. ¿Puedes indicarme la marca y el modelo exactos?" : "No encontré una coincidencia exacta en el catálogo de FLYCDI. ¿Puedes confirmar el modelo y el tipo de repuesto?";
  const shown = products.slice(0, 5).map(p => {
    const detail = [p.product_type, p.brand, p.model].filter(Boolean).join(" ");
    return `• ${detail}${p.reference ? ` (ref. ${p.reference})` : ""}${p.variant ? ` — ${p.variant}` : ""}: ${p.available === true ? "marcado disponible" : p.available === false ? "marcado no disponible" : "disponibilidad no indicada"}`;
  }).join("\n");
  return `En el catálogo de FLYCDI encontré:\n${shown}${products.length > 5 ? "\nHay más variantes; dime cuál necesitas." : ""}\nLa disponibilidad mostrada es la del catálogo; la cantidad y existencia física deben confirmarse.${query.wantsPrice ? " Para el precio, consulta con FLYCDI." : ""}`;
}
