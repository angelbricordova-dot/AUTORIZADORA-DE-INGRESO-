-- =====================================================================
-- Tu Día en Tucacas · corregir movimientos de la caja
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261019000000_caja_efectivo_recibido.sql
--
-- El panel (Oniris, Angélica) ya podía corregir cualquier movimiento.
-- Ahora Zuleika también puede corregir el monto, la fecha o la nota de lo que
-- ella misma anotó en las últimas 24 horas (igual que ya podía borrarlo).
-- Quién lo anotó y cuándo no se puede cambiar (lo fija la base).
-- =====================================================================

drop policy if exists "caja: el equipo corrige el monto de lo suyo del mismo día" on public.cash_movements;
create policy "caja: el equipo corrige el monto de lo suyo del mismo día" on public.cash_movements
  for update to authenticated
  using (owner_id = (select public.staff_owner()) and created_by = (select auth.uid()) and created_at > now() - interval '1 day')
  with check (owner_id = (select public.staff_owner()) and kind in ('gasto', 'ingreso'));

drop policy if exists "pagos: el equipo corrige el monto de lo suyo del mismo día" on public.payments;
create policy "pagos: el equipo corrige el monto de lo suyo del mismo día" on public.payments
  for update to authenticated
  using (owner_id = (select public.staff_owner()) and created_by = (select auth.uid()) and created_at > now() - interval '1 day')
  with check (owner_id = (select public.staff_owner()) and received_by = 'staff');
