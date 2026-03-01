-- Realtime UPDATE with filter (e.g. user_id=eq.xxx) needs full row in the event.
-- Default replica identity (primary key) may not include filtered columns in all cases.
alter table public.chat_participants replica identity full;
