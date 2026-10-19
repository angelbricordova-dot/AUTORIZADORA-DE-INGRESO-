#!/usr/bin/env bash
# Simula una base creada con la versión 1 y luego migrada: el apartamento propio debe quedar publicado.
set -euo pipefail
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}
DIR=$(mktemp -d)
trap '"$PGBIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
RUNAS=""
if [ "$(id -u)" = "0" ]; then chown -R nobody "$DIR" 2>/dev/null || true; RUNAS="su nobody -s /bin/bash -c"; fi
run() { if [ -n "$RUNAS" ]; then $RUNAS "$*"; else bash -c "$*"; fi; }
run "$PGBIN/initdb -D $DIR/data -U postgres -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/data -o '-k $DIR -p 54330 -c listen_addresses=' -l $DIR/log start >/dev/null"
sleep 1
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PSQL="$PGBIN/psql -X -h $DIR -p 54330 -U postgres -d postgres -q -v ON_ERROR_STOP=1"
$PSQL -f "$ROOT/tests/db/supabase-stub.sql"
$PSQL -f "$ROOT/supabase/migrations/20261011000000_esquema_inicial.sql"
$PSQL -c "insert into auth.users values ('11111111-1111-1111-1111-111111111111','x@test');"
$PSQL -c "set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false); insert into public.properties (name, unit) values ('Apartamento N°30','30');"
$PSQL -f "$ROOT/supabase/migrations/20261012000000_sitio_publico.sql"
$PSQL -f "$ROOT/supabase/migrations/20261012000100_fotos_storage.sql"
N=$($PSQL -At -c "set role anon; select count(*) from public.public_listings();")
[ "$N" = "1" ] && echo "MIGRACIÓN SOBRE BASE EXISTENTE: OK (1 publicado)" || { echo "FALLA: $N publicados"; exit 1; }
# v3: una estadía ya marcada como pagada debe conservar lo pagado como un pago "registrado antes"
$PSQL -c "set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false); insert into public.reservations (property_id, contact_name, channel, check_in, check_out, total_usd, paid_usd) select id, 'Familia Vieja', 'airbnb', '2026-10-20', '2026-10-22', 200, 150 from public.properties limit 1;"
$PSQL -f "$ROOT/supabase/migrations/20261013000000_equipo_pagos.sql"
P=$($PSQL -At -c "select paid_usd || '/' || (select count(*) from public.payments) from public.reservations")
[ "$P" = "150.00/1" ] && echo "PAGOS ANTERIORES CONSERVADOS: OK" || { echo "FALLA pagos: $P"; exit 1; }
F=$($PSQL -At -c "set role anon; select cardinality(photos) || '/' || bedrooms || '/' || beds || '/' || bathrooms from public.public_listings();")
[ "$F" = "12/2/5/2" ] && echo "FOTOS Y DATOS DEL N°30: OK" || { echo "FALLA fotos: $F"; exit 1; }
# v4: varias administradoras; la dueña sigue viendo todo lo suyo
$PSQL -f "$ROOT/supabase/migrations/20261014000000_varias_administradoras.sql"
V=$($PSQL -At -c "set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false) is not null; select count(*) || '/' || (select count(*) from public.payments) from public.reservations;" | tail -1)
[ "$V" = "1/1" ] && echo "LA DUEÑA CONSERVA SUS DATOS: OK" || { echo "FALLA dueña: $V"; exit 1; }
# v5: TikTok; la página pública sigue funcionando
$PSQL -f "$ROOT/supabase/migrations/20261015000000_tiktok.sql"
T=$($PSQL -At -c "set role anon; select count(*) || '/' || coalesce(max(tiktok_url), 'x') from public.public_listings();")
[ "$T" = "1/" ] && echo "TIKTOK SIN ROMPER LA PÁGINA: OK" || { echo "FALLA tiktok: $T"; exit 1; }
# v6: encuesta y reseñas
$PSQL -f "$ROOT/supabase/migrations/20261016000000_resenas.sql"
R=$($PSQL -At -c "set role anon; select count(*) from public.public_reviews();")
[ "$R" = "0" ] && echo "RESEÑAS SIN ROMPER LA PÁGINA: OK" || { echo "FALLA reseñas: $R"; exit 1; }
# v7: comentario público
$PSQL -f "$ROOT/supabase/migrations/20261017000000_resenas_comentario.sql"
C=$($PSQL -At -c "set role anon; select count(*) from public.public_reviews();")
[ "$C" = "0" ] && echo "COMENTARIO PÚBLICO SIN ROMPER LA PÁGINA: OK" || { echo "FALLA comentario: $C"; exit 1; }
# v8 y v9: avisos y efectivo recibido sobre una caja con movimientos
$PSQL -f "$ROOT/supabase/migrations/20261018000000_avisos.sql"
$PSQL -f "$ROOT/supabase/migrations/20261019000000_caja_efectivo_recibido.sql"
$PSQL -f "$ROOT/supabase/migrations/20261020000000_caja_corregir.sql"
$PSQL -f "$ROOT/supabase/migrations/20261021000000_estadia_familiar.sql"
K=$($PSQL -At -c "select count(*) from pg_constraint where conname = 'cash_movements_kind_check' and pg_get_constraintdef(oid) like '%ingreso%';")
[ "$K" = "1" ] && echo "CAJA ACEPTA EFECTIVO RECIBIDO: OK" || { echo "FALLA caja: $K"; exit 1; }
