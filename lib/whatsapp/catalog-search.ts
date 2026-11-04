export type CatalogProduct = { category: string; brand: string; model: string; product_type: string; variant: string | null; reference: string | null; available: boolean | null; price_3?: number | string | null };
export type CatalogQuery = { kind: "battery" | "screen" | "camera" | "charging" | null; model: string | null; brand: string | null; reference: string | null; variant: string | null; cameraSide: "frontal" | "trasera" | null; wantsPrice: boolean };

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
  const cameraSide = /\bfrontal\b|\bdelantera\b|\bselfie\b/.test(text) ? "frontal" : /\btrasera\b|\bposterior\b/.test(text) ? "trasera" : null;
  return { kind, model, brand, reference, variant, cameraSide, wantsPrice: /\bprecio\b|\bcuanto\b|\bcosto\b|\bcuesta\b/.test(text) };
}


// Carry context only when the new message clearly refers to the earlier product.
export function isCatalogFollowUp(question: string): boolean {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (text.length > 100 || !/\b(precio|cuesta|cuestan|cuanto|cuantos|cuantas|quedan|queda|disponible|disponibles|hay|tienen|tienes|existencia|existencias|costo|vale|sale|stock)\b/.test(text)) return false;
  const possibleNewProduct = parseCatalogQuestion("bateria " + text);
  return !possibleNewProduct?.model && !possibleNewProduct?.reference;
}

function isAcknowledgment(message: string): boolean {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return /^(gracias|muchas gracias|ok|okay|si|no|dale|bien|perfecto|entendido|esta bien|buenas|hola|buen dia|buenos dias|buenas tardes|buenas noches)$/.test(text);
}

export function resolveCatalogQuestion(question: string, previousMessages: string[]): CatalogQuery | null {
  const direct = parseCatalogQuestion(question);
  if (direct?.model || direct?.reference) return direct;
  if (!direct && !isCatalogFollowUp(question)) {
    // A model-only reply can complete an immediately preceding unfinished request.
    const modelOnly = question.length <= 60 ? parseCatalogQuestion("bateria " + question) : null;
    const last = previousMessages.find(message => !isAcknowledgment(message));
    const incomplete = last ? parseCatalogQuestion(last) : null;
    if (modelOnly?.model && incomplete?.kind && !incomplete.model && !incomplete.reference &&
        (!incomplete.brand || !modelOnly.brand || incomplete.brand === modelOnly.brand)) {
      return { ...incomplete, model: modelOnly.model, brand: modelOnly.brand ?? incomplete.brand,
        wantsPrice: modelOnly.wantsPrice || incomplete.wantsPrice };
    }
    return null;
  }
  const priceText = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const wantsPrice = !!direct?.wantsPrice || /\b(precio|cuesta|cuestan|costo|vale|sale)\b/.test(priceText) || (/\bcuanto\b/.test(priceText) && !/\b(quedan|queda|disponible|disponibles|hay)\b/.test(priceText));
  for (const previous of previousMessages) {
    const parsed = parseCatalogQuestion(previous);
    if (parsed) {
      if (!parsed.model && !parsed.reference) return direct;
      if (direct && (direct.kind !== parsed.kind || (direct.brand && direct.brand !== parsed.brand))) return direct;
      return { ...parsed, wantsPrice, variant: direct?.variant ?? parsed.variant, cameraSide: direct?.cameraSide ?? parsed.cameraSide };
    }
    if (!isCatalogFollowUp(previous) && !isAcknowledgment(previous)) return direct;
  }
  return direct;
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
    if (query.kind === "camera" && query.cameraSide && !category.includes(query.cameraSide)) return false;
    if (query.kind === "charging" && !category.includes("flex") && !category.includes("carga")) return false;
    if (model && !p.model.split("/").some(part => normalize(part.replace(/^ss\s+/i, "")) === model)) return false;
    if (query.variant && !normalize(p.variant ?? "").includes(query.variant) && !normalize(p.product_type).includes(query.variant)) return false;
    return true;
  });
}

export function formatCatalogResult(query: CatalogQuery, products: CatalogProduct[], truncated: boolean): string {
  if (!query.reference && !query.model) return "¡Claro! 😊 ¿Para qué modelo necesitas el repuesto?";
  if (products.length === 0) return truncated
    ? "Encontré muchos resultados. ¿Me dices la marca y el modelo exactos para buscar mejor?"
    : "No encontré ese repuesto en el catálogo. ¿Me confirmas la marca y el modelo exactos?";
  const describe = (p: CatalogProduct) => [p.product_type, p.brand, p.model].filter(Boolean).join(" ");
  const formatPrice = (p: CatalogProduct): string | null => {
    if (p.price_3 === null || p.price_3 === undefined || p.price_3 === "") return null;
    const amount = Number(p.price_3);
    return Number.isFinite(amount) && amount > 0 ? `RD$${new Intl.NumberFormat("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}` : null;
  };
  if (products.length === 1) {
    const p = products[0];
    const availability = p.available === false ? " En el catálogo aparece como no disponible." : "";
    const ref = query.reference && p.reference ? ` (ref. ${p.reference})` : "";
    if (query.wantsPrice) {
      const price = formatPrice(p);
      return price ? `El precio de ${p.product_type.toLocaleLowerCase("es")} para ${[p.brand, p.model].filter(Boolean).join(" ")}${ref} es ${price} 😊.${availability} La existencia física hay que confirmarla antes del pedido.` : `Encontré ${p.product_type.toLocaleLowerCase("es")} para ${[p.brand, p.model].filter(Boolean).join(" ")}${ref}, pero no tiene un precio válido registrado. Consulta directamente con FLYCDI.`;
    }
    return `Encontré ${p.product_type.toLocaleLowerCase("es")} para ${[p.brand, p.model].filter(Boolean).join(" ")}${ref} en nuestro catálogo 😊.${availability} La existencia física hay que confirmarla antes del pedido.`;
  }
  const shown = products.slice(0, 5).map(p => {
    const ref = p.reference ? ` (ref. ${p.reference})` : "";
    const variant = p.variant ? ` — ${p.variant}` : "";
    const availability = p.available === false ? " [no disponible en catálogo]" : "";
    const price = query.wantsPrice ? ` — ${formatPrice(p) ?? "precio no registrado"}` : "";
    return `• ${describe(p)}${ref}${variant}${price}${availability}`;
  }).join("\n");
  return `Encontré estas opciones en nuestro catálogo 😊:\n${shown}${products.length > 5 ? "\nHay más opciones; dime cuál buscas." : ""}\nLa existencia física hay que confirmarla antes del pedido.`;
}
