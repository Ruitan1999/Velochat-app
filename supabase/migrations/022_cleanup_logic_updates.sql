-- Update cleanup logic for expired rooms and rides, and ensure notifications are removed.

-- 1. Trigger function to cleanup notifications when a ride is deleted
create or replace function public.on_ride_deleted_cleanup_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete notifications where rideId matches
  delete from public.notifications
  where data->>'rideId' = OLD.id::text;
  
  -- Note: notifications for the associated chat room(s) will be handled 
  -- by the chat_room deletion trigger when the CASCADE happens.
  
  return OLD;
end;
$$;

-- 2. Trigger function to cleanup notifications when a chat room is deleted
create or replace function public.on_chat_room_deleted_cleanup_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where data->>'roomId' = OLD.id::text;
  
  return OLD;
end;
$$;

-- 3. Create triggers
drop trigger if exists tr_ride_deleted_cleanup_notifications on public.rides;
create trigger tr_ride_deleted_cleanup_notifications
  before delete on public.rides
  for each row
  execute function public.on_ride_deleted_cleanup_notifications();

drop trigger if exists tr_chat_room_deleted_cleanup_notifications on public.chat_rooms;
create trigger tr_chat_room_deleted_cleanup_notifications
  before delete on public.chat_rooms
  for each row
  execute function public.on_chat_room_deleted_cleanup_notifications();

-- 4. Update delete_expired_chat_rooms to also remove associated rides
create or replace function public.delete_expired_chat_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_rides_count integer := 0;
  v_deleted_rooms_count integer := 0;
begin
  -- Deleting a ride will cascade to its chat room(s) and trigger notification cleanup.
  -- We identify rides whose chat rooms have expired.
  with expired_ride_ids as (
    select distinct ride_id 
    from public.chat_rooms 
    where expiry < now() and type = 'ride' and ride_id is not null
  ),
  deleted_rides as (
    delete from public.rides
    where id in (select ride_id from expired_ride_ids)
    returning id
  )
  select count(*) into v_deleted_rides_count from deleted_rides;

  -- Delete remaining expired chat rooms (general chats or those not linked to a ride)
  with deleted_rooms as (
    delete from public.chat_rooms
    where expiry < now()
    returning id
  )
  select count(*) into v_deleted_rooms_count from deleted_rooms;

  return v_deleted_rides_count + v_deleted_rooms_count;
end;
$$;

comment on function public.delete_expired_chat_rooms() is 'Deletes expired chat rooms. If the room is a ride chat, it deletes the associated ride (which cascades back to clean up the room). Also cleans up related notifications via triggers.';
