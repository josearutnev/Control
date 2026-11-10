-- Hogar: control de gastos de una pareja.
-- Supabase → SQL Editor → New query → pegar este archivo completo → Run.
-- Pensado para un proyecto vacío. Si una parte ya existe, el script la reemplaza
-- cuando puede (funciones y políticas). Las tablas no se borran.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency_code text not null default 'DOP',
  timezone text not null default 'America/Santo_Domingo',
  locale text not null default 'es-DO',
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  slug text,
  kind text not null default 'household' check (kind in ('supermarket', 'household', 'both')),
  is_system boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete restrict,
  name text not null,
  normalized_name text not null,
  default_unit text not null default 'unidad',
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  description text not null,
  category_id uuid references public.expense_categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  paid_by uuid references public.household_members (id) on delete set null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  expense_type text not null default 'fijo' check (expense_type in ('fijo', 'variable', 'extraordinario')),
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_on date not null,
  description text not null,
  category_id uuid references public.expense_categories (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  paid_by uuid references public.household_members (id) on delete set null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  expense_type text not null default 'variable' check (expense_type in ('fijo', 'variable', 'extraordinario')),
  notes text,
  receipt_path text,
  source text not null default 'manual' check (source in ('manual', 'shopping')),
  recurring_id uuid references public.recurring_expenses (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  expense_id uuid not null unique references public.expenses (id) on delete cascade,
  store_name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_trip_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null references public.shopping_trips (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  notes text
);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  event_type text not null check (event_type in ('purchased', 'depleted')),
  occurred_on date not null,
  shopping_trip_item_id uuid references public.shopping_trip_items (id) on delete cascade,
  quantity numeric(12, 3),
  unit text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_on date not null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  member_id uuid references public.household_members (id) on delete set null,
  kind text not null default 'hogar' check (kind in ('aporte', 'hogar', 'extraordinario')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  year int not null check (year >= 2000),
  month int not null check (month between 1 and 12),
  category_id uuid references public.expense_categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0)
);

create unique index if not exists budgets_total_unique
  on public.budgets (household_id, year, month)
  where category_id is null;

create unique index if not exists budgets_category_unique
  on public.budgets (household_id, year, month, category_id)
  where category_id is not null;

create index if not exists expenses_household_date_idx
  on public.expenses (household_id, occurred_on desc);

create index if not exists incomes_household_date_idx
  on public.incomes (household_id, occurred_on desc);

create index if not exists items_trip_idx
  on public.shopping_trip_items (trip_id);

create index if not exists items_product_idx
  on public.shopping_trip_items (product_id);

create index if not exists events_product_idx
  on public.product_events (product_id, occurred_on);

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.random_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.seed_household(hid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.expense_categories (household_id, name, slug, kind, is_system, sort_order)
  values
    (hid, 'Supermercado', 'supermercado', 'supermarket', true, 1),
    (hid, 'Restaurantes y salidas', 'salidas', 'household', false, 2),
    (hid, 'Entretenimiento', 'entretenimiento', 'household', false, 3),
    (hid, 'Hogar y muebles', 'hogar', 'household', false, 4),
    (hid, 'Electrodomésticos', 'electrodomesticos', 'household', false, 5),
    (hid, 'Reparaciones y mantenimiento', 'reparaciones', 'household', false, 6),
    (hid, 'Servicios', 'servicios', 'household', false, 7),
    (hid, 'Transporte', 'transporte', 'household', false, 8),
    (hid, 'Salud', 'salud', 'household', false, 9),
    (hid, 'Personal', 'personal', 'household', false, 10),
    (hid, 'Viajes', 'viajes', 'household', false, 11),
    (hid, 'Otros', 'otros', 'household', false, 12);

  insert into public.product_categories (household_id, name, sort_order)
  values
    (hid, 'Carnes y pollo', 1),
    (hid, 'Pescados y mariscos', 2),
    (hid, 'Frutas', 3),
    (hid, 'Vegetales', 4),
    (hid, 'Lácteos', 5),
    (hid, 'Bebidas', 6),
    (hid, 'Desayuno', 7),
    (hid, 'Limpieza del hogar', 8),
    (hid, 'Higiene personal', 9),
    (hid, 'Productos de cocina', 10),
    (hid, 'Alimentos no perecederos', 11),
    (hid, 'Otros', 12);

  insert into public.payment_methods (household_id, name, sort_order)
  values
    (hid, 'Efectivo', 1),
    (hid, 'Tarjeta', 2),
    (hid, 'Transferencia', 3),
    (hid, 'Otro', 4);
end;
$$;

create or replace function public.create_household(household_name text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  code text;
  tries int := 0;
begin
  if uid is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  if exists (
    select 1 from public.household_members
    where user_id = uid and status = 'active'
  ) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  if length(trim(coalesce(member_name, ''))) < 2 then
    raise exception 'Escribe tu nombre';
  end if;
  if length(trim(coalesce(household_name, ''))) < 2 then
    household_name := 'Nuestro hogar';
  end if;

  loop
    tries := tries + 1;
    code := public.random_invite_code();
    exit when not exists (select 1 from public.households where invite_code = code);
    if tries > 8 then
      raise exception 'No se pudo crear el código';
    end if;
  end loop;

  insert into public.households (name, invite_code, created_by)
  values (trim(household_name), code, uid)
  returning id into hid;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (hid, uid, trim(member_name), 'owner');

  perform public.seed_household(hid);
  return hid;
end;
$$;

create or replace function public.join_household(code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  normalized text := upper(trim(coalesce(code, '')));
  people int;
begin
  if uid is null then
    raise exception 'Necesitas iniciar sesión';
  end if;
  if exists (
    select 1 from public.household_members
    where user_id = uid and status = 'active'
  ) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  if length(trim(coalesce(member_name, ''))) < 2 then
    raise exception 'Escribe tu nombre';
  end if;

  select id into hid from public.households where invite_code = normalized;
  if hid is null then
    raise exception 'Código incorrecto';
  end if;

  select count(*) into people
  from public.household_members
  where household_id = hid and status = 'active';

  if people >= 2 then
    raise exception 'Ese hogar ya tiene dos personas';
  end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (hid, uid, trim(member_name), 'member');

  return hid;
end;
$$;

create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  new_code text;
  tries int := 0;
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión';
  end if;

  select household_id into hid
  from public.household_members
  where user_id = auth.uid() and status = 'active'
  limit 1;

  if hid is null then
    raise exception 'No perteneces a un hogar';
  end if;

  loop
    tries := tries + 1;
    new_code := public.random_invite_code();
    exit when not exists (select 1 from public.households where invite_code = new_code);
    if tries > 8 then
      raise exception 'No se pudo crear el código';
    end if;
  end loop;

  update public.households set invite_code = new_code where id = hid;
  return new_code;
end;
$$;

create or replace function public.can_read_receipt(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folder text;
begin
  folder := (storage.foldername(object_name))[1];
  if folder is null or folder !~* '^[0-9a-f-]{36}$' then
    return false;
  end if;
  return public.is_household_member(folder::uuid);
end;
$$;

create or replace function public.lock_household()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.household_id := old.household_id;
  end if;
  return new;
end;
$$;

create or replace function public.guard_created()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    return new;
  end if;
  new.household_id := old.household_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function public.guard_expense()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_at := now();
    return new;
  end if;
  new.household_id := old.household_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.source := old.source;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.random_invite_code() from public, anon, authenticated;
revoke all on function public.seed_household(uuid) from public, anon, authenticated;
revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
revoke all on function public.regenerate_invite_code() from public, anon;
revoke all on function public.can_read_receipt(text) from public, anon;
revoke all on function public.lock_household() from public, anon;
revoke all on function public.guard_created() from public, anon;
revoke all on function public.guard_expense() from public, anon;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.can_read_receipt(text) to authenticated;
grant execute on function public.lock_household() to authenticated;
grant execute on function public.guard_created() to authenticated;
grant execute on function public.guard_expense() to authenticated;

grant usage on schema public to authenticated;

revoke all on table
  public.households,
  public.household_members,
  public.expense_categories,
  public.product_categories,
  public.payment_methods,
  public.products,
  public.recurring_expenses,
  public.expenses,
  public.shopping_trips,
  public.shopping_trip_items,
  public.product_events,
  public.incomes,
  public.budgets
from anon, authenticated;

grant select on table public.households to authenticated;
grant update (name) on table public.households to authenticated;

grant select on table public.household_members to authenticated;
grant update (display_name) on table public.household_members to authenticated;

grant select, insert, update, delete on table
  public.expense_categories,
  public.product_categories,
  public.payment_methods,
  public.products,
  public.recurring_expenses,
  public.expenses,
  public.shopping_trips,
  public.shopping_trip_items,
  public.product_events,
  public.incomes,
  public.budgets
to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.expense_categories enable row level security;
alter table public.product_categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.products enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.expenses enable row level security;
alter table public.shopping_trips enable row level security;
alter table public.shopping_trip_items enable row level security;
alter table public.product_events enable row level security;
alter table public.incomes enable row level security;
alter table public.budgets enable row level security;

drop policy if exists households_select on public.households;
drop policy if exists households_update on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

drop policy if exists members_select on public.household_members;
drop policy if exists members_update on public.household_members;
create policy members_select on public.household_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));
create policy members_update on public.household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists expense_categories_all on public.expense_categories;
create policy expense_categories_all on public.expense_categories
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists product_categories_all on public.product_categories;
create policy product_categories_all on public.product_categories
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists payment_methods_all on public.payment_methods;
create policy payment_methods_all on public.payment_methods
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists products_all on public.products;
create policy products_all on public.products
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists recurring_all on public.recurring_expenses;
create policy recurring_all on public.recurring_expenses
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists trips_all on public.shopping_trips;
create policy trips_all on public.shopping_trips
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists items_all on public.shopping_trip_items;
create policy items_all on public.shopping_trip_items
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists events_all on public.product_events;
create policy events_all on public.product_events
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists incomes_all on public.incomes;
create policy incomes_all on public.incomes
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists budgets_all on public.budgets;
create policy budgets_all on public.budgets
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Disparadores
-- ---------------------------------------------------------------------------

drop trigger if exists expenses_guard on public.expenses;
create trigger expenses_guard
  before insert or update on public.expenses
  for each row execute function public.guard_expense();

drop trigger if exists products_guard on public.products;
create trigger products_guard
  before insert or update on public.products
  for each row execute function public.guard_created();

drop trigger if exists incomes_guard on public.incomes;
create trigger incomes_guard
  before insert or update on public.incomes
  for each row execute function public.guard_created();

drop trigger if exists events_guard on public.product_events;
create trigger events_guard
  before insert or update on public.product_events
  for each row execute function public.guard_created();

drop trigger if exists recurring_guard on public.recurring_expenses;
create trigger recurring_guard
  before insert or update on public.recurring_expenses
  for each row execute function public.guard_created();

drop trigger if exists categories_lock on public.expense_categories;
create trigger categories_lock
  before update on public.expense_categories
  for each row execute function public.lock_household();

drop trigger if exists product_categories_lock on public.product_categories;
create trigger product_categories_lock
  before update on public.product_categories
  for each row execute function public.lock_household();

drop trigger if exists methods_lock on public.payment_methods;
create trigger methods_lock
  before update on public.payment_methods
  for each row execute function public.lock_household();

drop trigger if exists trips_lock on public.shopping_trips;
create trigger trips_lock
  before update on public.shopping_trips
  for each row execute function public.lock_household();

drop trigger if exists items_lock on public.shopping_trip_items;
create trigger items_lock
  before update on public.shopping_trip_items
  for each row execute function public.lock_household();

drop trigger if exists budgets_lock on public.budgets;
create trigger budgets_lock
  before update on public.budgets
  for each row execute function public.lock_household();

-- ---------------------------------------------------------------------------
-- Comprobantes y avisos en vivo
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_select on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_update on storage.objects;
drop policy if exists receipts_delete on storage.objects;

create policy receipts_select on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.can_read_receipt(name));

create policy receipts_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_read_receipt(name));

create policy receipts_update on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and public.can_read_receipt(name))
  with check (bucket_id = 'receipts' and public.can_read_receipt(name));

create policy receipts_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and public.can_read_receipt(name));

alter table public.expenses replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception
  when others then
    raise notice 'Realtime no quedó activo: %', sqlerrm;
end $$;
