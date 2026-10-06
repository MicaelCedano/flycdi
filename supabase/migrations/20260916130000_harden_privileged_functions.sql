alter function public.place_order(jsonb) set schema private;
alter function public.change_order_status(uuid, public.order_status) set schema private;

revoke all on function private.place_order(jsonb) from public, anon;
revoke all on function private.change_order_status(uuid, public.order_status) from public, anon;
grant execute on function private.place_order(jsonb) to authenticated;
grant execute on function private.change_order_status(uuid, public.order_status) to authenticated;

create function public.place_order(items jsonb)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.place_order(items);
$$;

create function public.change_order_status(target_order_id uuid, next_status public.order_status)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.change_order_status(target_order_id, next_status);
$$;

revoke all on function public.place_order(jsonb) from public, anon;
revoke all on function public.change_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;
grant execute on function public.change_order_status(uuid, public.order_status) to authenticated;
