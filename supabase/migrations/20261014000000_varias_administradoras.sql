-- =====================================================================
-- Tu Día en Tucacas · varias administradoras en el mismo panel
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261013000000_equipo_pagos.sql
--
-- Antes, cada usuario tenía su propio panel vacío. Ahora la cuenta que tiene los
-- datos (la "dueña" del panel) puede dar acceso a otras personas:
--   * administradora  ve y maneja TODO, igual que la dueña (Oniris, Angélica…)
--   * trabajo         solo el panel de Zuleika (como en la migración anterior)
-- Todas las políticas pasan a usar public.acting_owner(): el panel al que
-- pertenece quien entra.
-- =====================================================================

alter table public.team_members
  add column if not exists role text not null default 'staff' check (role in ('admin', 'staff'));

-- Panel al que pertenece el usuario: el de su dueña si es administradora, si no el propio.
create or replace function public.acting_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select owner_id from public.team_members where member_id = auth.uid() and role = 'admin'),
    auth.uid()
  )
$$;

-- Solo las personas de "trabajo" (Zuleika) quedan limitadas a su panel.
create or replace function public.staff_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select owner_id from public.team_members where member_id = auth.uid() and role = 'staff'
$$;

-- Quién soy en la app: dueña, administradora o trabajo.
create or replace function public.my_workspace()
returns table (owner_id uuid, role text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.owner_id, auth.uid()), coalesce(t.role, 'owner'), coalesce(t.name, '')
    from (select auth.uid() as uid) me
    left join public.team_members t on t.member_id = me.uid
   where me.uid is not null
$$;

-- ---------------------------------------------------------------------
-- Triggers: los registros nuevos quedan a nombre del panel, no de quien escribe
-- ---------------------------------------------------------------------
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
    new.owner_id := public.acting_owner();
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

create or replace function public.tg_team_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      if current_user in ('anon', 'authenticated') then
        raise exception 'Se requiere sesión' using errcode = '42501';
      end if;
      return new;
    end if;
    new.owner_id := coalesce(public.staff_owner(), public.acting_owner());
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
-- Políticas
-- ---------------------------------------------------------------------
drop policy if exists "perfil: leer el propio" on public.profiles;
drop policy if exists "perfil: editar el propio" on public.profiles;
create policy "perfil: leer el propio y el del panel" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or id = (select public.acting_owner()));
create policy "perfil: editar el del panel" on public.profiles
  for update to authenticated using (id = (select public.acting_owner())) with check (id = (select public.acting_owner()));

drop policy if exists "inmuebles: dueño" on public.properties;
create policy "inmuebles: panel" on public.properties
  for all to authenticated
  using (owner_id = (select public.acting_owner()))
  with check (owner_id = (select public.acting_owner()));

drop policy if exists "reservas: dueño" on public.reservations;
create policy "reservas: panel" on public.reservations
  for all to authenticated
  using (owner_id = (select public.acting_owner()))
  with check (owner_id = (select public.acting_owner()));

drop policy if exists "personas: dueño" on public.guests;
create policy "personas: panel" on public.guests
  for all to authenticated
  using (owner_id = (select public.acting_owner()))
  with check (owner_id = (select public.acting_owner()));

drop policy if exists "vehiculos: dueño" on public.vehicles;
create policy "vehiculos: panel" on public.vehicles
  for all to authenticated
  using (owner_id = (select public.acting_owner()))
  with check (owner_id = (select public.acting_owner()));

drop policy if exists "pagos: dueño" on public.payments;
create policy "pagos: panel" on public.payments
  for all to authenticated
  using (owner_id = (select public.acting_owner()))
  with check (owner_id = (select public.acting_owner()));

drop policy if exists "caja: dueño" on public.cash_movements;
create policy "caja: panel" on public.cash_movements
  for all to authenticated
  using (owner_id = (select public.acting_owner()))
  with check (owner_id = (select public.acting_owner()));

drop policy if exists "tareas: dueño y equipo" on public.stay_ops;
drop policy if exists "tareas: dueño y equipo crean" on public.stay_ops;
drop policy if exists "tareas: dueño y equipo marcan" on public.stay_ops;
drop policy if exists "tareas: solo el dueño borra" on public.stay_ops;
create policy "tareas: panel y equipo" on public.stay_ops
  for select to authenticated
  using (owner_id = (select public.acting_owner()) or owner_id = (select public.staff_owner()));
create policy "tareas: panel y equipo crean" on public.stay_ops
  for insert to authenticated
  with check (owner_id = (select public.acting_owner()) or owner_id = (select public.staff_owner()));
create policy "tareas: panel y equipo marcan" on public.stay_ops
  for update to authenticated
  using (owner_id = (select public.acting_owner()) or owner_id = (select public.staff_owner()))
  with check (owner_id = (select public.acting_owner()) or owner_id = (select public.staff_owner()));
create policy "tareas: solo el panel borra" on public.stay_ops
  for delete to authenticated using (owner_id = (select public.acting_owner()));

drop policy if exists "equipo: el dueño ve a su equipo" on public.team_members;
drop policy if exists "equipo: el dueño quita personas" on public.team_members;
create policy "equipo: el panel ve a su equipo" on public.team_members
  for select to authenticated using (owner_id = (select public.acting_owner()) or member_id = (select auth.uid()));
create policy "equipo: el panel quita personas" on public.team_members
  for delete to authenticated using (owner_id = (select public.acting_owner()) and (select public.staff_owner()) is null);

-- Fotos: la carpeta es la del panel
drop policy if exists "fotos: subir en su carpeta" on storage.objects;
drop policy if exists "fotos: borrar en su carpeta" on storage.objects;
create policy "fotos: subir en su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select public.acting_owner())::text);
create policy "fotos: borrar en su carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select public.acting_owner())::text);

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------
drop function if exists public.add_team_member(text, text);
create or replace function public.add_team_member(p_email text, p_name text, p_role text default 'staff')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.acting_owner();
  v_member uuid;
begin
  if auth.uid() is null or public.staff_owner() is not null then
    raise exception 'Solo quien administra el panel puede dar accesos' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'Tipo de acceso inválido' using errcode = '22023';
  end if;
  if char_length(coalesce(trim(p_name), '')) not between 1 and 40 then
    raise exception 'Escribe el nombre (máximo 40 letras)' using errcode = '22023';
  end if;
  select id into v_member from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_member is null then
    raise exception 'No hay un usuario con ese correo. Créalo primero en Supabase → Authentication → Add user.' using errcode = 'P0002';
  end if;
  if v_member = v_owner or v_member = auth.uid() then
    raise exception 'Esa persona ya tiene acceso a este panel' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_members where owner_id = v_member) then
    raise exception 'Esa persona tiene su propio panel con equipo; no se puede unir a este' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_members where member_id = v_member and owner_id <> v_owner) then
    raise exception 'Ese usuario ya trabaja en otro panel' using errcode = '22023';
  end if;
  if exists (select 1 from public.reservations where owner_id = v_member) then
    raise exception 'Ese usuario ya tiene estadías cargadas en su propio panel; usa otro correo' using errcode = '22023';
  end if;
  -- el apartamento vacío que se creó solo al entrar por primera vez ya no hace falta
  delete from public.properties where owner_id = v_member;
  insert into public.team_members (member_id, owner_id, name, role) values (v_member, v_owner, trim(p_name), p_role)
  on conflict (member_id) do update set name = excluded.name, role = excluded.role;
end;
$$;

drop function if exists public.my_team();
create function public.my_team()
returns table (member_id uuid, name text, email text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.member_id, t.name, u.email::text, t.role
    from public.team_members t join auth.users u on u.id = t.member_id
   where t.owner_id = public.acting_owner()
     and public.staff_owner() is null
   order by t.role, t.created_at
$$;

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
  v_owner uuid := coalesce(public.staff_owner(), public.acting_owner());
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

create or replace function public.staff_settings()
returns table (deposit_usd numeric, cash_alert_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select p.deposit_usd, p.cash_alert_usd
    from public.profiles p
   where p.id = coalesce(public.staff_owner(), public.acting_owner())
$$;

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
  v_owner uuid := public.acting_owner();
begin
  if auth.uid() is not null and public.staff_owner() is not null then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  delete from public.guests g
   using public.reservations r
   where g.reservation_id = r.id
     and r.check_out < current_date - v_days
     and (v_owner is null or r.owner_id = v_owner);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;

  delete from public.vehicles v
   using public.reservations r
   where v.reservation_id = r.id
     and r.check_out < current_date - v_days
     and (v_owner is null or r.owner_id = v_owner);
  get diagnostics v_n = row_count; v_deleted := v_deleted + v_n;

  delete from public.ai_usage where created_at < now() - interval '2 days';
  return v_deleted;
end;
$$;

revoke all on function public.acting_owner() from public;
revoke all on function public.my_workspace() from public;
revoke all on function public.add_team_member(text, text, text) from public;
revoke all on function public.my_team() from public;
grant execute on function public.acting_owner() to authenticated;
grant execute on function public.my_workspace() to authenticated;
grant execute on function public.add_team_member(text, text, text) to authenticated;
grant execute on function public.my_team() to authenticated;
