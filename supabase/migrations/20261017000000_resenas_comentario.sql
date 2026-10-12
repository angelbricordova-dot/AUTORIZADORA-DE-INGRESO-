-- =====================================================================
-- Tu Día en Tucacas · comentario público en la encuesta
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 20261016000000_resenas.sql
--
-- Nueva pregunta "Deja un comentario sobre tu estadía": es lo que se publica
-- en la página (con permiso del huésped y aprobación del panel).
-- "Lo que más te gustó" y "qué mejorarías" quedan solo para el panel.
-- =====================================================================

alter table public.reviews
  add column if not exists comment text not null default '' check (char_length(comment) <= 1000);

-- Las respuestas importadas del Google Form: el permiso era sobre "lo que más te gustó"
update public.reviews set comment = liked where comment = '' and liked <> '';

-- Para publicar hace falta permiso y un comentario
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.reviews'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%publicada%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.reviews add constraint reviews_publicar_con_permiso
  check (status <> 'publicada' or (permission <> 'no' and comment <> ''));

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
  v_comment text := left(trim(coalesce(p_data->>'comment', '')), 1000);
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
  if v_perm <> 'no' and v_comment <> '' and char_length(v_name) < 2 then
    raise exception 'Escribe tu nombre para poder mostrar tu comentario' using errcode = '22023';
  end if;
  if v_name ~ '[<>{}]' or (v_liked || ' ' || v_improve || ' ' || v_comment || ' ' || v_missing) ~* '(https?://|www\.)' then
    raise exception 'La encuesta no puede llevar enlaces' using errcode = '22023';
  end if;
  if (select count(*) from public.reviews where created_at > now() - interval '1 hour') >= 15 then
    raise exception 'Recibimos muchas respuestas en este momento. Inténtalo más tarde.' using errcode = '54000';
  end if;
  if exists (select 1 from public.reviews where property_id = p_property and lower(improve) = lower(v_improve)
               and lower(liked) = lower(v_liked) and lower(comment) = lower(v_comment)) then
    raise exception 'Esa respuesta ya la recibimos. ¡Gracias!' using errcode = '23505';
  end if;
  insert into public.reviews (owner_id, property_id, author_name, nights, cleanliness, beds, ac, wifi, communication,
                              kitchen_ok, kitchen_missing, recommend, liked, improve, comment, permission)
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
          v_liked, v_improve, v_comment, v_perm);
end;
$$;

-- Ahora el texto público es el comentario (antes era "lo que más te gustó")
drop function if exists public.public_reviews();
create function public.public_reviews()
returns table (
  id uuid, property_id uuid, author text, nights smallint, rating numeric,
  cleanliness smallint, beds smallint, ac smallint, wifi smallint, communication smallint,
  recommend smallint, comment text, reply text, created_at timestamptz
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
         r.cleanliness, r.beds, r.ac, r.wifi, r.communication, r.recommend, r.comment, r.reply, r.created_at
    from public.reviews r
    join public.properties p on p.id = r.property_id
   where r.status = 'publicada' and r.permission <> 'no' and r.comment <> '' and p.published
   order by r.created_at desc
   limit 200
$$;

create or replace function public.import_review(p_property uuid, p_data jsonb, p_created_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.acting_owner();
  v_perm text := coalesce(p_data->>'permission', 'no');
  v_liked text := left(trim(coalesce(p_data->>'liked', '')), 1000);
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
                              kitchen_ok, kitchen_missing, recommend, liked, improve, comment, permission, created_at)
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
          v_liked,
          coalesce(nullif(left(trim(coalesce(p_data->>'improve', '')), 1000), ''), 'Sin comentarios'),
          -- en el formulario anterior el permiso era sobre "lo que más te gustó"
          coalesce(nullif(left(trim(coalesce(p_data->>'comment', '')), 1000), ''), v_liked),
          v_perm,
          least(coalesce(p_created_at, now()), now()));
end;
$$;

revoke all on function public.public_reviews() from public;
grant execute on function public.public_reviews() to anon, authenticated;
