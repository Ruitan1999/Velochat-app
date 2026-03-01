-- Step 2: Store the service role key in Vault so the message push trigger can call the Edge Function.
--
-- Run this in the Supabase Dashboard → SQL Editor.
--
-- 1. In Dashboard go to Project Settings → API. Copy the "service_role" key (secret).
-- 2. Replace YOUR_SERVICE_ROLE_KEY_HERE below with that key (keep the quotes).
-- 3. Run this script.
--
-- If you get "duplicate key value violates unique constraint": the secret already exists.
-- Push is already configured; no action needed. To REPLACE it (e.g. fix 401 errors), run
-- the DELETE below first, then run the create_secret again with the correct key.

-- FIX 401: If the trigger gets 401 Unauthorized, the key in the vault is wrong. Do this:
-- 1. Run the DELETE line below (uncomment it).
-- 2. In Dashboard → Project Settings → API, copy the full "service_role" key (the secret, not anon).
-- 3. Paste it into the create_secret call below, replacing YOUR_SERVICE_ROLE_KEY_HERE (no extra spaces).
-- 4. Run the create_secret.

delete from vault.secrets where name = 'supabase_service_role_key';

select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2d2tjdWtteW5ub2dva3R5c3BsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEzODUwMCwiZXhwIjoyMDg3NzE0NTAwfQ.GTAWIZ8PQIedW_KQXbJh-WPoTZyeaQR2tL14HGxmLD8',
  'supabase_service_role_key',
  'Service role key for Edge Function calls (push notifications)'
);
