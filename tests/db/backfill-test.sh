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
