-- Delete expired chat rooms (expiry < now()).
-- Run periodically via pg_cron so expired rooms are removed from the database.
-- If the extension is not enabled, enable pg_cron in Dashboard: Integrations -> Cron.

create extension if not exists pg_cron with schema extensions;

create or replace function public.delete_expired_chat_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with deleted as (
    delete from public.chat_rooms
    where expiry < now()
    returning id
  )
  select count(*)::integer into deleted_count from deleted;
  return deleted_count;
end;
$$;

-- Allow authenticated users to trigger cleanup (e.g. when opening chats tab)
grant execute on function public.delete_expired_chat_rooms() to authenticated;

-- Schedule job to run every hour (at minute 0).
-- Requires pg_cron extension: enable in Supabase Dashboard -> Database -> Extensions.
select cron.schedule(
  'delete-expired-chat-rooms',
  '0 * * * *',
  'select public.delete_expired_chat_rooms()'
);
