-- Run in Supabase SQL Editor to debug "ride created" notifications.
-- 1) Check a recent ride room and who would get notified:
select
  cr.id as room_id,
  cr.title as room_title,
  cr.created_by,
  (select count(*) from chat_participants cp where cp.room_id = cr.id) as total_participants,
  (select count(*) from chat_participants cp where cp.room_id = cr.id and cp.user_id != cr.created_by) as recipient_count,
  (select array_agg(cp.user_id) from chat_participants cp where cp.room_id = cr.id and cp.user_id != cr.created_by) as recipient_ids
from chat_rooms cr
where cr.type = 'ride'
order by cr.created_at desc
limit 5;

-- 2) Check vault secret exists (required for notify_ride_created):
select 'Vault push_trigger_secret: ' || case when count(*) > 0 then 'set' else 'MISSING' end as check_vault
from vault.decrypted_secrets
where name = 'push_trigger_secret';

-- 3) Manually trigger notification for a ride room (replace ROOM_ID with a real ride chat_rooms.id;
--    you must be the room creator when calling from the app; from SQL you're bypassing auth):
-- do $$
-- declare
--   v_room_id uuid := 'ROOM_ID_HERE'::uuid;
-- begin
--   perform public.notify_ride_created(v_room_id);
--   raise notice 'RPC completed. Check pg_net / Edge Function logs.';
-- end;
-- $$;
