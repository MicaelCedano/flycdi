import catalog from "@/data/catalog.json";
import { Storefront } from "@/components/storefront/Storefront";
import type { Product } from "@/lib/catalog";

export default function Home() {
  return <Storefront products={catalog as Product[]} />;
}
