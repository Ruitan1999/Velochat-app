-- Delete the currently authenticated user and cascade to all related data.
-- Uses foreign key ON DELETE rules defined in 001_initial_schema.sql.
create or replace function public.delete_current_user()
returns void as $$
begin
  -- This deletes from auth.users; profiles and all dependent rows
  -- (friendships, club_members, rides, RSVPs, chat_participants, notifications, etc.)
  -- are cleaned up via ON DELETE CASCADE / SET NULL.
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

