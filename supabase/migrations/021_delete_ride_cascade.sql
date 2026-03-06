-- When a user deletes a ride, remove the ride and all related data in one place:
-- messages (in the ride's chat room), chat_participants, chat_rooms, ride_rsvps,
-- ride_invites, and finally the ride. Only the ride organizer can call this.

create or replace function public.delete_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizer_id uuid;
  v_room_ids uuid[];
begin
  select organizer_id into v_organizer_id
  from public.rides
  where id = p_ride_id;

  if v_organizer_id is null then
    return; -- ride not found, no-op
  end if;

  if auth.uid() is distinct from v_organizer_id then
    raise exception 'Only the ride organizer can delete this ride';
  end if;

  -- Collect chat room ids for this ride
  select array_agg(id) into v_room_ids
  from public.chat_rooms
  where ride_id = p_ride_id;

  -- Delete in dependency order so FK constraints are satisfied
  if v_room_ids is not null and array_length(v_room_ids, 1) > 0 then
    delete from public.messages where room_id = any(v_room_ids);
    delete from public.chat_participants where room_id = any(v_room_ids);
  end if;

  delete from public.chat_rooms where ride_id = p_ride_id;
  delete from public.ride_rsvps where ride_id = p_ride_id;
  delete from public.ride_invites where ride_id = p_ride_id;
  delete from public.rides where id = p_ride_id;
end;
$$;

comment on function public.delete_ride(uuid) is 'Deletes a ride and all related data: messages, chat_participants, chat_rooms, ride_rsvps, ride_invites. Callable only by the ride organizer.';

grant execute on function public.delete_ride(uuid) to authenticated;
