-- =====================================================================
-- Tu Día en Tucacas · equipo (Zuleika), pagos, garantías y efectivo
-- Ejecutar en Supabase → SQL Editor DESPUÉS de las tres migraciones anteriores.
--
--  * payments       cada pago de una estadía, con su método (efectivo $, pago móvil,
--                   transferencia, Zelle…) y quién lo recibió (Oniris o Zuleika).
--                   reservations.paid_usd pasa a ser la suma de los pagos.
--  * stay_ops       tareas de cada estadía (limpieza antes y después, llaves,
--                   lencería) y la garantía: cobrada, revisada y devuelta.
--  * cash_movements la caja de Zuleika: retiros de Oniris, gastos y ajustes.
--  * team_members   usuarios del equipo. Zuleika entra con su propio correo y solo
--                   ve lo necesario para trabajar: nunca cédulas, placas ni notas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Apartamentos: camas y baños (para el sitio y el catálogo)
-- ---------------------------------------------------------------------
alter table public.properties
  add column if not exists beds smallint check (beds is null or beds between 0 and 40),
  add column if not exists bathrooms smallint check (bathrooms is null or bathrooms between 0 and 20);

drop function if exists public.public_listings();
create function public.public_listings()
returns table (
  id uuid,
  kind text,
  title text,
  unit text,
  conjunto text,
  summary text,
  description text,
  capacity smallint,
  bedrooms smallint,
  beds smallint,
  bathrooms smallint,
  nightly_usd numeric,
  promo text,
  amenities text[],
  photos text[],
  contact_whatsapp text,
  airbnb_url text,
  instagram_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, coalesce(nullif(p.title, ''), p.name), p.unit, p.conjunto, p.summary, p.description,
         p.capacity, p.bedrooms, p.beds, p.bathrooms, p.nightly_usd, p.promo, p.amenities, p.photos,
         case when p.kind = 'propio' then p.contact_whatsapp else '' end,
         case when p.kind = 'propio' then p.airbnb_url else '' end,
         case when p.kind = 'propio' then p.instagram_url else '' end
    from public.properties p
   where p.published
   order by (p.kind = 'propio') desc, p.sort, p.created_at
   limit 50
$$;
revoke all on function public.public_listings() from public;
grant execute on function public.public_listings() to anon, authenticated;

-- Fotos y datos reales del N°30 (solo si todavía no se cargaron desde el panel)
update public.properties
set photos = case when photos = '{}' then array[
      '/fotos/n30-01-sala-comedor.jpg', '/fotos/n30-02-piscina.jpg', '/fotos/n30-03-sala.jpg', '/fotos/n30-04-cocina.jpg',
      '/fotos/n30-05-habitacion.jpg', '/fotos/n30-06-literas.jpg', '/fotos/n30-07-sala-sofa.jpg', '/fotos/n30-08-tv.jpg',
      '/fotos/n30-09-bano.jpg', '/fotos/n30-10-bano-2.jpg', '/fotos/n30-11-entrada.jpg', '/fotos/n30-12-piscina-noche.jpg'
    ] else photos end,
    summary = case when summary in ('', 'Hospedaje en el Conjunto Residencial Pescadores I, a minutos de la playa.')
      then 'Piso 1 en Pescadores I: comodidad real para 7 personas, a 5 minutos de los muelles.' else summary end,
    description = case when description = '' then
      'Ubicados en Res. Pescadores I (piso 1), ofrecemos comodidad real para 7 personas sin romper el presupuesto.' || chr(10) || chr(10) ||
      'Cero estrés: tanque de agua interno, no dependemos solo del edificio.' || chr(10) ||
      'Conectados: WiFi de fibra óptica de alta velocidad.' || chr(10) ||
      'Clima: aire acondicionado en todos los ambientes.' || chr(10) ||
      'Ubicación: a 5 minutos de los muelles y a 20 minutos en carro del Parque Nacional Morrocoy.' || chr(10) || chr(10) ||
      'Ideal para familias que quieren ahorrar para sus paseos a los cayos.'
      else description end,
    bedrooms = coalesce(bedrooms, 2),
    beds = coalesce(beds, 5),
    bathrooms = coalesce(bathrooms, 2),
    amenities = case when amenities = array['A minutos de la playa', 'Piscina', 'Áreas recreativas', 'WiFi', 'Seguridad', 'Servicio de agua']
      then array['Piscina', 'WiFi', 'Aire acondicionado', 'Tanque de agua propio', 'Cocina equipada', 'Estacionamiento', 'Televisión', 'Seguridad', 'Áreas recreativas', 'Cerca de los muelles']
      else amenities end
where kind = 'propio' and unit = '30';

-- ---------------------------------------------------------------------
-- Ajustes del dueño
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists staff_name text not null default 'Zuleika' check (char_length(staff_name) between 1 and 40),
  add column if not exists cash_alert_usd numeric(10, 2) not null default 300 check (cash_alert_usd between 0 and 100000),
  add column if not exists deposit_usd numeric(10, 2) not null default 100 check (deposit_usd between 0 and 10000);
grant update (staff_name, cash_alert_usd, deposit_usd) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Equipo
-- ---------------------------------------------------------------------
create table public.team_members (
  member_id uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  check (member_id <> owner_id)
);
create index team_members_owner on public.team_members (owner_id);

-- Dueño para quien trabaja el usuario actual (null si no es del equipo).
create or replace function public.staff_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select owner_id from public.team_members where member_id = auth.uid()
$$;

-- Oniris agrega a Zuleika por su correo (el usuario se crea antes en Supabase → Authentication).
create or replace function public.add_team_member(p_email text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_member uuid;
begin
  if v_owner is null or public.staff_owner() is not null then
    raise exception 'Solo el dueño puede agregar personas al equipo' using errcode = '42501';
  end if;
  if char_length(coalesce(trim(p_name), '')) not between 1 and 40 then
    raise exception 'Escribe el nombre (máximo 40 letras)' using errcode = '22023';
  end if;
  select id into v_member from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_member is null then
    raise exception 'No hay un usuario con ese correo. Créalo primero en Supabase → Authentication → Add user.' using errcode = 'P0002';
  end if;
  if v_member = v_owner then
    raise exception 'Ese es tu propio correo' using errcode = '22023';
  end if;
  if exists (select 1 from public.properties where owner_id = v_member) then
    raise exception 'Ese usuario ya administra apartamentos; usa otro correo para el equipo' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_members where member_id = v_member and owner_id <> v_owner) then
    raise exception 'Ese usuario ya trabaja con otro dueño' using errcode = '22023';
  end if;
  insert into public.team_members (member_id, owner_id, name) values (v_member, v_owner, trim(p_name))
  on conflict (member_id) do update set name = excluded.name;
end;
$$;

-- Lista del equipo con su correo (solo para el dueño).
create or replace function public.my_team()
returns table (member_id uuid, name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.member_id, t.name, u.email::text
    from public.team_members t join auth.users u on u.id = t.member_id
   where t.owner_id = auth.uid()
   order by t.created_at
$$;

-- Fija dueño y autor en las tablas que comparte con el equipo; impide cambiarlos.
create or replace function public.tg_team_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      -- desde el SQL Editor (esta misma migración) se respeta lo indicado; desde la app, nunca
      if current_user in ('anon', 'authenticated') then
        raise exception 'Se requiere sesión' using errcode = '42501';
      end if;
      return new;
    end if;
    new.owner_id := coalesce(public.staff_owner(), auth.uid());
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.owner_id := old.owner_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Pagos
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  reservation_id uuid not null,
  amount_usd numeric(10, 2) not null check (amount_usd > 0 and amount_usd <= 100000),
  method text not null check (method in ('efectivo_usd', 'pago_movil', 'transferencia', 'zelle', 'binance', 'efectivo_bs', 'tarjeta', 'otro')),
  received_by text not null default 'owner' check (received_by in ('owner', 'staff')),
  paid_on date not null default current_date,
  reference text not null default '' check (char_length(reference) <= 60),
  note text not null default '' check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (owner_id, reservation_id) references public.reservations (owner_id, id) on delete cascade
);
create index payments_reservation on public.payments (reservation_id);
create index payments_owner on public.payments (owner_id, paid_on);

create trigger payments_team before insert or update on public.payments
  for each row execute function public.tg_team_row();

-- Lo que registra Zuleika siempre queda como recibido por ella
create or replace function public.tg_payment_staff()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.staff_owner() is not null then
    new.received_by := 'staff';
  end if;
  return new;
end;
$$;
create trigger payments_staff before insert or update on public.payments
  for each row execute function public.tg_payment_staff();

-- paid_usd de la estadía = suma de sus pagos (nadie lo puede escribir a mano)
create or replace function public.tg_reservation_paid()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.paid_usd := coalesce((select sum(p.amount_usd) from public.payments p where p.reservation_id = new.id), 0);
  return new;
end;
$$;
create trigger reservations_paid before insert or update on public.reservations
  for each row execute function public.tg_reservation_paid();

create or replace function public.tg_payments_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- el trigger reservations_paid recalcula la suma
  if tg_op in ('UPDATE', 'DELETE') then
    update public.reservations set paid_usd = 0 where id = old.reservation_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.reservations set paid_usd = 0 where id = new.reservation_id;
  end if;
  return null;
end;
$$;
create trigger payments_sync after insert or update or delete on public.payments
  for each row execute function public.tg_payments_sync();

-- Lo que ya estaba marcado como pagado pasa a ser un pago "registrado antes"
insert into public.payments (owner_id, reservation_id, amount_usd, method, received_by, paid_on, note, created_by)
select r.owner_id, r.id, r.paid_usd, 'otro', 'owner', least(r.check_in, current_date), 'Registrado antes del detalle de pagos', r.owner_id
  from public.reservations r
 where r.paid_usd > 0
   and not exists (select 1 from public.payments p where p.reservation_id = r.id);

-- ---------------------------------------------------------------------
-- Tareas y garantía de cada estadía
-- ---------------------------------------------------------------------
create table public.stay_ops (
  reservation_id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  clean_before_at timestamptz,
  keys_at timestamptz,
  clean_after_at timestamptz,
  linens_at timestamptz,
  deposit_usd numeric(10, 2) not null default 100 check (deposit_usd between 0 and 10000),
  deposit_received_at timestamptz,
  deposit_returned_at timestamptz,
  deposit_returned_usd numeric(10, 2) check (deposit_returned_usd is null or deposit_returned_usd >= 0),
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deposit_returned_usd is null or deposit_returned_usd <= deposit_usd),
  check (deposit_returned_at is null or deposit_received_at is not null),
  foreign key (owner_id, reservation_id) references public.reservations (owner_id, id) on delete cascade
);

create trigger stay_ops_team before insert or update on public.stay_ops
  for each row execute function public.tg_team_row();

create or replace function public.tg_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger stay_ops_touch before insert or update on public.stay_ops
  for each row execute function public.tg_touch();

-- ---------------------------------------------------------------------
-- Caja de efectivo que guarda Zuleika
-- ---------------------------------------------------------------------
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- retiro y gasto restan; ajuste suma o resta según el signo
  kind text not null check (kind in ('retiro', 'gasto', 'ajuste')),
  amount_usd numeric(10, 2) not null check (amount_usd between -100000 and 100000 and amount_usd <> 0),
  happened_on date not null default current_date,
  note text not null default '' check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind = 'ajuste' or amount_usd > 0)
);
create index cash_movements_owner on public.cash_movements (owner_id, happened_on);

create trigger cash_movements_team before insert or update on public.cash_movements
  for each row execute function public.tg_team_row();

-- ---------------------------------------------------------------------
-- Lo que ve Zuleika de las estadías del apartamento propio: fechas, contacto y cuánto
-- falta por cobrar. Nunca cédulas, placas, notas privadas ni lo que pasa en los aliados.
-- ---------------------------------------------------------------------
create or replace function public.staff_board(p_from date, p_to date)
returns table (
  id uuid,
  unit text,
  property_name text,
  check_in date,
  check_out date,
  status text,
  contact_name text,
  contact_phone text,
  people integer,
  minors integer,
  total_usd numeric,
  paid_usd numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := coalesce(public.staff_owner(), auth.uid());
begin
  if v_owner is null then
    raise exception 'Se requiere sesión' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 200 then
    raise exception 'Rango inválido' using errcode = '22023';
  end if;
  return query
    select r.id, p.unit, coalesce(nullif(p.name, ''), p.title), r.check_in, r.check_out, r.status, r.contact_name, r.contact_phone,
           (select count(*)::integer from public.guests g where g.reservation_id = r.id),
           (select count(*)::integer from public.guests g where g.reservation_id = r.id and g.is_minor),
           r.total_usd, r.paid_usd
      from public.reservations r
      join public.properties p on p.id = r.property_id
     where r.owner_id = v_owner
       and p.kind = 'propio'
       and r.status <> 'cancelada'
       and r.check_out >= p_from
       and r.check_in <= p_to
     order by r.check_in
     limit 500;
end;
$$;

-- Garantía y aviso de retiro que fijó el dueño (para el panel del equipo).
create or replace function public.staff_settings()
returns table (deposit_usd numeric, cash_alert_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select p.deposit_usd, p.cash_alert_usd
    from public.profiles p
   where p.id = coalesce(public.staff_owner(), auth.uid())
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.team_members enable row level security;
alter table public.payments enable row level security;
alter table public.stay_ops enable row level security;
alter table public.cash_movements enable row level security;
alter table public.team_members force row level security;
alter table public.payments force row level security;
alter table public.stay_ops force row level security;
alter table public.cash_movements force row level security;

create policy "equipo: el dueño ve a su equipo" on public.team_members
  for select to authenticated using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));
create policy "equipo: el dueño quita personas" on public.team_members
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "pagos: dueño" on public.payments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "pagos: el equipo ve lo que recibió" on public.payments
  for select to authenticated
  using (owner_id = (select public.staff_owner()) and received_by = 'staff');
create policy "pagos: el equipo registra cobros" on public.payments
  for insert to authenticated
  with check (owner_id = (select public.staff_owner()) and received_by = 'staff');
create policy "pagos: el equipo corrige lo suyo del mismo día" on public.payments
  for delete to authenticated
  using (owner_id = (select public.staff_owner()) and created_by = (select auth.uid()) and created_at > now() - interval '1 day');

create policy "tareas: dueño y equipo" on public.stay_ops
  for select to authenticated
  using (owner_id = (select auth.uid()) or owner_id = (select public.staff_owner()));
create policy "tareas: dueño y equipo crean" on public.stay_ops
  for insert to authenticated
  with check (owner_id = (select auth.uid()) or owner_id = (select public.staff_owner()));
create policy "tareas: dueño y equipo marcan" on public.stay_ops
  for update to authenticated
  using (owner_id = (select auth.uid()) or owner_id = (select public.staff_owner()))
  with check (owner_id = (select auth.uid()) or owner_id = (select public.staff_owner()));
create policy "tareas: solo el dueño borra" on public.stay_ops
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "caja: dueño" on public.cash_movements
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "caja: el equipo ve la caja" on public.cash_movements
  for select to authenticated
  using (owner_id = (select public.staff_owner()));
create policy "caja: el equipo anota gastos" on public.cash_movements
  for insert to authenticated
  with check (owner_id = (select public.staff_owner()) and kind = 'gasto');
create policy "caja: el equipo corrige lo suyo del mismo día" on public.cash_movements
  for delete to authenticated
  using (owner_id = (select public.staff_owner()) and created_by = (select auth.uid()) and created_at > now() - interval '1 day');

-- Una persona del equipo no puede crear apartamentos, estadías ni planillas propias
create policy "equipo: sin apartamentos propios" on public.properties as restrictive
  for insert to authenticated with check ((select public.staff_owner()) is null);
create policy "equipo: sin estadías propias" on public.reservations as restrictive
  for insert to authenticated with check ((select public.staff_owner()) is null);
create policy "equipo: sin personas" on public.guests as restrictive
  for insert to authenticated with check ((select public.staff_owner()) is null);
create policy "equipo: sin vehículos" on public.vehicles as restrictive
  for insert to authenticated with check ((select public.staff_owner()) is null);

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on public.team_members, public.payments, public.stay_ops, public.cash_movements from anon;
grant select, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.payments, public.stay_ops, public.cash_movements to authenticated;

revoke all on function public.staff_owner() from public;
revoke all on function public.add_team_member(text, text) from public;
revoke all on function public.my_team() from public;
revoke all on function public.staff_board(date, date) from public;
revoke all on function public.staff_settings() from public;
grant execute on function public.staff_settings() to authenticated;
grant execute on function public.staff_owner() to authenticated;
grant execute on function public.add_team_member(text, text) to authenticated;
grant execute on function public.my_team() to authenticated;
grant execute on function public.staff_board(date, date) to authenticated;
