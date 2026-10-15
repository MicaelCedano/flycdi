"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { PurchaseManager } from "@/components/admin/PurchaseManager";
import { useLocalCatalog } from "@/components/catalog/useLocalCatalog";
import { useLocalAccount } from "@/components/account/useLocalAccount";

export default function AdminPurchasesPage() {
  const { account, ready } = useLocalAccount();
  const { products, loading, error } = useLocalCatalog();
  if (!ready) return <main className="admin-shell"><div className="catalog-loading" aria-label="Comprobando acceso" /></main>;
  if (!account || account.role !== "admin") return <main className="admin-shell admin-locked"><div className="catalog-lock-icon"><LockKeyhole /></div><p>ACCESO RESTRINGIDO</p><h1>Inicia sesión como administrador</h1><span>El registro de compras solo está disponible para administración.</span><Link href="/">Ir al acceso de técnicos</Link></main>;

  return <main className="admin-shell">
    <header className="admin-header">
      <div><p>FLYCDI / ADMINISTRACIÓN</p><h1>Compras</h1><span className="admin-subtitle">Registra compras de proveedores desde un Excel o línea por línea.</span></div>
      <div className="admin-header-actions"><Link href="/admin">Volver al catálogo</Link><Link href="/">Ver tienda</Link></div>
    </header>
    {loading ? <div className="catalog-loading" aria-label="Cargando catálogo" /> : error ? <p role="alert">No se pudo cargar el catálogo de productos. Inténtalo de nuevo.</p> : <PurchaseManager account={account} products={products} />}
  </main>;
}
