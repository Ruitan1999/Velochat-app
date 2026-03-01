-- Remove handle from profiles and clubs
-- Run after 001_initial_schema (and any visibility/other migrations)

-- 1. Update trigger: new users no longer get a handle column
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Rider'),
    coalesce(new.raw_user_meta_data->>'avatar_initials', 'RD')
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Drop handle from profiles
alter table public.profiles drop column if exists handle;

-- 3. Drop handle from clubs
alter table public.clubs drop column if exists handle;
