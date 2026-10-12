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

-- ===== Sitio público (v2)
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
update public.properties set kind='propio', title='Tu Día en Tucacas · N°30', capacity=7, nightly_usd=90, published=true,
  contact_whatsapp='584242703482', photos=array['/fotos/sala.jpg'], owner_cedula='17.571.156'
 where id='aaaaaaaa-0000-0000-0000-000000000001';
insert into public.properties (id, name, unit, kind, title, capacity, nightly_usd, partner_cost_usd, published, contact_whatsapp)
values ('aaaaaaaa-0000-0000-0000-000000000002','Apto 12','12','aliado','Apartamento 12',6,120,100,true,'584140000000');
insert into public.properties (id, name, unit, kind, published) values ('aaaaaaaa-0000-0000-0000-000000000003','Borrador','5','aliado',false);
select pg_temp.expect_error($q$update public.properties set photos=array['https://evil.example.com/x.jpg'] where id='aaaaaaaa-0000-0000-0000-000000000002'$q$, 'foto de dominio ajeno');
select pg_temp.expect_error($q$update public.properties set photos=array['javascript:alert(1)'] where id='aaaaaaaa-0000-0000-0000-000000000002'$q$, 'foto con javascript');
select pg_temp.expect_error($q$update public.properties set airbnb_url='https://phishing.com/airbnb' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'enlace de Airbnb falso');
update public.properties set photos=array['https://abcdefgh.supabase.co/storage/v1/object/public/fotos/1111/x.jpg'] where id='aaaaaaaa-0000-0000-0000-000000000002';

reset role;
set role anon;
select set_config('request.jwt.claim.sub','', false);
select pg_temp.check((select count(*) = 2 from public.public_listings()), 'público ve solo los 2 publicados');
select pg_temp.check((select contact_whatsapp = '' from public.public_listings() where kind='aliado'), 'el aliado no expone su contacto');
select pg_temp.check((select count(*) >= 2 from public.public_busy('2026-10-01','2026-11-01')), 'público ve noches ocupadas');
select pg_temp.check((select bool_and(check_out > check_in) from public.public_busy('2026-10-01','2026-11-01')), 'solo rangos de fechas');
select pg_temp.expect_error($q$select * from public.public_busy('2026-01-01','2028-01-01')$q$, 'rango público demasiado largo');
select pg_temp.expect_error($q$select partner_cost_usd from public.properties$q$, 'anon no lee costos de aliados');
select pg_temp.expect_error($q$select public.valid_photo_urls(array['x'])$q$, 'anon no usa funciones internas');
select pg_temp.check((select beds is null and bathrooms is null from public.public_listings() where kind='aliado'), 'público ve camas y baños');

-- ===== Equipo, pagos, garantías y caja (v3)
reset role;
insert into auth.users values ('33333333-3333-3333-3333-333333333333','Zuleika@test');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select pg_temp.expect_error($q$select public.add_team_member('nadie@test','X')$q$, 'agregar un correo que no existe');
select pg_temp.expect_error($q$select public.add_team_member('oniris@test','Yo')$q$, 'agregarse a sí misma');
select public.add_team_member('zuleika@TEST', 'Zuleika');
select pg_temp.check((select count(*) = 1 from public.my_team() where email = 'Zuleika@test'), 'Oniris ve a Zuleika en su equipo');
select pg_temp.expect_error($q$insert into public.team_members (member_id, owner_id, name) values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','x')$q$, 'insertar equipo sin la función');

-- pagos: paid_usd es la suma y no se puede escribir a mano
insert into public.payments (reservation_id, amount_usd, method) values ('bbbbbbbb-0000-0000-0000-000000000001', 100, 'pago_movil');
select pg_temp.check((select paid_usd = 100 from public.reservations where id='bbbbbbbb-0000-0000-0000-000000000001'), 'paid_usd = suma de pagos');
update public.reservations set paid_usd = 999 where id='bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.check((select paid_usd = 100 from public.reservations where id='bbbbbbbb-0000-0000-0000-000000000001'), 'paid_usd no se escribe a mano');
select pg_temp.expect_error($q$insert into public.payments (reservation_id, amount_usd, method) values ('bbbbbbbb-0000-0000-0000-000000000001', -5, 'zelle')$q$, 'pago negativo');
select pg_temp.expect_error($q$insert into public.payments (reservation_id, amount_usd, method) values ('bbbbbbbb-0000-0000-0000-000000000001', 5, 'cripto-raro')$q$, 'método de pago inválido');
insert into public.cash_movements (kind, amount_usd, note) values ('retiro', 50, 'Retiro de prueba');
insert into public.reservations (property_id, contact_name, channel, check_in, check_out) values ('aaaaaaaa-0000-0000-0000-000000000002','Dueño del 12','otro','2026-10-25','2026-10-27');
select pg_temp.expect_error($q$insert into public.cash_movements (kind, amount_usd) values ('retiro', -50)$q$, 'retiro negativo');

-- ===== Zuleika (equipo)
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.check(public.staff_owner() = '11111111-1111-1111-1111-111111111111', 'Zuleika trabaja para Oniris');
select pg_temp.check((select count(*) = 0 from public.reservations), 'Zuleika no lee la tabla de estadías');
select pg_temp.check((select count(*) = 0 from public.guests), 'Zuleika no ve cédulas');
select pg_temp.check((select count(*) = 0 from public.vehicles), 'Zuleika no ve placas');
select pg_temp.check((select count(*) = 0 from public.properties), 'Zuleika no ve costos de aliados');
select pg_temp.check((select count(*) >= 2 from public.staff_board('2026-10-01','2026-11-30')), 'Zuleika ve la agenda');
select pg_temp.check((select count(*) = 0 from public.staff_board('2026-10-01','2026-11-30') where unit = '12'), 'la agenda de Zuleika no incluye apartamentos aliados');
select pg_temp.check((select deposit_usd = 100 and cash_alert_usd = 300 from public.staff_settings()), 'Zuleika ve la garantía y el aviso de su jefa');
select pg_temp.check((select people = 3 and minors = 1 from public.staff_board('2026-10-01','2026-11-30') where id='bbbbbbbb-0000-0000-0000-000000000001'), 'agenda: cuántas personas, sin datos');
select pg_temp.check((select count(*) = 0 from public.payments), 'Zuleika no ve pagos que recibió Oniris');
-- cobra en efectivo: queda como recibido por ella aunque diga otra cosa
insert into public.payments (reservation_id, amount_usd, method, received_by) values ('bbbbbbbb-0000-0000-0000-000000000001', 140, 'efectivo_usd', 'owner');
select pg_temp.check((select received_by = 'staff' and owner_id = '11111111-1111-1111-1111-111111111111' from public.payments), 'cobro de Zuleika queda a su nombre y del dueño');
select pg_temp.check((select paid_usd = 240 from public.staff_board('2026-10-01','2026-11-30') where id='bbbbbbbb-0000-0000-0000-000000000001'), 'el cobro de Zuleika suma al pagado');
-- garantía y tareas
insert into public.stay_ops (reservation_id, deposit_usd, deposit_received_at, keys_at) values ('bbbbbbbb-0000-0000-0000-000000000001', 100, now(), now());
update public.stay_ops set deposit_returned_at = now(), deposit_returned_usd = 80, clean_after_at = now() where reservation_id = 'bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$update public.stay_ops set deposit_returned_usd = 150 where reservation_id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 'devolver más de la garantía');
insert into public.cash_movements (kind, amount_usd, note) values ('gasto', 12, 'Detergente');
select pg_temp.expect_error($q$insert into public.cash_movements (kind, amount_usd) values ('retiro', 10)$q$, 'Zuleika no anota retiros');
select pg_temp.check((select count(*) = 2 from public.cash_movements), 'Zuleika ve la caja');
-- no puede crear nada propio ni tocar planillas
select pg_temp.expect_error($q$insert into public.properties (name, unit) values ('Mío','99')$q$, 'equipo no crea apartamentos');
select pg_temp.expect_error($q$insert into public.guests (reservation_id, position, full_name, cedula) values ('bbbbbbbb-0000-0000-0000-000000000001',6,'X','9.999.999')$q$, 'equipo no agrega personas');
select pg_temp.expect_error($q$select public.save_authorization('bbbbbbbb-0000-0000-0000-000000000001', '[]', '[]')$q$, 'equipo no guarda planillas');
select pg_temp.expect_error($q$select public.add_team_member('x@test','x')$q$, 'equipo no agrega gente');
update public.reservations set total_usd = 1;  -- sin efecto
delete from public.payments where method = 'pago_movil';  -- sin efecto: no es suyo

-- ===== Otro dueño (B) no ve nada de esto
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
select pg_temp.check((select count(*) = 0 from public.payments) and (select count(*) = 0 from public.stay_ops) and (select count(*) = 0 from public.cash_movements), 'B no ve pagos, tareas ni caja de A');
select pg_temp.check((select count(*) = 0 from public.staff_board('2026-10-01','2026-11-30')), 'B no ve la agenda de A');
select pg_temp.expect_error($q$insert into public.stay_ops (reservation_id) values ('bbbbbbbb-0000-0000-0000-000000000001')$q$, 'B no crea tareas en estadía ajena');

-- ===== Oniris ve todo
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select pg_temp.check((select total_usd = 240 and paid_usd = 240 from public.reservations where id='bbbbbbbb-0000-0000-0000-000000000001'), 'Zuleika no cambió el total');
select pg_temp.check((select count(*) = 2 from public.payments), 'Oniris ve todos los pagos');
select pg_temp.check((select deposit_returned_usd = 80 from public.stay_ops), 'Oniris ve la garantía devuelta');
delete from public.team_members;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
select pg_temp.check(public.staff_owner() is null and (select count(*) = 0 from public.stay_ops), 'al quitarla del equipo pierde el acceso');

reset role;
set role anon;
select set_config('request.jwt.claim.sub','', false);
select pg_temp.expect_error($q$select * from public.payments$q$, 'anon lee pagos');
select pg_temp.expect_error($q$select * from public.staff_board('2026-10-01','2026-10-02')$q$, 'anon lee la agenda');
reset role;
\echo 'TODAS LAS PRUEBAS DE BASE DE DATOS PASARON'
