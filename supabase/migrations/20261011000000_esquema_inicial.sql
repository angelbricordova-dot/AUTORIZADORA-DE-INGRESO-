-- =====================================================================
-- Pescadores I · Autorizaciones — esquema inicial
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`).
--
-- Seguridad aplicada aquí (numeración de la lista de 20 puntos):
--  4  Row-Level Security en TODAS las tablas
--  6  Solo usuarios autenticados (anon no tiene ningún permiso)
--  7  Cada dueño ve y toca únicamente sus propios registros
--  8  owner_id / id / created_at no se pueden falsificar ni cambiar (triggers)
-- 11  Cuota de lecturas con IA por usuario (consume_ai_quota)
-- 13  Sin SQL dinámico: todo pasa por PostgREST/RPC parametrizados
-- 14  Validación con CHECK constraints (formatos, longitudes, rangos)
--  5  Retención mínima: purge_old_guest_data borra cédulas de estadías viejas
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- Fija el dueño en inserciones y bloquea cambios de campos protegidos.
create or replace function public.tg_protect_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Se requiere sesión' using errcode = '42501';
    end if;
    new.owner_id := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  else
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Perfil del propietario (datos que van en "Yo ____ CI ____")
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  cedula text not null default '' check (cedula ~ '^[0-9.]{0,12}$'),
  admin_whatsapp text not null default '' check (admin_whatsapp ~ '^\+?[0-9 ]{0,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.tg_protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.tg_protect_profile();

-- Crea el perfil automáticamente cuando se crea el usuario en Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Inmuebles (fase 1: el N°30; fase 2: catálogo de aliados)
-- ---------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  conjunto text not null default 'JDC Pescadores I' check (char_length(conjunto) between 1 and 80),
  unit text not null check (char_length(unit) between 1 and 20),
  nightly_usd numeric(10, 2) check (nightly_usd is null or nightly_usd between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);

create trigger properties_protect before insert or update on public.properties
  for each row execute function public.tg_protect_owner();

-- ---------------------------------------------------------------------
-- Reservas / estadías
-- ---------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  property_id uuid not null,
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  contact_phone text not null default '' check (contact_phone ~ '^\+?[0-9 ()-]{0,20}$'),
  channel text not null check (channel in ('airbnb', 'stay', 'marketplace', 'mercadolibre', 'instagram', 'whatsapp', 'directo', 'otro')),
  check_in date not null,
  check_out date not null,
  stay_type text not null default 'Alquiler Vacacional'
    check (stay_type in ('Familiar', 'Alquiler Fijo', 'Alquiler Vacacional', 'Mantenimiento', 'Otros')),
  status text not null default 'confirmada' check (status in ('tentativa', 'confirmada', 'cancelada')),
  total_usd numeric(10, 2) not null default 0 check (total_usd between 0 and 100000),
  paid_usd numeric(10, 2) not null default 0 check (paid_usd between 0 and 100000),
  auth_status text not null default 'pendiente' check (auth_status in ('pendiente', 'generada', 'enviada')),
  auth_sent_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (check_out - check_in <= 180),
  -- la propiedad debe ser del mismo dueño
  foreign key (owner_id, property_id) references public.properties (owner_id, id) on delete cascade,
  -- imposible guardar dos reservas CONFIRMADAS que se pisen en el mismo inmueble
  constraint reservations_no_overlap exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status = 'confirmada'),
  unique (owner_id, id)
);

create index reservations_owner_dates on public.reservations (owner_id, check_in);

create trigger reservations_protect before insert or update on public.reservations
  for each row execute function public.tg_protect_owner();

-- ---------------------------------------------------------------------
-- Personas autorizadas (máx. 7 por planilla)
-- ---------------------------------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reservation_id uuid not null,
  position smallint not null check (position between 1 and 7),
  full_name text not null check (char_length(full_name) between 2 and 120),
  cedula text check (cedula is null or cedula ~ '^[VE]?-?[0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}$'),
  is_minor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_minor or cedula is not null),
  foreign key (owner_id, reservation_id) references public.reservations (owner_id, id) on delete cascade,
  unique (reservation_id, position) deferrable initially deferred
);

create trigger guests_protect before insert or update on public.guests
  for each row execute function public.tg_protect_owner();

-- ---------------------------------------------------------------------
-- Vehículos (máx. 2 por planilla)
-- ---------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reservation_id uuid not null,
  position smallint not null check (position between 1 and 2),
  description text not null check (char_length(description) between 2 and 80),
  plate text not null check (plate ~ '^[A-Z0-9-]{5,10}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, reservation_id) references public.reservations (owner_id, id) on delete cascade,
  unique (reservation_id, position) deferrable initially deferred
);

create trigger vehicles_protect before insert or update on public.vehicles
  for each row execute function public.tg_protect_owner();

-- ---------------------------------------------------------------------
-- Uso de lectura con IA (rate limiting por usuario)
-- ---------------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_usage_user_time on public.ai_usage (user_id, created_at desc);

-- Devuelve true y registra el uso si el usuario no superó el límite de la última hora.
create or replace function public.consume_ai_quota(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 200);
begin
  if v_uid is null then
    raise exception 'Se requiere sesión' using errcode = '42501';
  end if;
  -- serializa por usuario para que dos llamadas simultáneas no se salten el límite
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  select count(*) into v_count
    from public.ai_usage
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_count >= v_limit then
    return false;
  end if;
  insert into public.ai_usage (user_id) values (v_uid);
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Guarda personas y vehículos de una planilla en una sola transacción.
-- security invoker: corre con los permisos (y RLS) del usuario que llama.
-- ---------------------------------------------------------------------
create or replace function public.save_authorization(
  p_reservation_id uuid,
  p_guests jsonb,
  p_vehicles jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_guests) <> 'array' or jsonb_array_length(p_guests) > 7 then
    raise exception 'Máximo 7 personas' using errcode = '22023';
  end if;
  if jsonb_typeof(p_vehicles) <> 'array' or jsonb_array_length(p_vehicles) > 2 then
    raise exception 'Máximo 2 vehículos' using errcode = '22023';
  end if;
  if not exists (select 1 from public.reservations where id = p_reservation_id) then
    raise exception 'Reserva no encontrada' using errcode = '42501';
  end if;

  delete from public.guests where reservation_id = p_reservation_id;
  delete from public.vehicles where reservation_id = p_reservation_id;

  insert into public.guests (reservation_id, position, full_name, cedula, is_minor)
  select p_reservation_id, x.ord::smallint, x.val->>'full_name', nullif(x.val->>'cedula', ''),
         coalesce((x.val->>'is_minor')::boolean, false)
    from jsonb_array_elements(p_guests) with ordinality as x(val, ord);

  insert into public.vehicles (reservation_id, position, description, plate)
  select p_reservation_id, x.ord::smallint, x.val->>'description', x.val->>'plate'
    from jsonb_array_elements(p_vehicles) with ordinality as x(val, ord);

  update public.reservations
     set auth_status = case when auth_status = 'pendiente' then 'generada' else auth_status end
   where id = p_reservation_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Retención: borra cédulas y placas de estadías que terminaron hace N días
-- ---------------------------------------------------------------------
create or replace function public.purge_old_guest_data(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
  v_n integer;
  v_days integer := greatest(coalesce(p_days, 60), 7);
begin
  delete from public.guests g
   using public.reservations r
   where g.reservation_id = r.id
     and r.check_out < current_date - v_days
     and (auth.uid() is null or r.owner_id = auth.uid());
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;

  delete from public.vehicles v
   using public.reservations r
   where v.reservation_id = r.id
     and r.check_out < current_date - v_days
     and (auth.uid() is null or r.owner_id = auth.uid());
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;

  delete from public.ai_usage where created_at < now() - interval '2 days';
  return v_deleted;
end;
$$;

-- Opcional (requiere la extensión pg_cron en Supabase → Database → Extensions):
-- select cron.schedule('purga-huespedes', '15 4 * * *', $$select public.purge_old_guest_data(60)$$);

-- ---------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.reservations enable row level security;
alter table public.guests enable row level security;
alter table public.vehicles enable row level security;
alter table public.ai_usage enable row level security;

alter table public.profiles force row level security;
alter table public.properties force row level security;
alter table public.reservations force row level security;
alter table public.guests force row level security;
alter table public.vehicles force row level security;
alter table public.ai_usage force row level security;

create policy "perfil: leer el propio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: editar el propio" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "inmuebles: dueño" on public.properties
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "reservas: dueño" on public.reservations
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "personas: dueño" on public.guests
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "vehiculos: dueño" on public.vehicles
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "ia: ver el propio uso" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Permisos: el rol anónimo no puede tocar nada; authenticated solo lo necesario
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
revoke all on all sequences in schema public from anon;

grant select, update (full_name, cedula, admin_whatsapp) on public.profiles to authenticated;
grant select, insert, update, delete on public.properties, public.reservations, public.guests, public.vehicles to authenticated;
grant select on public.ai_usage to authenticated;
grant execute on function public.consume_ai_quota(integer) to authenticated;
grant execute on function public.purge_old_guest_data(integer) to authenticated;
grant execute on function public.save_authorization(uuid, jsonb, jsonb) to authenticated;

-- Para que futuras tablas tampoco queden abiertas por defecto
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;
