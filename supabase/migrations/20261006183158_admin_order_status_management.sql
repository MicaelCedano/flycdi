create or replace function private.change_order_status(
  target_order_id uuid,
  next_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_order public.orders;
begin
  if private.current_role() not in ('seller', 'admin') then
    raise exception 'Solo ventas y administración pueden actualizar pedidos.';
  end if;

  update public.orders
  set status = next_status,
      managed_by = (select auth.uid()),
      updated_at = now()
  where id = target_order_id
  returning * into changed_order;

  if changed_order.id is null then
    raise exception 'No encontramos ese pedido.';
  end if;

  return changed_order;
end;
$$;
