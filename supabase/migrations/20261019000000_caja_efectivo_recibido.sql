-- =====================================================================
-- Tu Día en Tucacas · "Recibí efectivo" en la caja de Zuleika
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261018000000_avisos.sql
--
-- Zuleika puede anotar efectivo que le entregan aunque no sea el cobro de una
-- estadía de la lista (por ejemplo, un huésped que paga por otro): queda como
-- movimiento "ingreso" con el nombre de quien lo entregó, y suma a la caja.
-- =====================================================================

alter table public.cash_movements drop constraint if exists cash_movements_kind_check;
alter table public.cash_movements add constraint cash_movements_kind_check
  check (kind in ('retiro', 'gasto', 'ajuste', 'ingreso'));

-- quien entregó el efectivo es obligatorio
alter table public.cash_movements drop constraint if exists cash_movements_ingreso_con_nombre;
alter table public.cash_movements add constraint cash_movements_ingreso_con_nombre
  check (kind <> 'ingreso' or char_length(trim(note)) >= 2);

drop policy if exists "caja: el equipo anota gastos" on public.cash_movements;
drop policy if exists "caja: el equipo anota gastos y efectivo recibido" on public.cash_movements;
create policy "caja: el equipo anota gastos y efectivo recibido" on public.cash_movements
  for insert to authenticated
  with check (owner_id = (select public.staff_owner()) and kind in ('gasto', 'ingreso'));
