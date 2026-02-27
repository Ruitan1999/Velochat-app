-- Returns unread message count per room for a user (messages from others after last_read_at)
create or replace function public.get_unread_counts(p_user_id uuid)
returns table(room_id uuid, unread_count bigint) as $$
  select
    m.room_id,
    count(*)
  from messages m
  join chat_participants cp on cp.room_id = m.room_id and cp.user_id = p_user_id
  where m.created_at > cp.last_read_at
    and m.sender_id != p_user_id
  group by m.room_id;
$$ language sql security definer;

-- Allow participants to update their own last_read_at (for marking messages as read)
create policy "Participants can update own last_read_at"
  on chat_participants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
