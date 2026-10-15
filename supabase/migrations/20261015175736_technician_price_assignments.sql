alter table public.profiles
  add column price_tier smallint
  constraint profiles_price_tier_check check (price_tier in (1, 2, 3)),
  add constraint profiles_price_tier_technicians_check check (price_tier is null or role = 'technician');

comment on column public.profiles.price_tier is
  'Nivel de precio asignado por administración a un técnico. NULL conserva precios por volumen.';

create function private.enforce_admin_price_tier_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.price_tier is distinct from old.price_tier
    and private.current_role() is distinct from 'admin'::public.app_role then
    raise exception 'Solo administración puede asignar el nivel de precio de un técnico.';
  end if;
  return new;
end;
$$;

create trigger profiles_price_tier_admin_only
before update of price_tier on public.profiles
for each row execute function private.enforce_admin_price_tier_assignment();

create or replace function private.place_order(items jsonb)
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
  assigned_tier smallint;
  chosen_tier smallint;
  chosen_price numeric(12, 2);
  computed_total numeric(12, 2) := 0;
begin
  if current_user_id is null or private.current_role() <> 'technician' then
    raise exception 'Solo los clientes técnicos pueden crear pedidos.';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'El pedido debe contener al menos un producto.';
  end if;

  select price_tier into assigned_tier
  from public.profiles
  where id = current_user_id and role = 'technician' and approved;

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

    chosen_tier := coalesce(assigned_tier, case
      when requested.quantity >= 50 then 3
      when requested.quantity >= 10 then 2
      else 1
    end);
    chosen_price := case chosen_tier
      when 1 then product_row.price_1
      when 2 then product_row.price_2
      else product_row.price_3
    end;

    insert into public.order_items (
      order_id, product_id, product_name, reference, quantity, unit_price, price_tier
    ) values (
      created_order.id,
      product_row.id,
      case when product_row.category = 'Pantallas' then 'Pantalla' else product_row.product_type end ||
        ' ' || product_row.brand || ' ' || product_row.model,
      product_row.reference,
      requested.quantity,
      chosen_price,
      chosen_tier
    );

    computed_total := computed_total + (chosen_price * requested.quantity);
  end loop;

  update public.orders set total = computed_total where id = created_order.id returning * into created_order;
  return created_order;
end;
$$;

create or replace function private.create_staff_order(target_customer_id uuid, items jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_order public.orders;
  requested record;
  customer_exists boolean;
  assigned_tier smallint;
  product_row public.products;
  requested_quantity integer;
  requested_tier smallint;
  chosen_price numeric(12, 2);
  computed_total numeric(12, 2) := 0;
begin
  if actor_id is null or private.current_role() not in ('seller', 'admin') then
    raise exception 'Solo ventas y administración pueden registrar pedidos.';
  end if;

  select price_tier into assigned_tier
  from public.profiles
  where id = target_customer_id and role = 'technician' and approved;
  customer_exists := found;
  if not customer_exists then
    raise exception 'Selecciona un técnico registrado y habilitado.';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Agrega al menos un producto al pedido.';
  end if;

  insert into public.orders (order_number, customer_id, status, managed_by)
  values (
    'FLY-' || to_char(now() at time zone 'America/Santo_Domingo', 'YYMMDD') || '-' ||
      lpad(nextval('public.order_number_sequence')::text, 4, '0'),
    target_customer_id,
    'confirmed',
    actor_id
  )
  returning * into created_order;

  for requested in
    select value ->> 'product_id' as product_id,
           value ->> 'quantity' as quantity,
           value ->> 'price_tier' as price_tier
    from jsonb_array_elements(items)
  loop
    if requested.product_id is null
      or requested.quantity is null
      or requested.quantity !~ '^[1-9][0-9]*$'
      or requested.price_tier is null
      or requested.price_tier not in ('1', '2', '3') then
      raise exception 'Cada producto necesita cantidad y nivel de precio válidos.';
    end if;

    requested_quantity := requested.quantity::integer;
    requested_tier := coalesce(assigned_tier, requested.price_tier::smallint);

    select * into product_row
    from public.products
    where id = requested.product_id and active and available
    for share;

    if not found then
      raise exception 'El producto % no está disponible.', requested.product_id;
    end if;

    chosen_price := case requested_tier
      when 1 then product_row.price_1
      when 2 then product_row.price_2
      else product_row.price_3
    end;

    insert into public.order_items (
      order_id, product_id, product_name, reference, quantity, unit_price, price_tier
    ) values (
      created_order.id,
      product_row.id,
      case when product_row.category = 'Pantallas' then 'Pantalla' else product_row.product_type end ||
        ' ' || product_row.brand || ' ' || product_row.model,
      product_row.reference,
      requested_quantity,
      chosen_price,
      requested_tier
    );

    computed_total := computed_total + (chosen_price * requested_quantity);
  end loop;

  update public.orders set total = computed_total where id = created_order.id returning * into created_order;
  return created_order;
end;
$$;

comment on function private.place_order(jsonb) is
  'Crea pedidos de técnicos usando su nivel asignado cuando existe; de lo contrario aplica precio por cantidad.';
comment on function private.create_staff_order(uuid, jsonb) is
  'Crea pedidos para técnicos y hace cumplir su nivel de precio asignado cuando existe.';
