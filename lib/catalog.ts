export type Product = {
  id: string;
  category: "Pantallas" | "Cámaras traseras" | "Flex pin de carga";
  brand: string;
  model: string;
  productType: string;
  variant: string;
  reference: string;
  price1: number;
  price2: number;
  price3: number;
};

export const tierPrice = (product: Product, quantity: number) =>
  quantity >= 50 ? product.price3 : quantity >= 10 ? product.price2 : product.price1;

export const money = (value: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value).replace("DOP", "RD$");

export const productName = (product: Product) => {
  const label = product.category === "Pantallas" ? "Pantalla" : product.productType;
  return `${label} ${product.brand} ${product.model}`;
};
