-- Run this in Supabase SQL Editor to verify the is_active setup.
-- Run each section separately if you prefer (comment out the others).

-- 1) Does the column exist? (expect 1 row: is_active | boolean | false)
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'chat_participants'
  and column_name = 'is_active';

-- 2) Current is_active values (user in room should show is_active = true)
select cp.room_id, cp.user_id, cp.is_active, cp.last_read_at, p.name
from chat_participants cp
join profiles p on p.id = cp.user_id
order by cp.last_read_at desc
limit 30;

-- 3) Trigger must contain "is_active = false" in the recipient query
select case
  when prosrc like '%is_active%false%' then 'OK: trigger filters by is_active'
  else 'MISSING: run fix_trigger_trim_vault_key.sql to add is_active filter'
end as trigger_check
from pg_proc
where proname = 'notify_message_recipients';
