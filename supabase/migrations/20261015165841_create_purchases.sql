create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier text not null default '',
  invoice_number text not null default '',
  purchase_date date not null default current_date,
  total numeric(14, 2) not null default 0 check (total >= 0),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  product_name text not null,
  reference text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  line_total numeric(16, 2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

create index purchases_created_at_idx on public.purchases(created_at desc);
create index purchase_items_purchase_id_idx on public.purchase_items(purchase_id);

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

create policy purchases_select_admin on public.purchases
for select to authenticated
using (private.current_role() = 'admin');

create policy purchases_insert_admin on public.purchases
for insert to authenticated
with check (private.current_role() = 'admin' and created_by = (select auth.uid()));

create policy purchases_update_admin on public.purchases
for update to authenticated
using (private.current_role() = 'admin')
with check (private.current_role() = 'admin' and created_by = (select auth.uid()));

create policy purchase_items_select_admin on public.purchase_items
for select to authenticated
using (private.current_role() = 'admin');

create policy purchase_items_insert_admin on public.purchase_items
for insert to authenticated
with check (private.current_role() = 'admin');

grant select, insert on public.purchase_items to authenticated;
grant select, insert, update on public.purchases to authenticated;

create function public.create_purchase(
  p_supplier text,
  p_invoice_number text,
  p_purchase_date date,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  new_purchase_id uuid;
  requested record;
  product_row public.products;
  item_quantity integer;
  item_cost numeric(14, 2);
  purchase_total numeric(14, 2) := 0;
begin
  if actor_id is null or private.current_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede registrar compras.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto a la compra.';
  end if;

  insert into public.purchases (supplier, invoice_number, purchase_date, created_by)
  values (coalesce(trim(p_supplier), ''), coalesce(trim(p_invoice_number), ''), coalesce(p_purchase_date, current_date), actor_id)
  returning id into new_purchase_id;

  for requested in
    select value ->> 'product_id' as product_id,
           value ->> 'quantity' as quantity,
           value ->> 'unit_cost' as unit_cost
    from jsonb_array_elements(p_items)
  loop
    if coalesce(requested.product_id, '') = '' or coalesce(requested.quantity, '') !~ '^[1-9][0-9]*$'
      or coalesce(requested.unit_cost, '') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'Revisa el producto, la cantidad y el costo de cada línea.';
    end if;

    item_quantity := requested.quantity::integer;
    item_cost := requested.unit_cost::numeric(14, 2);
    select * into product_row
    from public.products
    where id = requested.product_id;
    if not found then
      raise exception 'Uno de los productos ya no existe en el catálogo.';
    end if;

    insert into public.purchase_items (purchase_id, product_id, product_name, reference, quantity, unit_cost)
    values (
      new_purchase_id,
      product_row.id,
      product_row.brand || ' ' || product_row.model || case when product_row.variant = '' then '' else ' · ' || product_row.variant end,
      product_row.reference,
      item_quantity,
      item_cost
    );
    purchase_total := purchase_total + (item_quantity * item_cost);
  end loop;

  update public.purchases set total = purchase_total where id = new_purchase_id;
  return new_purchase_id;
end;
$$;

revoke all on function public.create_purchase(text, text, date, jsonb) from public, anon;
grant execute on function public.create_purchase(text, text, date, jsonb) to authenticated;

comment on table public.purchases is 'Registro de compras de proveedores ingresadas manualmente o desde Excel.';
comment on column public.purchase_items.product_name is 'Nombre del producto guardado como estaba al registrar la compra.';
