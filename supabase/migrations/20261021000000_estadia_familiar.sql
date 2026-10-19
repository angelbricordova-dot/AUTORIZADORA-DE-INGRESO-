-- =====================================================================
-- Tu Día en Tucacas · estadías de familiares de Oniris (no pagan)
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261020000000_caja_corregir.sql
--
-- Una estadía con tipo "Familiar" no se cobra: el total queda en $0 y a Zuleika
-- no le aparecen las tareas de cobrar el saldo ni la garantía. Para eso su
-- agenda necesita saber si la estadía es familiar (solo sí/no, ningún dato personal).
-- =====================================================================

-- Un familiar no paga: el total siempre es 0
update public.reservations set total_usd = 0 where stay_type = 'Familiar' and total_usd <> 0;
alter table public.reservations drop constraint if exists reservations_familiar_sin_cobro;
alter table public.reservations add constraint reservations_familiar_sin_cobro
  check (stay_type <> 'Familiar' or total_usd = 0);

drop function if exists public.staff_board(date, date);
create function public.staff_board(p_from date, p_to date)
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
  paid_usd numeric,
  family boolean
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
           r.total_usd, r.paid_usd, r.stay_type = 'Familiar'
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
revoke all on function public.staff_board(date, date) from public;
grant execute on function public.staff_board(date, date) to authenticated;
