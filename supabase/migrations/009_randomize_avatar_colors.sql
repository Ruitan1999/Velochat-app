-- Randomize avatar_color for all existing profiles that still have the default blue.
-- Uses the same palette as the client-side getAvatarColor() function.

UPDATE profiles
SET avatar_color = (
  ARRAY[
    '#1D4ED8', -- blue700
    '#2563EB', -- blue600
    '#334155', -- slate700
    '#1E293B', -- slate800
    '#7C3AED', -- violet600
    '#059669', -- emerald600
    '#14B8A6', -- teal500
    '#F43F5E', -- rose500
    '#F97316'  -- orange500
  ]
)[1 + floor(random() * 9)::int]
WHERE avatar_color = '#3B82F6';

-- Also change the default for new rows so the DB trigger assigns a random color
ALTER TABLE profiles
  ALTER COLUMN avatar_color SET DEFAULT '#000000';

-- Create or replace the function that handles new user profile creation
-- so it picks a random color from the palette
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  palette text[] := ARRAY[
    '#1D4ED8','#2563EB','#334155','#1E293B',
    '#7C3AED','#059669','#14B8A6','#F43F5E','#F97316'
  ];
  rand_color text;
BEGIN
  rand_color := palette[1 + floor(random() * 9)::int];
  INSERT INTO public.profiles (id, name, avatar_initials, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_initials', 'U'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', rand_color)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    avatar_initials = COALESCE(EXCLUDED.avatar_initials, profiles.avatar_initials),
    avatar_color = COALESCE(EXCLUDED.avatar_color, profiles.avatar_color);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
