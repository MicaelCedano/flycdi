alter table public.profiles add column username text;

update public.profiles
set username = 'usuario_' || substr(replace(id::text, '-', ''), 1, 12)
where username is null;

alter table public.profiles alter column username set not null;
alter table public.profiles
  add constraint profiles_username_format_check
  check (username = lower(username) and username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

create unique index profiles_username_unique_idx on public.profiles (lower(username));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_username text;
begin
  new_username := lower(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'usuario_' || substr(replace(new.id::text, '-', ''), 1, 12)
  ));

  insert into public.profiles (id, username, name, shop_name, phone)
  values (
    new.id,
    new_username,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(trim(new.raw_user_meta_data ->> 'shop_name'), ''),
    coalesce(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;
