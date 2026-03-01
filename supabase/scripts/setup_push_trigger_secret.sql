-- Step 1: Store a shared secret in Vault so the DB trigger can authenticate to the Edge Function.
--
-- This replaces the old approach of using the service_role key (which broke due to
-- Supabase's new vs legacy key format mismatch).
--
-- Run this in Supabase Dashboard → SQL Editor.
--
-- 1. Pick any strong random string (e.g. run: openssl rand -hex 32)
-- 2. Replace YOUR_TRIGGER_SECRET_HERE below with that string.
-- 3. Run this script.
-- 4. Then go to Dashboard → Edge Functions → send-notification → Secrets
--    and add a secret named PUSH_TRIGGER_SECRET with the SAME value.
-- 5. Redeploy: supabase functions deploy send-notification --no-verify-jwt

-- Remove old secret if it exists
delete from vault.secrets where name = 'push_trigger_secret';

select vault.create_secret(
  'YOUR_TRIGGER_SECRET_HERE',
  'push_trigger_secret',
  'Shared secret for DB trigger to call send-notification Edge Function'
);
