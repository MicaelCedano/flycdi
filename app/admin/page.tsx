"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { CatalogTable } from "@/components/admin/CatalogTable";
import { ProductCreator } from "@/components/admin/ProductCreator";
import { useLocalCatalog } from "@/components/catalog/useLocalCatalog";
import { useLocalAccount } from "@/components/account/useLocalAccount";

export default function AdminPage() {
  const { account, ready } = useLocalAccount();
  const { products, loading: catalogLoading, error: catalogError } = useLocalCatalog();
  if (!ready) return <main className="admin-shell"><div className="catalog-loading" aria-label="Comprobando acceso" /></main>;
  if (!account || account.role !== "admin") return <main className="admin-shell admin-locked"><div className="catalog-lock-icon"><LockKeyhole /></div><p>ACCESO RESTRINGIDO</p><h1>Inicia sesión como administrador</h1><span>El catálogo administrativo no está disponible para visitantes ni técnicos.</span><Link href="/">Ir al acceso de técnicos</Link></main>;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p>FLYCDI / ADMINISTRACIÓN</p><h1>Disponibilidad del catálogo</h1><span className="admin-subtitle">Todas las referencias están disponibles por defecto. Cambia solo las que ya no estén disponibles.</span></div>
        <div className="admin-header-actions"><Link href="/ventas">Supervisar pedidos</Link><Link href="/">Ver tienda</Link></div>
      </header>
      {catalogLoading ? <div className="catalog-loading" aria-label="Cargando catálogo" /> : catalogError ? <p role="alert">No se pudo cargar el catálogo. Inténtalo de nuevo.</p> : null}
      <ProductCreator products={products} account={account} />
      <CatalogTable products={products} account={account} />
    </main>
  );
}
