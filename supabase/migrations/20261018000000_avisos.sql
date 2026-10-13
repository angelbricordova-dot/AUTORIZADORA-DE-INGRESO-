-- =====================================================================
-- Tu Día en Tucacas · avisos al teléfono (notificaciones)
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261017000000_resenas_comentario.sql
--
-- Cada teléfono que activa los avisos guarda aquí su "suscripción" (una
-- dirección del servicio de notificaciones del teléfono, sin datos personales).
--  * push_new_stay()  lo llama el panel al registrar una estadía: devuelve a
--                     quién avisar (Zuleika) y lo mínimo para el mensaje.
--  * push_digest()    lo llama el recordatorio diario de Netlify con una clave
--                     secreta: entradas y salidas de hoy para cada teléfono.
-- =====================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 800),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);

-- quien se suscribe queda a su nombre y en el panel donde trabaja
create or replace function public.tg_push_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Se requiere sesión' using errcode = '42501';
  end if;
  new.user_id := auth.uid();
  new.owner_id := coalesce(public.staff_owner(), public.acting_owner());
  new.created_at := now();
  return new;
end;
$$;
create trigger push_subscriptions_owner before insert on public.push_subscriptions
  for each row execute function public.tg_push_owner();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
create policy "avisos: cada quien sus teléfonos" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "avisos: activar en este teléfono" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "avisos: desactivar en este teléfono" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Clave del recordatorio diario (se guarda solo su huella SHA-256, nunca la clave)
create table public.app_secrets (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$')
);
alter table public.app_secrets enable row level security;
alter table public.app_secrets force row level security;
revoke all on public.app_secrets from anon, authenticated;

create or replace function public.check_secret(p_name text, p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_secrets
     where name = p_name and char_length(coalesce(p_secret, '')) >= 24
       and sha256 = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
  )
$$;

-- ---------------------------------------------------------------------
-- Aviso de estadía nueva: solo quien administra el panel de esa estadía.
-- Devuelve los teléfonos del equipo de trabajo (Zuleika) y los datos mínimos.
-- ---------------------------------------------------------------------
create or replace function public.push_new_stay(p_reservation uuid)
returns table (endpoint text, p256dh text, auth text, unit text, check_in date, check_out date, people integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.acting_owner();
begin
  if auth.uid() is null or public.staff_owner() is not null then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth, p.unit, r.check_in, r.check_out,
           (select count(*)::integer from public.guests g where g.reservation_id = r.id)
      from public.reservations r
      join public.properties p on p.id = r.property_id and p.kind = 'propio'
      join public.team_members t on t.owner_id = r.owner_id and t.role = 'staff'
      join public.push_subscriptions s on s.user_id = t.member_id
     where r.id = p_reservation and r.owner_id = v_owner and r.status <> 'cancelada'
       and r.check_out >= current_date;
end;
$$;

-- ---------------------------------------------------------------------
-- Recordatorio diario: para cada teléfono suscrito, cuántos llegan y se van ese día
-- (solo del apartamento propio de su panel). Requiere la clave secreta.
-- ---------------------------------------------------------------------
create or replace function public.push_digest(p_secret text, p_day date)
returns table (endpoint text, p256dh text, auth text, unit text, arrivals integer, departures integer, arrivals_tomorrow integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.check_secret('avisos', p_secret) then
    raise exception 'Clave inválida' using errcode = '42501';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth, p.unit,
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.check_in = p_day),
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.check_out = p_day),
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.check_in = p_day + 1)
      from public.push_subscriptions s
      join public.properties p on p.owner_id = s.owner_id and p.kind = 'propio'
     limit 200;
end;
$$;

-- El servicio de notificaciones dice que un teléfono ya no existe: se borra.
create or replace function public.push_forget(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.check_secret('avisos', p_secret) then
    raise exception 'Clave inválida' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function public.tg_push_owner() from public;
revoke all on function public.check_secret(text, text) from public;
revoke all on function public.push_new_stay(uuid) from public;
revoke all on function public.push_digest(text, date) from public;
revoke all on function public.push_forget(text, text) from public;
grant execute on function public.push_new_stay(uuid) to authenticated;
grant execute on function public.push_digest(text, date) to anon, authenticated;
grant execute on function public.push_forget(text, text) to anon, authenticated;
