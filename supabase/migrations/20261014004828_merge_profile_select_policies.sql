drop policy if exists profiles_select_seller_customers on public.profiles;
drop policy if exists profiles_select_self_or_admin on public.profiles;

create policy profiles_select_self_admin_or_seller_customers
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.current_role() = 'admin'
  or (
    private.current_role() = 'seller'
    and role = 'technician'
    and approved
  )
);