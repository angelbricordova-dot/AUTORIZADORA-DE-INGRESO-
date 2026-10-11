-- =====================================================================
-- Fotos de los apartamentos (Supabase Storage)
-- Bucket público de solo lectura: cualquiera puede VER una foto publicada,
-- pero solo un usuario con sesión puede subir o borrar, y solo en su carpeta.
-- Límite 5 MB, solo JPG/PNG/WEBP (la app las reduce a ~300 KB antes de subir).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: subir en su carpeta" on storage.objects;
drop policy if exists "fotos: borrar en su carpeta" on storage.objects;

create policy "fotos: subir en su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "fotos: borrar en su carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
