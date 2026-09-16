const products = [...document.querySelectorAll('.product-card')];
const cart = [];
const cartDrawer = document.querySelector('#cart');
const overlay = document.querySelector('#overlay');
const toast = document.querySelector('#toast');

function filterProducts(category = document.querySelector('.category.active')?.dataset.category || 'all', shouldScroll = true) {
  const search = document.querySelector('#search').value.toLowerCase().trim();
  const brand = document.querySelector('#brand-filter').value;
  const model = document.querySelector('#model-filter').value;
  const type = document.querySelector('#type-filter').value;
  let visible = 0;
  products.forEach((product) => {
    const matches = (!search || product.dataset.name.toLowerCase().includes(search)) &&
      (brand === 'all' || product.dataset.brand === brand) &&
      (model === 'all' || product.dataset.model === model) &&
      (type === 'all' || product.dataset.type === type) &&
      (category === 'all' || product.dataset.type === category);
    product.hidden = !matches;
    if (matches) visible++;
  });
  document.querySelector('#result-count').textContent = `${visible} ${visible === 1 ? 'destacado visible' : 'destacados visibles'} de 411 referencias`;
  document.querySelector('#empty-state').hidden = visible !== 0;
  if (shouldScroll) document.querySelector('#catalogo').scrollIntoView({ behavior: 'smooth' });
}

document.querySelector('#finder').addEventListener('submit', (event) => { event.preventDefault(); filterProducts(); });
document.querySelector('#search').addEventListener('input', () => filterProducts(undefined, false));
document.querySelectorAll('.category').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.category').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  filterProducts(button.dataset.category);
}));

function openCart() { cartDrawer.classList.add('open'); overlay.classList.add('open'); cartDrawer.setAttribute('aria-hidden', 'false'); }
function closeCart() { cartDrawer.classList.remove('open'); overlay.classList.remove('open'); cartDrawer.setAttribute('aria-hidden', 'true'); }
document.querySelectorAll('[data-open-cart]').forEach((button) => button.addEventListener('click', openCart));
document.querySelector('#close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

function tierPrice(item) {
  return item.qty >= 50 ? item.p3 : item.qty >= 10 ? item.p2 : item.p1;
}

function money(value) {
  return `RD$${value.toLocaleString('en-US')}`;
}

function renderCart() {
  const root = document.querySelector('#cart-items');
  if (!cart.length) root.innerHTML = '<p class="cart-empty">Agrega piezas del catálogo para comenzar.</p>';
  else root.innerHTML = cart.map((item, index) => `<article class="cart-item"><div><h3>${item.name}</h3><button data-remove="${index}">Quitar</button></div><div class="qty-row"><div class="qty-control"><button data-minus="${index}">−</button><span>${item.qty}</span><button data-plus="${index}">+</button></div><strong>${money(tierPrice(item) * item.qty)}</strong></div></article>`).join('');
  const total = cart.reduce((sum, item) => sum + tierPrice(item) * item.qty, 0);
  document.querySelector('#cart-total').textContent = money(total);
  document.querySelector('#whatsapp-button').disabled = !cart.length;
  root.querySelectorAll('[data-plus]').forEach((b) => b.onclick = () => { cart[+b.dataset.plus].qty++; renderCart(); });
  root.querySelectorAll('[data-minus]').forEach((b) => b.onclick = () => { const i = +b.dataset.minus; cart[i].qty = Math.max(1, cart[i].qty - 1); renderCart(); });
  root.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => { cart.splice(+b.dataset.remove, 1); renderCart(); });
}

document.querySelectorAll('.add-button').forEach((button) => button.addEventListener('click', () => {
  const found = cart.find((item) => item.name === button.dataset.product);
  if (found) found.qty++;
  else cart.push({ name: button.dataset.product, p1: +button.dataset.p1, p2: +button.dataset.p2, p3: +button.dataset.p3, qty: 1 });
  renderCart();
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}));

document.querySelector('#whatsapp-button').addEventListener('click', () => {
  const lines = cart.map((item) => `• ${item.qty} x ${item.name} — ${money(tierPrice(item))} c/u`);
  const total = cart.reduce((sum, item) => sum + tierPrice(item) * item.qty, 0);
  const message = encodeURIComponent(`Hola FLYCDI, deseo confirmar este pedido mayorista:\n\n${lines.join('\n')}\n\nTotal estimado: ${money(total)}`);
  window.open(`https://wa.me/18095550147?text=${message}`, '_blank', 'noopener');
});

const menu = document.querySelector('.menu-button');
menu.addEventListener('click', () => {
  const nav = document.querySelector('.nav-links');
  const open = nav.classList.toggle('mobile-open');
  menu.setAttribute('aria-expanded', String(open));
});
