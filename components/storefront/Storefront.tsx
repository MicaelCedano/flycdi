"use client";

import Image from "next/image";
import { useDeferredValue, useMemo, useState } from "react";
import { Camera, ChevronRight, Home, LockKeyhole, Menu, Minus, PackageSearch, Plus, Search, ShoppingBag, Smartphone, Usb, UserRound, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { money, productName, tierPrice } from "@/lib/catalog";
import { AccountDrawer } from "@/components/account/AccountDrawer";
import { useLocalAccount } from "@/components/account/useLocalAccount";
import { useLocalInventory } from "@/components/inventory/useLocalInventory";
import { useLocalCatalog } from "@/components/catalog/useLocalCatalog";
import { isProductAvailable } from "@/lib/local-inventory";

type CartLine = { product: Product; quantity: number };
type Filters = { search: string; brand: string; model: string; category: string };
const ALL = "Todas";
const PAGE_SIZE = 12;

const imageByCategory: Record<Product["category"], string> = {
  Pantallas: "/assets/pantalla-iphone-13.png",
  "Cámaras traseras": "/assets/camara-iphone-13.png",
  "Flex pin de carga": "/assets/flex-samsung-a15.png",
};

export function Storefront() {
  const [filters, setFilters] = useState<Filters>({ search: "", brand: ALL, model: ALL, category: ALL });
  const [applied, setApplied] = useState(filters);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [orderNotice, setOrderNotice] = useState("");
  const localAccount = useLocalAccount();
  const { products, loading: catalogLoading, error: catalogError } = useLocalCatalog();
  const { inventory } = useLocalInventory();
  const hasCatalogAccess = localAccount.ready && Boolean(localAccount.account);
  const canPlaceOrders = localAccount.account?.role === "technician";
  const staffPath = localAccount.account?.role === "seller" ? "/ventas" : localAccount.account?.role === "admin" ? "/admin" : null;
  const deferredSearch = useDeferredValue(applied.search.trim().toLocaleLowerCase("es"));

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "es")), [products]);
  const models = useMemo(() => [...new Set(products.filter((p) => applied.brand === ALL || p.brand === applied.brand).map((p) => p.model))].sort((a, b) => a.localeCompare(b, "es", { numeric: true })), [products, applied.brand]);
  const filtered = useMemo(() => products.filter((p) => {
    const haystack = `${p.brand} ${p.model} ${p.productType} ${p.variant} ${p.reference}`.toLocaleLowerCase("es");
    return (!deferredSearch || haystack.includes(deferredSearch)) &&
      (applied.brand === ALL || p.brand === applied.brand) &&
      (applied.model === ALL || p.model === applied.model) &&
      (applied.category === ALL || p.category === applied.category);
  }), [products, deferredSearch, applied]);

  const applyFilters = (next = filters) => {
    setApplied(next);
    setVisible(PAGE_SIZE);
    document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
  };
  const setCategory = (category: string) => {
    const next = { ...filters, category };
    setFilters(next); setApplied(next); setVisible(PAGE_SIZE);
  };
  const addToCart = (product: Product) => {
    if (!canPlaceOrders) {
      setOrderNotice("Solo los clientes técnicos pueden crear pedidos.");
      window.setTimeout(() => setOrderNotice(""), 3500);
      return;
    }
    const available = isProductAvailable(inventory, product.id);
    if (!available) {
      setOrderNotice("Ese producto no está disponible en este momento.");
      window.setTimeout(() => setOrderNotice(""), 3500);
      return;
    }
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      return found ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };
  const updateQuantity = (id: string, delta: number) => setCart((current) => current.map((line) => line.product.id === id ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line));
  const setQuantity = (id: string, value: string) => {
    const quantity = Number.parseInt(value, 10);
    if (!Number.isFinite(quantity)) return;
    setCart((current) => current.map((line) => line.product.id === id ? { ...line, quantity: Math.max(1, quantity) } : line));
  };
  const total = cart.reduce((sum, line) => sum + tierPrice(line.product, line.quantity) * line.quantity, 0);
  const openAccount = () => { setCartOpen(false); setAccountOpen(true); };
  const openCatalog = () => {
    if (!hasCatalogAccess) { openAccount(); return; }
    document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
  };
  const confirmOrder = async () => {
    if (!localAccount.account) { openAccount(); return; }
    if (!canPlaceOrders) { setOrderNotice("Solo los clientes técnicos pueden crear pedidos."); return; }
    try {
      const order = await localAccount.saveOrder(cart.map(({ product, quantity }) => ({ productId: product.id, name: productName(product), reference: product.reference, quantity, unitPrice: tierPrice(product, quantity) })), total);
      setCart([]); setCartOpen(false); setOrderNotice(`Pedido ${order.id} guardado correctamente.`);
    } catch (error) {
      setOrderNotice(error instanceof Error ? error.message : "No se pudo confirmar el pedido.");
    }
    window.setTimeout(() => setOrderNotice(""), 3500);
  };
  const whatsappUrl = useMemo(() => {
    const lines = cart.map(({ product, quantity }) => `• ${quantity} x ${productName(product)}${product.reference ? ` (${product.reference})` : ""} — ${money(tierPrice(product, quantity))} c/u`);
    const message = encodeURIComponent(`Hola FLYCDI, deseo confirmar este pedido mayorista:\n\n${lines.join("\n")}\n\nTotal estimado: ${money(total)}`);
    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
    return `https://wa.me/${number || ""}?text=${message}`;
  }, [cart, total]);

  return (
    <>
      <header className="site-header">
        <div className="header-inner shell">
          <a className="brand" href="#inicio"><Image src="/assets/flycdi-logo.png" alt="FLYCDI" width={176} height={48} priority /></a>
          <button className="menu-button" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu /></button>
          <nav className={`nav-links ${menuOpen ? "mobile-open" : ""}`} aria-label="Navegación principal">
            <a href="#inicio">Inicio</a>{hasCatalogAccess ? <a href="#catalogo">Catálogo</a> : null}{staffPath ? <a href={staffPath}>{localAccount.account?.role === "seller" ? "Pedidos" : "Administración"}</a> : null}<a href="#calidades">Calidades</a><a href="#como-comprar">Cómo comprar</a><a href="#contacto">Contacto</a>
          </nav>
          <button className="account-button" onClick={openAccount}>{localAccount.account ? `Hola, ${localAccount.account.name.split(" ")[0]}` : "Iniciar sesión"}</button>
        </div>
      </header>

      <main>
        <section className="hero shell" id="inicio">
          <div className="hero-copy">
            <h1>Repuestos para celulares, <span>listos para tu negocio.</span></h1>
            <p>{hasCatalogAccess ? "411 referencias entre pantallas, cámaras y flex pin, con precios especiales por volumen." : "Catálogo y precios exclusivos para técnicos registrados y talleres autorizados."}</p>
            {hasCatalogAccess ? <form className="finder" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
              <label className="search-field"><Search aria-hidden="true" /><input type="search" placeholder="Busca por modelo, pieza o código" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label>
              <div className="finder-row">
                <label>Marca<select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value, model: ALL })}><option>{ALL}</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
                <label>Modelo<select value={filters.model} onChange={(e) => setFilters({ ...filters, model: e.target.value })}><option>{ALL}</option>{models.map((model) => <option key={model}>{model}</option>)}</select></label>
                <label>Tipo de pieza<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option>{ALL}</option><option>Pantallas</option><option>Cámaras traseras</option><option>Flex pin de carga</option></select></label>
                <button className="primary" type="submit">Buscar repuestos</button>
              </div>
            </form> : <div className="private-access-note"><LockKeyhole /><div><strong>Acceso privado para técnicos</strong><span>Inicia sesión o crea tu cuenta para consultar existencias y precios mayoristas.</span></div></div>}
            <div className="hero-actions"><button className="primary large" onClick={openCatalog}>{hasCatalogAccess ? "Ver catálogo" : "Iniciar sesión"}</button>{canPlaceOrders ? <button className="secondary large" onClick={() => setCartOpen(true)}>Pedido rápido</button> : staffPath ? <a className="secondary large" href={staffPath}>Ir a mi panel</a> : <button className="secondary large" onClick={openAccount}>Crear cuenta</button>}</div>
            <ul className="trust-list"><li><strong>411 referencias</strong><span>266 pantallas, 19 cámaras y 126 flex pin.</span></li><li><strong>Piezas probadas</strong><span>Control de calidad antes del despacho.</span></li><li><strong>Envíos a toda RD</strong><span>Despachos rápidos para tu taller.</span></li></ul>
          </div>
          <div className="hero-visual"><Image src="/assets/hero-piezas.png" alt="Pantallas, cámaras y flex pin para celulares" width={780} height={700} priority /><div className="quality-note"><span />Calidad que protege<br />la reputación de tu taller</div></div>
        </section>

        {hasCatalogAccess ? <section className="category-strip shell" aria-label="Categorías">
          {[[ALL, Smartphone, "Todo"], ["Pantallas", Smartphone, "Pantallas"], ["Cámaras traseras", Camera, "Cámaras traseras"], ["Flex pin de carga", Usb, "Flex pin de carga"]].map(([value, Icon, label]) => <button key={String(value)} className={`category ${applied.category === value ? "active" : ""}`} onClick={() => setCategory(String(value))}><Icon size={20} />{String(label)}</button>)}
        </section> : null}

        <section className="catalog shell" id="catalogo">
          {!localAccount.ready ? <div className="catalog-loading" aria-label="Comprobando acceso" /> : hasCatalogAccess ? <>
            <div className="mobile-catalog-head"><div><span>CATÁLOGO PRIVADO</span><strong>Hola, {localAccount.account?.name.split(" ")[0]}</strong></div>{canPlaceOrders ? <button onClick={() => setCartOpen(true)}><ShoppingBag /><span>{cart.reduce((n, line) => n + line.quantity, 0)}</span></button> : null}</div>
            {catalogLoading ? <div className="catalog-loading" aria-label="Cargando inventario" /> : catalogError ? <div className="empty-state" role="alert">No se pudo conectar con el catálogo. Intenta de nuevo en unos segundos.</div> : <>
            <form className="mobile-catalog-filters" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
              <label className="search-field"><Search aria-hidden="true" /><input type="search" placeholder="Modelo, pieza o código" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label>
              <div><label>Marca<select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value, model: ALL })}><option>{ALL}</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label><label>Modelo<select value={filters.model} onChange={(e) => setFilters({ ...filters, model: e.target.value })}><option>{ALL}</option>{models.map((model) => <option key={model}>{model}</option>)}</select></label></div>
              <button className="primary" type="submit">Buscar en inventario</button>
            </form>
            <div className="section-heading"><div><p className="section-index">CATÁLOGO / 01</p><h2>Inventario para tu taller</h2></div><p>{filtered.length} {filtered.length === 1 ? "referencia encontrada" : "referencias encontradas"}</p></div>
            <div className="products">
              {filtered.slice(0, visible).map((product) => <ProductCard key={product.id} product={product} available={isProductAvailable(inventory, product.id)} canOrder={canPlaceOrders} onAdd={() => addToCart(product)} />)}
            </div>
            {!products.length && <div className="empty-state">El catálogo todavía no tiene productos cargados.</div>}
            {products.length > 0 && !filtered.length && <div className="empty-state">No encontramos piezas con esos filtros. Prueba otro modelo, tipo o referencia.</div>}
            {visible < filtered.length && <button className="load-more" onClick={() => setVisible((n) => n + PAGE_SIZE)}>Ver más productos <ChevronRight size={18} /></button>}
            </>}
          </> : <div className="catalog-lock"><div className="catalog-lock-icon"><LockKeyhole /></div><p>CATÁLOGO PRIVADO</p><h2>Inicia sesión para ver productos y precios</h2><span>El inventario mayorista está reservado para técnicos registrados y talleres autorizados.</span><button className="primary large" onClick={openAccount}>Iniciar sesión</button><small>¿Eres nuevo? También puedes crear tu cuenta desde el acceso.</small></div>}
        </section>

        <section className="quality-section" id="calidades"><div className="shell quality-grid"><div className="quality-intro"><p className="section-index light">CALIDADES / 02</p><h2>Elige la pantalla según tu cliente.</h2><p>No todas las reparaciones necesitan la misma pieza. Compara margen, imagen y durabilidad antes de ordenar.</p></div><div className="quality-table"><div className="quality-row heading"><span>Calidad</span><span>Ideal para</span><span>Precio</span></div><div className="quality-row"><span><b>LCD / HD+</b><small>Línea económica</small></span><span>Reparaciones de volumen</span><strong>$</strong></div><div className="quality-row featured"><span><b>Soft OLED</b><small>Flexible y delgada</small></span><span>Calidad premium</span><strong>$$$</strong></div><div className="quality-row"><span><b>OLED ORG</b><small>Calidad original</small></span><span>Reparaciones exigentes</span><strong>$$$$</strong></div></div></div></section>
        <section className="steps shell" id="como-comprar"><div className="section-heading"><div><p className="section-index">PROCESO / 03</p><h2>Del catálogo a tu taller.</h2></div></div><div className="step-list"><article><span>01</span><h3>Arma tu lista</h3><p>Busca por modelo, selecciona calidad y agrega las cantidades que necesitas.</p></article><article><span>02</span><h3>Recibe tu precio</h3><p>El descuento cambia automáticamente según el volumen de cada referencia.</p></article><article><span>03</span><h3>Confirma por WhatsApp</h3><p>Un asesor valida inventario, pago y despacho antes de cerrar el pedido.</p></article></div></section>
        <section className="cta-section" id="contacto"><div className="shell cta-inner"><div><h2>¿Vas a surtir tu taller?</h2><p>Prepara un pedido mixto y recibe una cotización mayorista.</p></div>{canPlaceOrders ? <button className="white-button" onClick={() => setCartOpen(true)}>Crear pedido rápido <ChevronRight /></button> : staffPath ? <a className="white-button" href={staffPath}>Ir a mi panel <ChevronRight /></a> : <button className="white-button" onClick={openAccount}>Iniciar sesión <ChevronRight /></button>}</div></section>
      </main>
      <footer><div className="shell footer-inner"><Image src="/assets/flycdi-logo.png" alt="FLYCDI" width={150} height={41} /><p>Repuestos para celulares al por mayor · República Dominicana</p><p>© 2026 FLYCDI</p></div></footer>

      <aside className={`cart-drawer ${cartOpen ? "open" : ""}`} aria-hidden={!cartOpen}>
        <div className="drawer-head"><div><small>PEDIDO MAYORISTA</small><h2>Tu cotización</h2></div><button aria-label="Cerrar" onClick={() => setCartOpen(false)}><X /></button></div>
        <div className="cart-items">{!cart.length ? <p className="cart-empty">Agrega piezas del catálogo para comenzar.</p> : cart.map(({ product, quantity }) => <article className="cart-item" key={product.id}><div><h3>{productName(product)}</h3><button onClick={() => setCart((current) => current.filter((line) => line.product.id !== product.id))}>Quitar</button></div><div className="qty-row"><div className="qty-control"><button aria-label={`Restar una unidad de ${productName(product)}`} onClick={() => updateQuantity(product.id, -1)}><Minus /></button><input aria-label={`Cantidad de ${productName(product)}`} type="number" inputMode="numeric" min={1} step={1} value={quantity} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setQuantity(product.id, event.target.value)} /><button aria-label={`Sumar una unidad de ${productName(product)}`} onClick={() => updateQuantity(product.id, 1)}><Plus /></button></div><strong>{money(tierPrice(product, quantity) * quantity)}</strong></div></article>)}</div>
        <div className="drawer-total"><span>Total estimado</span><strong>{money(total)}</strong><small>La disponibilidad se valida al confirmar el pedido.</small><button className="submit-order" disabled={!cart.length} onClick={confirmOrder}>{localAccount.account ? "Confirmar pedido" : "Iniciar sesión para pedir"}</button><a className={cart.length ? "cart-whatsapp" : "cart-whatsapp disabled"} href={cart.length ? whatsappUrl : undefined} target="_blank" rel="noreferrer">Consultar por WhatsApp</a></div>
      </aside>
      <AccountDrawer open={accountOpen} account={localAccount.account} orders={localAccount.orders} onClose={() => setAccountOpen(false)} onRegister={localAccount.register} onLogin={localAccount.login} onLogout={localAccount.logout} onRefreshOrders={localAccount.refreshOrders} />
      {canPlaceOrders ? <button className="floating-cart" aria-label="Abrir carrito" onClick={() => setCartOpen(true)}><ShoppingBag /><span>{cart.reduce((n, line) => n + line.quantity, 0)}</span></button> : null}
      <nav className="mobile-bottom-nav" aria-label="Navegación móvil"><a href="#inicio"><Home />Inicio</a>{hasCatalogAccess ? <a href="#catalogo"><PackageSearch />Catálogo</a> : <button onClick={openAccount}><LockKeyhole />Catálogo</button>}{canPlaceOrders ? <button onClick={() => { setAccountOpen(false); setCartOpen(true); }}><ShoppingBag />Pedido</button> : staffPath ? <a href={staffPath}><PackageSearch />Panel</a> : <button onClick={openAccount}><ShoppingBag />Pedido</button>}<button onClick={openAccount}><UserRound />Mi cuenta</button></nav>
      {orderNotice ? <div className="order-notice" role="status"><PackageSearch />{orderNotice}</div> : null}
      {(cartOpen || accountOpen) ? <button className="overlay open" aria-label="Cerrar panel" onClick={() => { setCartOpen(false); setAccountOpen(false); }} /> : null}
    </>
  );
}

function ProductCard({ product, available, canOrder, onAdd }: { product: Product; available: boolean; canOrder: boolean; onAdd: () => void }) {
  const buttonLabel = !canOrder ? "Solo para clientes técnicos" : available ? "Agregar al pedido" : "No disponible";
  return <article className="product-card"><div className="product-image"><Image src={imageByCategory[product.category]} alt={productName(product)} width={420} height={330} /></div><div className="product-info"><div className={`stock ${available ? "available" : "unavailable"}`}><i /> {available ? "Disponible" : "No disponible"}</div><h3>{productName(product)}</h3><p className="spec">{[product.productType, product.variant].filter(Boolean).join(" · ")}</p><p className="sku">{product.reference ? `Referencia: ${product.reference}` : "Referencia no indicada"}</p><div className="price"><strong>{money(product.price1)}</strong><span>/ unidad</span></div><div className="tiers"><span>1–9 <b>{money(product.price1)}</b></span><span>10–49 <b>{money(product.price2)}</b></span><span>50+ <b>{money(product.price3)}</b></span></div><button className="add-button" disabled={!canOrder || !available} onClick={onAdd}>{buttonLabel}{canOrder && available ? <Plus /> : null}</button></div></article>;
}
