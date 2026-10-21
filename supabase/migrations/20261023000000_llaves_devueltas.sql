-- =====================================================================
-- Tu Día en Tucacas · "Recibir las llaves" cuando se va un familiar
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261022000000_avisos_familiar.sql
--
-- Cuando se va un familiar de Oniris, Zuleika no limpia ni revisa garantía:
-- solo recibe las llaves. Se anota cuándo las recibió, y el aviso de la mañana
-- se lo recuerda.
-- =====================================================================

alter table public.stay_ops add column if not exists keys_back_at timestamptz;

drop function if exists public.push_digest(text, date);
create function public.push_digest(p_secret text, p_day date)
returns table (
  endpoint text, p256dh text, auth text, unit text,
  arrivals integer, departures integer, arrivals_tomorrow integer, family_arrivals integer, family_departures integer
)
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
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.stay_type <> 'Familiar' and r.check_in = p_day),
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.stay_type <> 'Familiar' and r.check_out = p_day),
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.stay_type <> 'Familiar' and r.check_in = p_day + 1),
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.stay_type = 'Familiar' and r.check_in = p_day),
           (select count(*)::integer from public.reservations r where r.property_id = p.id and r.status = 'confirmada' and r.stay_type = 'Familiar' and r.check_out = p_day)
      from public.push_subscriptions s
      join public.properties p on p.owner_id = s.owner_id and p.kind = 'propio'
     limit 200;
end;
$$;
revoke all on function public.push_digest(text, date) from public;
grant execute on function public.push_digest(text, date) to anon, authenticated;
