-- Run in Supabase SQL Editor. RPCs run with elevated privileges so RLS cannot block them.
-- When entering the room (p_active true): upserts participant and sets last_read_at = now(), is_active = true.
-- When leaving (p_active false): sets is_active = false (last_read_at unchanged).

create or replace function public.set_chat_participant_active(p_room_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into chat_participants (room_id, user_id, last_read_at, is_active)
  values (p_room_id, auth.uid(), now(), p_active)
  on conflict (room_id, user_id) do update set
    is_active = p_active,
    last_read_at = case when p_active then now() else chat_participants.last_read_at end;
end;
$$;

-- Update only last_read_at (e.g. when user scrolls to bottom). Also definer so RLS cannot block.
create or replace function public.set_chat_participant_last_read(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into chat_participants (room_id, user_id, last_read_at, is_active)
  values (p_room_id, auth.uid(), now(), false)
  on conflict (room_id, user_id) do update set last_read_at = now();
end;
$$;
