type ZipEntry = { method: number; size: number; offset: number };

async function readZipEntry(file: ArrayBuffer, entry: ZipEntry) {
  const bytes = new Uint8Array(file);
  const view = new DataView(file);
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const end = start + entry.size;
  const compressed = bytes.slice(start, end);
  if (entry.method === 0) return new TextDecoder().decode(compressed);
  if (entry.method !== 8) throw new Error("El archivo usa una compresión de Excel no compatible.");
  if (typeof DecompressionStream === "undefined") throw new Error("Este navegador no puede descomprimir el Excel. Prueba con Chrome o Edge actualizado.");
  try {
    const compressedBuffer = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
    const stream = new Blob([compressedBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error("No se pudo leer el Excel. Guárdalo de nuevo como .xlsx e inténtalo otra vez.");
  }
}

async function unzipXlsx(file: ArrayBuffer) {
  const bytes = new Uint8Array(file);
  const view = new DataView(file);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("El archivo no parece ser un Excel .xlsx válido.");
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("El archivo Excel está dañado.");
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    entries.set(name, { method, size, offset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return { entries, read: async (name: string) => {
    const entry = entries.get(name);
    return entry ? readZipEntry(file, entry) : null;
  } };
}

function parseXml(source: string, label: string) {
  const doc = new DOMParser().parseFromString(source, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error(`No se pudo interpretar ${label} dentro del Excel.`);
  return doc;
}

function columnNumber(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function normalizeTarget(path: string) {
  const parts: string[] = [];
  for (const part of path.replace(/^\//, "").split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

export async function readPurchaseWorkbook(file: File): Promise<Record<string, string>[]> {
  if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) throw new Error("Usa un archivo de Excel .xlsx. Los archivos .xls antiguos no son compatibles.");
  if (file.size > 15 * 1024 * 1024) throw new Error("El archivo supera el límite de 15 MB.");
  const zip = await unzipXlsx(await file.arrayBuffer());
  const workbookXml = await zip.read("xl/workbook.xml");
  const relsXml = await zip.read("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) throw new Error("El Excel no contiene una hoja de cálculo reconocible.");
  const workbook = parseXml(workbookXml, "la lista de hojas");
  const relationships = parseXml(relsXml, "las referencias de hojas");
  const sheet = workbook.getElementsByTagNameNS("*", "sheet")[0];
  const relationId = sheet?.getAttribute("r:id") ?? sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  if (!relationId) throw new Error("No se encontró una hoja de datos en el Excel.");
  const relation = [...relationships.getElementsByTagNameNS("*", "Relationship")].find((item) => item.getAttribute("Id") === relationId);
  const target = relation?.getAttribute("Target");
  if (!target) throw new Error("No se encontró la primera hoja del Excel.");
  const sheetPath = normalizeTarget(target.startsWith("/") ? target : `xl/${target}`);
  const sheetXml = await zip.read(sheetPath);
  if (!sheetXml) throw new Error("No se pudo abrir la primera hoja del Excel.");
  const sharedXml = await zip.read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...parseXml(sharedXml, "los textos de la hoja").getElementsByTagNameNS("*", "si")].map((item) =>
    [...item.getElementsByTagNameNS("*", "t")].map((node) => node.textContent ?? "").join("")
  ) : [];
  const document = parseXml(sheetXml, "los renglones de la hoja");
  const rows = [...document.getElementsByTagNameNS("*", "sheetData")[0]?.getElementsByTagNameNS("*", "row") ?? []].map((row) => {
    const values: string[] = [];
    for (const cell of [...row.getElementsByTagNameNS("*", "c")]) {
      const index = columnNumber(cell.getAttribute("r") ?? "A1");
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
      const inline = [...cell.getElementsByTagNameNS("*", "t")].map((node) => node.textContent ?? "").join("");
      values[index] = type === "s" ? shared[Number(raw)] ?? "" : type === "inlineStr" ? inline : raw;
    }
    return values;
  }).filter((row) => row.some((value) => value?.trim()));
  if (rows.length < 2) throw new Error("El Excel necesita una fila de encabezados y al menos una fila de productos.");
  const headers = Array.from({ length: rows[0].length }, (_, index) => (rows[0][index] ?? "").trim());
  const headerKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  const findHeader = (aliases: string[]) => headers.findIndex((header) => Boolean(header) && aliases.includes(headerKey(header)));
  const referenceIndex = findHeader(["referencia", "ref", "codigo", "sku", "productcode", "itemcode"]);
  const quantityIndex = findHeader(["cantidad", "qty", "quantity", "unidades", "cant"]);
  const costIndex = findHeader(["costounitario", "costounit", "unitcost", "cost", "costo", "preciocompra", "unitprice"]);
  if (referenceIndex < 0 || quantityIndex < 0 || costIndex < 0) {
    throw new Error("No encontré los encabezados necesarios. La hoja debe tener Referencia, Cantidad y Costo unitario.");
  }
  return rows.slice(1)
    .filter((row) => (row[referenceIndex] ?? "").trim())
    .map((row) => ({
      reference: row[referenceIndex] ?? "",
      quantity: row[quantityIndex] ?? "",
      unitCost: row[costIndex] ?? "",
    }));
}
