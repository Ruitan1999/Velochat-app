-- ============================================================
-- VeloChat Migration 002 — Route support
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- ============================================================

-- ─── Add route columns to rides ───────────────────────────────
alter table public.rides
  add column if not exists route_polyline text,          -- encoded polyline string
  add column if not exists route_distance_km float,      -- km
  add column if not exists route_elevation_m float,      -- metres elevation gain
  add column if not exists route_name text,              -- display name
  add column if not exists route_file_url text;          -- original GPX/FIT file URL

-- ─── Add Strava fields to profiles ────────────────────────────
alter table public.profiles
  add column if not exists strava_athlete_id bigint,
  add column if not exists strava_connected boolean default false;

-- ─── Create Supabase Storage bucket for route files ───────────
-- Run this in the Supabase Dashboard → Storage → New bucket
-- OR uncomment and run via SQL (requires storage extension):

-- insert into storage.buckets (id, name, public)
-- values ('ride-routes', 'ride-routes', true)
-- on conflict do nothing;

-- Storage RLS: allow authenticated users to upload, anyone to read
-- create policy "Authenticated users can upload routes"
--   on storage.objects for insert
--   with check (bucket_id = 'ride-routes' and auth.role() = 'authenticated');

-- create policy "Route files are publicly readable"
--   on storage.objects for select
--   using (bucket_id = 'ride-routes');

-- create policy "Users can delete their own route files"
--   on storage.objects for delete
--   using (bucket_id = 'ride-routes' and auth.uid()::text = (storage.foldername(name))[1]);


-- ─── MANUAL STEP: Create Storage Bucket ───────────────────────
-- In Supabase Dashboard:
-- 1. Go to Storage
-- 2. Click "New bucket"
-- 3. Name: ride-routes
-- 4. Toggle "Public bucket" ON
-- 5. Click Create
