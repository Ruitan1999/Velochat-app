-- Fix: allow room creators to insert participants for other users.
-- The original RLS only allowed inserting rows where user_id = auth.uid(),
-- which silently blocked bulk-adding club members to a new chat room.

create policy "Room creators can add participants"
  on chat_participants for insert
  with check (
    exists (
      select 1 from chat_rooms
      where chat_rooms.id = room_id
        and chat_rooms.created_by = auth.uid()
    )
  );
