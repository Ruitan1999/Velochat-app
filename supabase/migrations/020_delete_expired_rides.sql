-- Delete rides that are past 24 hours after their scheduled time.
-- Deleting a ride CASCADEs to: ride_rsvps, ride_invites, chat_rooms (and then
-- chat_participants, messages). So one delete from rides cleans up the whole
-- chat room and RSVPs for that ride.
-- Run periodically via pg_cron (same extension as 019).

-- Add column so we can identify "ride datetime" for expiry (24h after = delete).
alter table public.rides
  add column if not exists scheduled_at timestamptz;

comment on column public.rides.scheduled_at is 'Scheduled start of the ride (date+time). Rides are deleted when scheduled_at + 24h < now().';

create or replace function public.delete_expired_rides()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with deleted as (
    delete from public.rides
    where scheduled_at is not null
      and (scheduled_at + interval '24 hours') < now()
    returning id
  )
  select count(*)::integer into deleted_count from deleted;
  return deleted_count;
end;
$$;

-- Allow service role / cron to run (pg_cron runs as postgres). No need for authenticated.
grant execute on function public.delete_expired_rides() to service_role;

-- Schedule job to run every hour (at minute 5, after delete-expired-chat-rooms at 0).
select cron.schedule(
  'delete-expired-rides',
  '5 * * * *',
  'select public.delete_expired_rides()'
);
