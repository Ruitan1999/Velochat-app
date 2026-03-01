-- Run this in Supabase Dashboard → SQL Editor to see why the trigger isn't calling the Edge Function.
-- Copy the results and fix whatever is missing.

-- 1. Does the trigger exist?
select 'Trigger exists: ' || count(*)::text as check_trigger
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'messages' and t.tgname = 'on_new_message_send_notification';
-- Expect: 1 row, "Trigger exists: 1". If 0, run migration 011.

-- 2. Is the vault secret set? (Checks that a row exists for this name.)
select 'Vault secret exists: ' || case when count(*) > 0 then 'yes' else 'NO – run setup_push_vault_secret.sql' end as check_vault
from vault.decrypted_secrets
where name = 'supabase_service_role_key';
-- Expect: "Vault secret exists: yes". If "NO", run setup_push_vault_secret.sql with your service role key.

-- 3. Is pg_net extension available?
select 'pg_net extension: ' || case when exists (select 1 from pg_extension where extname = 'pg_net') then 'installed' else 'MISSING' end as check_pg_net;
-- Expect: "pg_net extension: installed". If MISSING, run: create extension if not exists pg_net with schema extensions;
