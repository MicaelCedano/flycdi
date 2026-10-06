import { readFile, writeFile, mkdir } from "node:fs/promises";

const products = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const rows = products.map((product) => `(${[
  product.id,
  product.category,
  product.brand,
  product.model,
  product.productType,
  product.variant,
  product.reference,
].map(quote).join(", ")}, ${product.price1}, ${product.price2}, ${product.price3}, true, true)`);

const sql = `insert into public.products (
  id, category, brand, model, product_type, variant, reference,
  price_1, price_2, price_3, available, active
) values\n  ${rows.join(",\n  ")}\non conflict (id) do update set
  category = excluded.category,
  brand = excluded.brand,
  model = excluded.model,
  product_type = excluded.product_type,
  variant = excluded.variant,
  reference = excluded.reference,
  price_1 = excluded.price_1,
  price_2 = excluded.price_2,
  price_3 = excluded.price_3;\n`;

await mkdir(new URL("../supabase", import.meta.url), { recursive: true });
await writeFile(new URL("../supabase/seed.sql", import.meta.url), sql, "utf8");
console.log(`Generado supabase/seed.sql con ${products.length} productos.`);
