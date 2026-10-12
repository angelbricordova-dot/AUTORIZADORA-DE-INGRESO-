-- =====================================================================
-- Tu Día en Tucacas · encuesta y reseñas de huéspedes
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261015000000_tiktok.sql
--
-- Reemplaza el Google Form "Ayúdanos a mejorar tu próxima estadía".
-- Cualquier visitante puede responder con submit_review(); todo llega al panel.
-- Al público solo se muestra "lo que más te gustó", y SOLO si el huésped dio
-- permiso y alguien del panel la aprobó (public_reviews). Lo que mejorarían y
-- lo que faltó en la cocina es privado: nunca sale del panel.
-- =====================================================================

-- Enlace para dejar opinión en Google (perfil de empresa): se ofrece al terminar la encuesta
alter table public.properties
  add column if not exists google_review_url text not null default ''
    check (google_review_url = '' or google_review_url ~ '^https://(g\.page|search\.google\.com|maps\.app\.goo\.gl|www\.google\.com|g\.co|goo\.gl)/');

drop function if exists public.public_listings();
create function public.public_listings()
returns table (
  id uuid, kind text, title text, unit text, conjunto text, summary text, description text,
  capacity smallint, bedrooms smallint, beds smallint, bathrooms smallint, nightly_usd numeric,
  promo text, amenities text[], photos text[],
  contact_whatsapp text, airbnb_url text, instagram_url text, tiktok_url text, google_review_url text
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
         case when p.kind = 'propio' then p.tiktok_url else '' end,
         case when p.kind = 'propio' then p.google_review_url else '' end
    from public.properties p
   where p.published
   order by (p.kind = 'propio') desc, p.sort, p.created_at
   limit 50
$$;
revoke all on function public.public_listings() from public;
grant execute on function public.public_listings() to anon, authenticated;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null,
  author_name text not null default '' check (char_length(author_name) <= 60),
  nights smallint check (nights is null or nights between 1 and 60),
  cleanliness smallint check (cleanliness is null or cleanliness between 1 and 5),
  beds smallint check (beds is null or beds between 1 and 5),
  ac smallint check (ac is null or ac between 1 and 5),
  wifi smallint check (wifi is null or wifi between 1 and 5),
  communication smallint check (communication is null or communication between 1 and 5),
  kitchen_ok boolean,
  kitchen_missing text not null default '' check (char_length(kitchen_missing) <= 300),
  recommend smallint check (recommend is null or recommend between 1 and 10),
  liked text not null default '' check (char_length(liked) <= 1000),
  improve text not null check (char_length(improve) between 2 and 1000),
  permission text not null default 'no' check (permission in ('si', 'no', 'consultar')),
  status text not null default 'pendiente' check (status in ('pendiente', 'publicada', 'oculta')),
  reply text not null default '' check (char_length(reply) <= 500),
  created_at timestamptz not null default now(),
  -- sin permiso no se puede publicar
  check (status <> 'publicada' or (permission <> 'no' and liked <> '')),
  foreign key (owner_id, property_id) references public.properties (owner_id, id) on delete cascade
);
create index reviews_property on public.reviews (property_id, status, created_at desc);
create index reviews_recent on public.reviews (created_at desc);

alter table public.reviews enable row level security;
alter table public.reviews force row level security;

create policy "reseñas: panel" on public.reviews
  for select to authenticated using (owner_id = (select public.acting_owner()));
create policy "reseñas: panel modera" on public.reviews
  for update to authenticated
  using (owner_id = (select public.acting_owner()))
  with check (owner_id = (select public.acting_owner()));
create policy "reseñas: panel borra" on public.reviews
  for delete to authenticated using (owner_id = (select public.acting_owner()));

-- el panel solo cambia el estado y su respuesta; lo que escribió el huésped no se toca
revoke all on public.reviews from anon, authenticated;
grant select, delete on public.reviews to authenticated;
grant update (status, reply) on public.reviews to authenticated;

-- ---------------------------------------------------------------------
-- Responder la encuesta (público). Valida todo y frena el spam.
-- ---------------------------------------------------------------------
create or replace function public.submit_review(p_property uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_name text := left(regexp_replace(trim(coalesce(p_data->>'author_name', '')), '\s+', ' ', 'g'), 60);
  v_liked text := left(trim(coalesce(p_data->>'liked', '')), 1000);
  v_improve text := left(trim(coalesce(p_data->>'improve', '')), 1000);
  v_missing text := left(trim(coalesce(p_data->>'kitchen_missing', '')), 300);
  v_perm text := coalesce(p_data->>'permission', 'no');
begin
  if jsonb_typeof(p_data) <> 'object' then
    raise exception 'Datos inválidos' using errcode = '22023';
  end if;
  select owner_id into v_owner from public.properties where id = p_property and published;
  if v_owner is null then
    raise exception 'Ese apartamento no existe' using errcode = '22023';
  end if;
  if char_length(v_improve) < 2 then
    raise exception 'Cuéntanos qué mejorarías (es la única pregunta obligatoria)' using errcode = '22023';
  end if;
  if v_perm not in ('si', 'no', 'consultar') then
    v_perm := 'no';
  end if;
  if v_perm <> 'no' and char_length(v_name) < 2 then
    raise exception 'Escribe tu nombre para poder mostrar tu reseña' using errcode = '22023';
  end if;
  if v_name ~ '[<>{}]' or (v_liked || ' ' || v_improve || ' ' || v_missing) ~* '(https?://|www\.)' then
    raise exception 'La encuesta no puede llevar enlaces' using errcode = '22023';
  end if;
  -- freno al spam: pocas respuestas nuevas por hora en todo el sitio
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 15 then
    raise exception 'Recibimos muchas respuestas en este momento. Inténtalo más tarde.' using errcode = '54000';
  end if;
  if exists (select 1 from public.reviews where property_id = p_property and lower(improve) = lower(v_improve) and lower(liked) = lower(v_liked)) then
    raise exception 'Esa respuesta ya la recibimos. ¡Gracias!' using errcode = '23505';
  end if;
  insert into public.reviews (owner_id, property_id, author_name, nights, cleanliness, beds, ac, wifi, communication,
                              kitchen_ok, kitchen_missing, recommend, liked, improve, permission)
  values (v_owner, p_property, v_name,
          nullif(p_data->>'nights', '')::smallint,
          nullif(p_data->>'cleanliness', '')::smallint,
          nullif(p_data->>'beds', '')::smallint,
          nullif(p_data->>'ac', '')::smallint,
          nullif(p_data->>'wifi', '')::smallint,
          nullif(p_data->>'communication', '')::smallint,
          (p_data->>'kitchen_ok')::boolean,
          v_missing,
          nullif(p_data->>'recommend', '')::smallint,
          v_liked, v_improve, v_perm);
end;
$$;

-- Reseñas publicadas: nombre corto ("María G."), lo que más le gustó y las notas. Nada privado.
create or replace function public.public_reviews()
returns table (
  id uuid,
  property_id uuid,
  author text,
  nights smallint,
  rating numeric,
  cleanliness smallint,
  beds smallint,
  ac smallint,
  wifi smallint,
  communication smallint,
  recommend smallint,
  liked text,
  reply text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.property_id,
         case when r.author_name = '' then 'Huésped'
              else split_part(r.author_name, ' ', 1) || coalesce(' ' || nullif(left(split_part(r.author_name, ' ', 2), 1), '') || '.', '') end,
         r.nights,
         round((select avg(x) from unnest(array[r.cleanliness, r.beds, r.ac, r.wifi, r.communication]) as x), 1),
         r.cleanliness, r.beds, r.ac, r.wifi, r.communication, r.recommend, r.liked, r.reply, r.created_at
    from public.reviews r
    join public.properties p on p.id = r.property_id
   where r.status = 'publicada' and r.permission <> 'no' and r.liked <> '' and p.published
   order by r.created_at desc
   limit 200
$$;

-- ---------------------------------------------------------------------
-- Importar respuestas del Google Form anterior (solo el panel).
-- Sin freno de spam y con la fecha original; quedan "pendientes" para revisarlas.
-- ---------------------------------------------------------------------
create or replace function public.import_review(p_property uuid, p_data jsonb, p_created_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.acting_owner();
  v_perm text := coalesce(p_data->>'permission', 'no');
begin
  if auth.uid() is null or public.staff_owner() is not null then
    raise exception 'Solo el panel puede importar' using errcode = '42501';
  end if;
  if not exists (select 1 from public.properties where id = p_property and owner_id = v_owner) then
    raise exception 'Ese apartamento no es de este panel' using errcode = '42501';
  end if;
  if v_perm not in ('si', 'no', 'consultar') then
    v_perm := 'no';
  end if;
  insert into public.reviews (owner_id, property_id, author_name, nights, cleanliness, beds, ac, wifi, communication,
                              kitchen_ok, kitchen_missing, recommend, liked, improve, permission, created_at)
  values (v_owner, p_property,
          left(trim(coalesce(p_data->>'author_name', '')), 60),
          nullif(p_data->>'nights', '')::smallint,
          nullif(p_data->>'cleanliness', '')::smallint,
          nullif(p_data->>'beds', '')::smallint,
          nullif(p_data->>'ac', '')::smallint,
          nullif(p_data->>'wifi', '')::smallint,
          nullif(p_data->>'communication', '')::smallint,
          (p_data->>'kitchen_ok')::boolean,
          left(trim(coalesce(p_data->>'kitchen_missing', '')), 300),
          nullif(p_data->>'recommend', '')::smallint,
          left(trim(coalesce(p_data->>'liked', '')), 1000),
          coalesce(nullif(left(trim(coalesce(p_data->>'improve', '')), 1000), ''), 'Sin comentarios'),
          v_perm,
          least(coalesce(p_created_at, now()), now()));
end;
$$;

revoke all on function public.import_review(uuid, jsonb, timestamptz) from public;
grant execute on function public.import_review(uuid, jsonb, timestamptz) to authenticated;
revoke all on function public.submit_review(uuid, jsonb) from public;
revoke all on function public.public_reviews() from public;
grant execute on function public.submit_review(uuid, jsonb) to anon, authenticated;
grant execute on function public.public_reviews() to anon, authenticated;
