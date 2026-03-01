-- ============================================================
-- QA Fixes Migration
-- Addresses: sender_id constraint, missing RLS policies,
-- overly permissive policies, info-leak in get_unread_counts,
-- missing indexes, missing chat_participants delete policy
-- ============================================================

-- 1. Fix messages.sender_id: allow NULL when user is deleted
--    (ON DELETE SET NULL requires nullable column)
alter table public.messages alter column sender_id drop not null;

-- 2. ride_invites: add missing RLS policies (table has RLS enabled but zero policies)
create policy "Ride invites viewable by organizer or invitee"
  on ride_invites for select using (
    auth.uid() = user_id or
    exists (select 1 from rides where id = ride_id and organizer_id = auth.uid())
  );

create policy "Organizers can invite riders"
  on ride_invites for insert with check (
    exists (select 1 from rides where id = ride_id and organizer_id = auth.uid())
  );

create policy "Organizers can remove invites"
  on ride_invites for delete using (
    exists (select 1 from rides where id = ride_id and organizer_id = auth.uid())
  );

-- 3. Tighten notifications insert policy — only system (security definer) should insert
--    Drop the overly permissive "anyone can insert" policy
drop policy if exists "System can insert notifications" on notifications;

-- 4. chat_participants: allow users to leave rooms
create policy "Users can leave rooms"
  on chat_participants for delete using (auth.uid() = user_id);

-- 5. Fix get_unread_counts to use auth.uid() instead of accepting arbitrary user ID
--    Prevents info disclosure about other users' rooms
create or replace function public.get_unread_counts(p_user_id uuid)
returns table(room_id uuid, unread_count bigint) as $$
  select
    m.room_id,
    count(*)
  from messages m
  join chat_participants cp on cp.room_id = m.room_id and cp.user_id = auth.uid()
  where m.created_at > cp.last_read_at
    and m.sender_id != auth.uid()
  group by m.room_id;
$$ language sql security definer;

-- 6. Prevent self-friendship
alter table public.friendships
  add constraint no_self_friendship check (requester_id != addressee_id);

-- 7. Add missing indexes for common query patterns
create index if not exists idx_friendships_requester on friendships(requester_id);
create index if not exists idx_friendships_addressee on friendships(addressee_id);
create index if not exists idx_club_members_user on club_members(user_id);
create index if not exists idx_chat_participants_user on chat_participants(user_id);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_rides_club on rides(club_id);
create index if not exists idx_rides_organizer on rides(organizer_id);
create index if not exists idx_ride_rsvps_user on ride_rsvps(user_id);
create index if not exists idx_chat_rooms_ride on chat_rooms(ride_id);
