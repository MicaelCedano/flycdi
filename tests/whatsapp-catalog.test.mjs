import { strict as assert } from "node:assert";
import { parseCatalogQuestion, resolveCatalogQuestion, searchCatalog, formatCatalogResult } from "../lib/whatsapp/catalog-search.ts";
const data = [
 { category: "Baterías", brand: "iPhone", model: "11", product_type: "Batería", variant: "11IP", reference: "FB0017", available: true },
 { category: "Baterías", brand: "iPhone", model: "11Pro", product_type: "Batería", variant: "11PRO", reference: "FB0018", available: true },
 { category: "Baterías", brand: "Samsung", model: "A20/A30/A50", product_type: "Batería", variant: "X", reference: "FB0059", available: false },
 { category: "Pantallas", brand: "Samsung", model: "A12", product_type: "Pantalla OLED", variant: "OLED", reference: "C1234", available: true },
];
const q = parseCatalogQuestion("Quedan baterías de iPhone 11?");
assert.equal(searchCatalog(data, q).length, 1);
assert.match(formatCatalogResult(q, searchCatalog(data, q), false), /batería para iPhone 11/);
assert.doesNotMatch(formatCatalogResult(q, searchCatalog(data, q), false), /11Pro/);
assert.equal(searchCatalog(data, parseCatalogQuestion("bateria iphone 11 pro"))[0].reference, "FB0018");
assert.equal(searchCatalog(data, parseCatalogQuestion("bateria samsung a30"))[0].available, false);
assert.equal(searchCatalog(data, parseCatalogQuestion("pantalla a12 oled"))[0].reference, "C1234");
assert.equal(searchCatalog(data, parseCatalogQuestion("C1234"))[0].reference, "C1234");
assert.equal(searchCatalog(data, parseCatalogQuestion("pantalla a12 lcd")).length, 0);
assert.match(formatCatalogResult(parseCatalogQuestion("tienes bateria"), data, false), /modelo/);
assert.equal(parseCatalogQuestion("Hola como estas"), null);

assert.equal(searchCatalog([{ category: "Cámaras traseras", brand: "iPhone", model: "11", product_type: "Cámara trasera", variant: "", reference: "", available: true }], parseCatalogQuestion("camara frontal iphone 11")).length, 0);

assert.match(formatCatalogResult(parseCatalogQuestion("bateria samsung a30"), [data[2]], false), /no disponible/);
assert.match(formatCatalogResult(q, searchCatalog(data, q), false), /existencia física/);

const context = resolveCatalogQuestion("¿Qué precio tiene?", ["iPhone 11 bateria"]);
assert.equal(context.model, "11");
assert.equal(context.kind, "battery");
assert.equal(context.wantsPrice, true);
assert.match(formatCatalogResult(context, searchCatalog(data, context), false), /batería para iPhone 11/);
assert.match(formatCatalogResult(context, searchCatalog(data, context), false), /no tiene un precio válido registrado/);
assert.equal(resolveCatalogQuestion("¿Quedan?", ["qué precio tiene", "iPhone 11 bateria"]).model, "11");
assert.equal(resolveCatalogQuestion("¿Qué precio tiene?", ["Háblame de otra cosa", "iPhone 11 bateria"]), null);
assert.equal(resolveCatalogQuestion("¿Qué precio tiene el Samsung A30?", ["iPhone 11 bateria"]), null);
assert.equal(resolveCatalogQuestion("¿Qué precio tiene?", []), null);
assert.equal(resolveCatalogQuestion("batería iphone 11 pro", ["pantalla a12"]).model, "11 pro");

assert.equal(resolveCatalogQuestion("¿Cuántos quedan?", ["iPhone 11 bateria"]).wantsPrice, false);

const priced = { ...data[0], price_3: 250.5 };
assert.match(formatCatalogResult(context, [priced], false), /RD\$250[.,]5/);
assert.doesNotMatch(formatCatalogResult(q, [priced], false), /RD\$/);
assert.match(formatCatalogResult(context, [{...priced, price_3: 0}], false), /no tiene un precio válido registrado/);
assert.match(formatCatalogResult(context, [{...priced, price_3: null}], false), /no tiene un precio válido registrado/);
assert.match(formatCatalogResult(context, [{...priced, price_3: "no es precio"}], false), /no tiene un precio válido registrado/);
const multi = formatCatalogResult(context, [priced, {...data[1], price_3: 700}], false);
assert.match(multi, /RD\$700/);
assert.match(multi, /FB0017/);
assert.match(multi, /FB0018/);

assert.equal(resolveCatalogQuestion("¿Qué precio tiene?", ["gracias", "batería iphone 11"]).model, "11");
assert.equal(resolveCatalogQuestion("¿Y la batería?", ["gracias", "batería iphone 11"]).model, "11");
assert.equal(resolveCatalogQuestion("¿Y la pantalla?", ["batería iphone 11"]).model, null);
assert.equal(resolveCatalogQuestion("¿qué precio tiene?", ["batería iphone 11 pro", "pantalla samsung a12"]).model, "11 pro");
assert.equal(resolveCatalogQuestion("iPhone 11", ["batería"]).kind, "battery");
assert.equal(resolveCatalogQuestion("iPhone 11", ["batería"]).model, "11");
assert.equal(resolveCatalogQuestion("iphone 11", ["pantalla"]).kind, "screen");
assert.equal(resolveCatalogQuestion("iphone 12", ["batería iphone 11"]), null);
assert.equal(resolveCatalogQuestion("¿Qué cuesta?", ["quiero hablar de otra cosa", "batería iphone 11"]), null);
assert.equal(resolveCatalogQuestion("¿Cuánto sale?", ["batería iphone 11"]).wantsPrice, true);
assert.equal(resolveCatalogQuestion("¿Cuántos quedan?", ["batería iphone 11"]).wantsPrice, false);
