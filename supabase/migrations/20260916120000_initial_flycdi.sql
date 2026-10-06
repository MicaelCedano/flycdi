create type public.app_role as enum ('admin', 'seller', 'technician');
create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'ready', 'dispatched', 'cancelled');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'technician',
  name text not null,
  shop_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id text primary key,
  category text not null check (category in ('Pantallas', 'Cámaras traseras', 'Flex pin de carga')),
  brand text not null,
  model text not null,
  product_type text not null,
  variant text not null default '',
  reference text not null default '',
  price_1 numeric(12, 2) not null check (price_1 > 0),
  price_2 numeric(12, 2) not null check (price_2 > 0 and price_2 <= price_1),
  price_3 numeric(12, 2) not null check (price_3 > 0 and price_3 <= price_2),
  available boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.order_number_sequence;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.profiles(id),
  status public.order_status not null default 'pending',
  total numeric(12, 2) not null default 0 check (total >= 0),
  managed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  reference text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  created_at timestamptz not null default now()
);

create index orders_customer_id_created_at_idx on public.orders(customer_id, created_at desc);
create index orders_status_created_at_idx on public.orders(status, created_at desc);
create index order_items_order_id_idx on public.order_items(order_id);
create index products_active_available_idx on public.products(active, available);
create unique index products_reference_unique_idx on public.products(upper(reference))
where reference <> '';

create function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function private.current_role() from public, anon;
grant execute on function private.current_role() to authenticated;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, shop_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(trim(new.raw_user_meta_data ->> 'shop_name'), ''),
    coalesce(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.protect_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and private.current_role() <> 'admin' then
    raise exception 'Solo un administrador puede cambiar roles.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_profile_role_before_update
before update on public.profiles
for each row execute function private.protect_profile_role();

create function private.prepare_product_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by = (select auth.uid());
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.created_by = (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger prepare_product_before_write
before insert or update on public.products
for each row execute function private.prepare_product_write();

create function public.place_order(items jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_order public.orders;
  requested record;
  product_row public.products;
  chosen_price numeric(12, 2);
  computed_total numeric(12, 2) := 0;
begin
  if current_user_id is null or private.current_role() <> 'technician' then
    raise exception 'Solo los clientes técnicos pueden crear pedidos.';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'El pedido debe contener al menos un producto.';
  end if;

  insert into public.orders (order_number, customer_id)
  values (
    'FLY-' || to_char(now() at time zone 'America/Santo_Domingo', 'YYMMDD') || '-' ||
      lpad(nextval('public.order_number_sequence')::text, 4, '0'),
    current_user_id
  )
  returning * into created_order;

  for requested in
    select value ->> 'product_id' as product_id, sum((value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(items)
    group by value ->> 'product_id'
  loop
    if requested.product_id is null or requested.quantity is null or requested.quantity <= 0 then
      raise exception 'Cada cantidad debe ser un entero mayor que cero.';
    end if;

    select * into product_row
    from public.products
    where id = requested.product_id and active and available
    for share;

    if not found then
      raise exception 'El producto % no está disponible.', requested.product_id;
    end if;

    chosen_price := case
      when requested.quantity >= 50 then product_row.price_3
      when requested.quantity >= 10 then product_row.price_2
      else product_row.price_1
    end;

    insert into public.order_items (
      order_id, product_id, product_name, reference, quantity, unit_price
    ) values (
      created_order.id,
      product_row.id,
      case when product_row.category = 'Pantallas' then 'Pantalla' else product_row.product_type end ||
        ' ' || product_row.brand || ' ' || product_row.model,
      product_row.reference,
      requested.quantity,
      chosen_price
    );

    computed_total := computed_total + (chosen_price * requested.quantity);
  end loop;

  update public.orders set total = computed_total where id = created_order.id returning * into created_order;
  return created_order;
end;
$$;

revoke all on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;

create function public.change_order_status(target_order_id uuid, next_status public.order_status)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_order public.orders;
begin
  if private.current_role() <> 'seller' then
    raise exception 'Solo los vendedores pueden actualizar pedidos.';
  end if;

  update public.orders
  set status = next_status, managed_by = (select auth.uid()), updated_at = now()
  where id = target_order_id
  returning * into changed_order;

  if changed_order.id is null then
    raise exception 'No encontramos ese pedido.';
  end if;
  return changed_order;
end;
$$;

revoke all on function public.change_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.change_order_status(uuid, public.order_status) to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using (id = (select auth.uid()) or private.current_role() = 'admin');

create policy profiles_select_seller_customers on public.profiles
for select to authenticated
using (
  private.current_role() = 'seller' and
  exists (
    select 1 from public.orders
    where orders.customer_id = profiles.id
  )
);

create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (id = (select auth.uid()) or private.current_role() = 'admin')
with check (id = (select auth.uid()) or private.current_role() = 'admin');

create policy products_select_authenticated on public.products
for select to authenticated
using (active or private.current_role() = 'admin');

create policy products_insert_admin on public.products
for insert to authenticated
with check (private.current_role() = 'admin');

create policy products_update_admin on public.products
for update to authenticated
using (private.current_role() = 'admin')
with check (private.current_role() = 'admin');

create policy products_delete_admin on public.products
for delete to authenticated
using (private.current_role() = 'admin');

create policy orders_select_owner_or_staff on public.orders
for select to authenticated
using (
  customer_id = (select auth.uid()) or
  private.current_role() in ('admin', 'seller')
);

create policy order_items_select_owner_or_staff on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (orders.customer_id = (select auth.uid()) or private.current_role() in ('admin', 'seller'))
  )
);

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.orders, public.order_items to authenticated;

comment on function public.place_order(jsonb) is 'Crea un pedido técnico y calcula precios en el servidor; no confía en totales del navegador.';
comment on schema private is 'Funciones internas de autorización; no exponer mediante Data API.';
