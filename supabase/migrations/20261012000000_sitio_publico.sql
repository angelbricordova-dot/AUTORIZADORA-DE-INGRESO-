-- =====================================================================
-- Tu Día en Tucacas · sitio público y catálogo de apartamentos aliados
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261011000000_esquema_inicial.sql
--
-- El público (rol anon) NO puede leer tablas. Solo puede llamar a dos
-- funciones que devuelven lo mínimo para mostrar el sitio:
--   public_listings()      apartamentos publicados (sin datos del dueño ni costos)
--   public_busy(from, to)  rangos de noches ocupadas (sin nombres, sin montos)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Apartamentos: datos para el sitio público y el catálogo
-- ---------------------------------------------------------------------
alter table public.properties
  add column if not exists kind text not null default 'propio' check (kind in ('propio', 'aliado')),
  add column if not exists title text not null default '' check (char_length(title) <= 80),
  add column if not exists summary text not null default '' check (char_length(summary) <= 280),
  add column if not exists description text not null default '' check (char_length(description) <= 2000),
  add column if not exists capacity smallint not null default 7 check (capacity between 1 and 30),
  add column if not exists bedrooms smallint check (bedrooms is null or bedrooms between 0 and 20),
  add column if not exists partner_cost_usd numeric(10, 2) check (partner_cost_usd is null or partner_cost_usd between 0 and 100000),
  add column if not exists promo text not null default '' check (char_length(promo) <= 140),
  add column if not exists amenities text[] not null default '{}' check (cardinality(amenities) <= 20),
  add column if not exists photos text[] not null default '{}' check (cardinality(photos) <= 12),
  add column if not exists published boolean not null default false,
  add column if not exists sort smallint not null default 0,
  -- datos para la planilla de autorización de ese apartamento (si es de otro dueño)
  add column if not exists owner_name text not null default '' check (char_length(owner_name) <= 120),
  add column if not exists owner_cedula text not null default '' check (owner_cedula ~ '^[0-9.]{0,12}$'),
  -- contacto público de reservas (WhatsApp, Airbnb, Instagram)
  add column if not exists contact_whatsapp text not null default '' check (contact_whatsapp ~ '^[0-9]{0,15}$'),
  add column if not exists airbnb_url text not null default '' check (airbnb_url = '' or airbnb_url ~ '^https://(www\.)?airbnb\.[a-z.]+/'),
  add column if not exists instagram_url text not null default '' check (instagram_url = '' or instagram_url ~ '^https://(www\.)?instagram\.com/');

-- las fotos solo pueden ser rutas del propio sitio o del almacenamiento de Supabase
create or replace function public.valid_photo_urls(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(u ~ '^(/fotos/[A-Za-z0-9._-]+|https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/fotos/[A-Za-z0-9/._-]+)$' and char_length(u) <= 300), true)
  from unnest(p) as u
$$;

alter table public.properties drop constraint if exists properties_photos_valid;
alter table public.properties add constraint properties_photos_valid check (public.valid_photo_urls(photos));

grant select, insert, update, delete on public.properties to authenticated;

-- ---------------------------------------------------------------------
-- Lectura pública mínima
-- ---------------------------------------------------------------------
create or replace function public.public_listings()
returns table (
  id uuid,
  kind text,
  title text,
  unit text,
  conjunto text,
  summary text,
  description text,
  capacity smallint,
  bedrooms smallint,
  nightly_usd numeric,
  promo text,
  amenities text[],
  photos text[],
  contact_whatsapp text,
  airbnb_url text,
  instagram_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, coalesce(nullif(p.title, ''), p.name), p.unit, p.conjunto, p.summary, p.description,
         p.capacity, p.bedrooms, p.nightly_usd, p.promo, p.amenities, p.photos,
         case when p.kind = 'propio' then p.contact_whatsapp else '' end,
         case when p.kind = 'propio' then p.airbnb_url else '' end,
         case when p.kind = 'propio' then p.instagram_url else '' end
    from public.properties p
   where p.published
   order by (p.kind = 'propio') desc, p.sort, p.created_at
   limit 50
$$;

create or replace function public.public_busy(p_from date, p_to date)
returns table (property_id uuid, check_in date, check_out date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 400 then
    raise exception 'Rango inválido' using errcode = '22023';
  end if;
  return query
    select r.property_id, r.check_in, r.check_out
      from public.reservations r
      join public.properties p on p.id = r.property_id
     where p.published
       and r.status = 'confirmada'
       and r.check_out > p_from
       and r.check_in < p_to
     order by r.check_in
     limit 2000;
end;
$$;

revoke all on function public.public_listings() from public;
revoke all on function public.public_busy(date, date) from public;
revoke all on function public.valid_photo_urls(text[]) from public;
grant execute on function public.public_listings() to anon, authenticated;
grant execute on function public.public_busy(date, date) to anon, authenticated;
grant execute on function public.valid_photo_urls(text[]) to authenticated;
