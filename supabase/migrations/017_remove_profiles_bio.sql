-- Remove bio column from profiles (feature removed)
alter table public.profiles drop column if exists bio;
