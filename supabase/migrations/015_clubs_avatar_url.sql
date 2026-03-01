-- Club profile picture: same avatars bucket, path clubs/{club_id}/avatar.{ext}
-- Only club admins can upload/update their club's avatar.

alter table public.clubs
  add column if not exists avatar_url text;

-- Club avatars: path prefix clubs/{club_id}/...
-- Allow club admins to upload/update their club's avatar in the avatars bucket
create policy "Club admins can upload club avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and exists (
      select 1 from public.clubs
      where id::text = (storage.foldername(name))[2]
        and admin_id = auth.uid()
    )
  );

create policy "Club admins can update club avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'clubs'
    and exists (
      select 1 from public.clubs
      where id::text = (storage.foldername(name))[2]
        and admin_id = auth.uid()
    )
  );

-- SELECT for avatars bucket is already public (Avatars are publicly readable)
