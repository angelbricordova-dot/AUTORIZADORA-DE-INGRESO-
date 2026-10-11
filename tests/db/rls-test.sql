\set ON_ERROR_STOP 1
-- Usuarios de prueba
insert into auth.users values ('11111111-1111-1111-1111-111111111111','oniris@test'),('22222222-2222-2222-2222-222222222222','otro@test');

create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'OK (bloqueado) %: %', label, sqlerrm;
    return;
  end;
  raise exception 'FALLA: % debía ser rechazado', label;
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FALLA: %', label; end if;
  raise notice 'OK %', label;
end $$;

-- ===== Usuario A (Oniris)
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);

-- intenta falsificar owner_id: el trigger lo corrige a su propio uid
insert into public.properties (id, owner_id, name, unit) values
  ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Apto 30','N°30');
select pg_temp.check((select bool_and(owner_id = auth.uid()) from public.properties), 'owner_id forzado al usuario real');

insert into public.reservations (id, property_id, contact_name, channel, check_in, check_out, total_usd)
values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Familia Pérez','airbnb','2026-10-17','2026-10-19',240);

select pg_temp.expect_error($q$insert into public.reservations (property_id, contact_name, channel, check_in, check_out) values ('aaaaaaaa-0000-0000-0000-000000000001','Choque','whatsapp','2026-10-18','2026-10-20')$q$, 'reserva confirmada solapada');
-- una tentativa sí puede solaparse (para ofrecer alternativas)
insert into public.reservations (property_id, contact_name, channel, check_in, check_out, status) values ('aaaaaaaa-0000-0000-0000-000000000001','Grupo 2','whatsapp','2026-10-18','2026-10-20','tentativa');
-- salida el mismo día que entra otra: válido
insert into public.reservations (property_id, contact_name, channel, check_in, check_out) values ('aaaaaaaa-0000-0000-0000-000000000001','Grupo 3','directo','2026-10-19','2026-10-21');

select pg_temp.expect_error($q$insert into public.reservations (property_id, contact_name, channel, check_in, check_out) values ('aaaaaaaa-0000-0000-0000-000000000001','Fechas','airbnb','2026-10-20','2026-10-18')$q$, 'salida antes de entrada');
select pg_temp.expect_error($q$insert into public.reservations (property_id, contact_name, channel, check_in, check_out) values ('aaaaaaaa-0000-0000-0000-000000000001','Canal','hackerland','2026-11-01','2026-11-02')$q$, 'canal inválido');
select pg_temp.expect_error($q$insert into public.reservations (property_id, contact_name, channel, check_in, check_out, total_usd) values ('aaaaaaaa-0000-0000-0000-000000000001','Monto','airbnb','2026-11-01','2026-11-02',-5)$q$, 'monto negativo');

insert into public.guests (reservation_id, position, full_name, cedula) values ('bbbbbbbb-0000-0000-0000-000000000001',1,'Juan Pérez','12.345.678');
insert into public.guests (reservation_id, position, full_name, is_minor) values ('bbbbbbbb-0000-0000-0000-000000000001',2,'Sofía Pérez',true);
select pg_temp.expect_error($q$insert into public.guests (reservation_id, position, full_name) values ('bbbbbbbb-0000-0000-0000-000000000001',3,'Sin Cédula')$q$, 'adulto sin cédula');
select pg_temp.expect_error($q$insert into public.guests (reservation_id, position, full_name, cedula) values ('bbbbbbbb-0000-0000-0000-000000000001',8,'Octavo','1.234.567')$q$, 'más de 7 personas');
select pg_temp.expect_error($q$insert into public.guests (reservation_id, position, full_name, cedula) values ('bbbbbbbb-0000-0000-0000-000000000001',4,'Inyección','=HYPERLINK(1)')$q$, 'cédula con fórmula');
select pg_temp.expect_error($q$insert into public.vehicles (reservation_id, position, description, plate) values ('bbbbbbbb-0000-0000-0000-000000000001',1,'Corolla','ab 12'' or 1=1')$q$, 'placa inválida');
insert into public.vehicles (reservation_id, position, description, plate) values ('bbbbbbbb-0000-0000-0000-000000000001',1,'Toyota Corolla vinotinto','AA046KT');

-- guardado atómico de la planilla
select public.save_authorization('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"full_name":"Juan Pérez","cedula":"12.345.678"},{"full_name":"Ana Pérez","cedula":"V-9.876.543"},{"full_name":"Sofía Pérez","is_minor":true}]',
  '[{"description":"Toyota Corolla vinotinto","plate":"AA046KT"}]');
select pg_temp.check((select count(*) = 3 from public.guests), 'planilla guardada con 3 personas');
select pg_temp.check((select auth_status = 'generada' from public.reservations where id='bbbbbbbb-0000-0000-0000-000000000001'), 'estado pasa a generada');
select pg_temp.expect_error($q$select public.save_authorization('bbbbbbbb-0000-0000-0000-000000000001', '[{"full_name":"Adulto sin cédula"}]', '[]')$q$, 'planilla inválida no se guarda');
select pg_temp.check((select count(*) = 3 from public.guests), 'planilla inválida no borró las personas (transacción)');

-- no puede cambiar el dueño de un registro existente
update public.reservations set owner_id = '22222222-2222-2222-2222-222222222222' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 1 from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001' and owner_id = auth.uid()), 'no se puede cambiar el dueño');

-- cuota de IA
select pg_temp.check(public.consume_ai_quota(2), 'cuota IA 1/2');
select pg_temp.check(public.consume_ai_quota(2), 'cuota IA 2/2');
select pg_temp.check(not public.consume_ai_quota(2), 'cuota IA agotada');

-- ===== Usuario B
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.check((select count(*) = 0 from public.reservations), 'B no ve reservas de A');
select pg_temp.check((select count(*) = 0 from public.guests), 'B no ve personas de A');
select pg_temp.expect_error($q$select public.save_authorization('bbbbbbbb-0000-0000-0000-000000000001', '[]', '[]')$q$, 'B no puede guardar planilla de A');
update public.reservations set total_usd = 0;  -- no afecta filas ajenas
delete from public.guests;                     -- no afecta filas ajenas
-- B intenta colgar un huésped en la reserva de A
select pg_temp.expect_error($q$insert into public.guests (reservation_id, position, full_name, cedula) values ('bbbbbbbb-0000-0000-0000-000000000001',5,'Intruso','9.999.999')$q$, 'huésped en reserva ajena');
-- B intenta crear reserva sobre el inmueble de A
select pg_temp.expect_error($q$insert into public.reservations (property_id, contact_name, channel, check_in, check_out) values ('aaaaaaaa-0000-0000-0000-000000000001','Intruso','airbnb','2026-12-01','2026-12-02')$q$, 'reserva en inmueble ajeno');

-- ===== Anónimo
reset role;
set role anon;
select set_config('request.jwt.claim.sub','', false);
select pg_temp.expect_error($q$select * from public.reservations$q$, 'anon lee reservas');
select pg_temp.expect_error($q$select public.consume_ai_quota(5)$q$, 'anon usa IA');

-- ===== Comprobación final como A
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select pg_temp.check((select total_usd from public.reservations where id='bbbbbbbb-0000-0000-0000-000000000001') = 240, 'B no pudo modificar montos de A');
select pg_temp.check((select count(*) from public.guests) = 3, 'B no pudo borrar personas de A');
reset role;
\echo 'TODAS LAS PRUEBAS DE BASE DE DATOS PASARON'
