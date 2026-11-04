import { strict as assert } from "node:assert";
import { parseCatalogQuestion, searchCatalog, formatCatalogResult } from "../lib/whatsapp/catalog-search.ts";
const data = [
 { category: "Baterías", brand: "iPhone", model: "11", product_type: "Batería", variant: "11IP", reference: "FB0017", available: true },
 { category: "Baterías", brand: "iPhone", model: "11Pro", product_type: "Batería", variant: "11PRO", reference: "FB0018", available: true },
 { category: "Baterías", brand: "Samsung", model: "A20/A30/A50", product_type: "Batería", variant: "X", reference: "FB0059", available: false },
 { category: "Pantallas", brand: "Samsung", model: "A12", product_type: "Pantalla OLED", variant: "OLED", reference: "C1234", available: true },
];
const q = parseCatalogQuestion("Quedan baterías de iPhone 11?");
assert.equal(searchCatalog(data, q).length, 1);
assert.match(formatCatalogResult(q, searchCatalog(data, q), false), /FB0017/);
assert.doesNotMatch(formatCatalogResult(q, searchCatalog(data, q), false), /FB0018/);
assert.equal(searchCatalog(data, parseCatalogQuestion("bateria iphone 11 pro"))[0].reference, "FB0018");
assert.equal(searchCatalog(data, parseCatalogQuestion("bateria samsung a30"))[0].available, false);
assert.equal(searchCatalog(data, parseCatalogQuestion("pantalla a12 oled"))[0].reference, "C1234");
assert.equal(searchCatalog(data, parseCatalogQuestion("C1234"))[0].reference, "C1234");
assert.equal(searchCatalog(data, parseCatalogQuestion("pantalla a12 lcd")).length, 0);
assert.match(formatCatalogResult(parseCatalogQuestion("tienes bateria"), data, false), /modelo exacto/);
assert.equal(parseCatalogQuestion("Hola como estas"), null);

assert.equal(searchCatalog([{ category: "Cámaras traseras", brand: "iPhone", model: "11", product_type: "Cámara trasera", variant: "", reference: "", available: true }], parseCatalogQuestion("camara frontal iphone 11")).length, 0);
