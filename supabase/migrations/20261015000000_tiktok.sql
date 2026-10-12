-- =====================================================================
-- Tu Día en Tucacas · enlace de TikTok en la página pública
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261014000000_varias_administradoras.sql
-- =====================================================================

alter table public.properties
  add column if not exists tiktok_url text not null default ''
    check (tiktok_url = '' or tiktok_url ~ '^https://(www\.|vm\.)?tiktok\.com/');

drop function if exists public.public_listings();
create function public.public_listings()
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
  beds smallint,
  bathrooms smallint,
  nightly_usd numeric,
  promo text,
  amenities text[],
  photos text[],
  contact_whatsapp text,
  airbnb_url text,
  instagram_url text,
  tiktok_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.kind, coalesce(nullif(p.title, ''), p.name), p.unit, p.conjunto, p.summary, p.description,
         p.capacity, p.bedrooms, p.beds, p.bathrooms, p.nightly_usd, p.promo, p.amenities, p.photos,
         case when p.kind = 'propio' then p.contact_whatsapp else '' end,
         case when p.kind = 'propio' then p.airbnb_url else '' end,
         case when p.kind = 'propio' then p.instagram_url else '' end,
         case when p.kind = 'propio' then p.tiktok_url else '' end
    from public.properties p
   where p.published
   order by (p.kind = 'propio') desc, p.sort, p.created_at
   limit 50
$$;
revoke all on function public.public_listings() from public;
grant execute on function public.public_listings() to anon, authenticated;
