alter table public.profiles
  add column approved boolean not null default false;

-- Keep staff access; technicians remain pending until the team reviews them.
update public.profiles set approved = (role in ('admin', 'seller'));

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and approved;
$$;

revoke all on function private.current_role() from public, anon;
grant execute on function private.current_role() to authenticated;

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and private.current_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede cambiar roles.';
  end if;
  if new.approved is distinct from old.approved and private.current_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede habilitar cuentas.';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
for select to authenticated
using ((active and private.current_role() is not null) or private.current_role() = 'admin');

drop policy if exists orders_select_owner_or_staff on public.orders;
create policy orders_select_owner_or_staff on public.orders
for select to authenticated
using (
  private.current_role() is not null and (
    customer_id = (select auth.uid()) or private.current_role() in ('admin', 'seller')
  )
);

drop policy if exists order_items_select_owner_or_staff on public.order_items;
create policy order_items_select_owner_or_staff on public.order_items
for select to authenticated
using (
  private.current_role() is not null and exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (orders.customer_id = (select auth.uid()) or private.current_role() in ('admin', 'seller'))
  )
);

create or replace function private.require_approved_order_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_role() is null then
    raise exception 'La cuenta no está habilitada para gestionar pedidos.';
  end if;
  return new;
end;
$$;

revoke all on function private.require_approved_order_actor() from public, anon, authenticated;
create trigger require_approved_order_actor_before_write
before insert or update on public.orders
for each row execute function private.require_approved_order_actor();

comment on column public.profiles.approved is 'Cuenta habilitada por revisión manual del equipo FLYCDI.';
