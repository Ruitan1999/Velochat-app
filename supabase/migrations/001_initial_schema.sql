-- ============================================================
-- VeloChat Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific fields
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  handle text unique not null,         -- e.g. @alexr
  avatar_initials text not null,       -- e.g. "AR"
  avatar_color text default '#3B82F6', -- hex color
  avatar_url text,                     -- optional photo
  bio text,
  fcm_token text,                      -- Firebase Cloud Messaging token
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── FRIENDSHIPS ─────────────────────────────────────────────
create table public.friendships (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- ─── CLUBS ───────────────────────────────────────────────────
create table public.clubs (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  handle text unique not null,
  avatar_initials text not null,
  color text default '#3B82F6',
  description text,
  visibility text check (visibility in ('public','private')) default 'private',
  admin_id uuid references profiles(id) on delete set null,
  member_count int default 1,
  created_at timestamptz default now()
);

create table public.club_members (
  club_id uuid references clubs(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamptz default now(),
  primary key (club_id, user_id)
);

-- ─── RIDES ───────────────────────────────────────────────────
create table public.rides (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  date text not null,              -- display string e.g. "Tomorrow", "Sat 1 Mar"
  time text not null,              -- 24h format "05:45"
  distance text,                   -- optional e.g. "42km"
  location text,                   -- optional
  organizer_id uuid references profiles(id) on delete cascade not null,
  club_id uuid references clubs(id) on delete set null,
  invite_type text check (invite_type in ('club', 'riders')) default 'club',
  chat_expiry timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- RSVPs
create table public.ride_rsvps (
  ride_id uuid references rides(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text check (status in ('in', 'out')) not null,
  created_at timestamptz default now(),
  primary key (ride_id, user_id)
);

-- Riders invited individually
create table public.ride_invites (
  ride_id uuid references rides(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (ride_id, user_id)
);

-- ─── CHAT ROOMS ───────────────────────────────────────────────
create table public.chat_rooms (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  type text check (type in ('ride', 'general')) not null,
  ride_id uuid references rides(id) on delete cascade,   -- null for general chats
  club_id uuid references clubs(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  expiry timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

create table public.chat_participants (
  room_id uuid references chat_rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  last_read_at timestamptz default now(),
  primary key (room_id, user_id)
);

-- ─── MESSAGES ─────────────────────────────────────────────────
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  room_id uuid references chat_rooms(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete set null not null,
  text text not null,
  created_at timestamptz default now()
);

-- Index for fast message retrieval
create index messages_room_id_created_at on messages(room_id, created_at);

-- ─── NOTIFICATIONS LOG ────────────────────────────────────────
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,             -- 'new_message' | 'ride_invite' | 'friend_request' | 'rsvp'
  title text not null,
  body text,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.rides enable row level security;
alter table public.ride_rsvps enable row level security;
alter table public.ride_invites enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- Profiles: anyone authenticated can read, only owner can update
create policy "Profiles are viewable by authenticated users"
  on profiles for select using (auth.role() = 'authenticated');
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Friendships: users see their own friendships
create policy "Users see own friendships"
  on friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Users can create friendship requests"
  on friendships for insert with check (auth.uid() = requester_id);
create policy "Users can update friendships they are part of"
  on friendships for update using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Users can delete their own friendship requests"
  on friendships for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Clubs: everyone can view, members can interact
create policy "Clubs viewable by all authenticated"
  on clubs for select using (auth.role() = 'authenticated');
create policy "Authenticated users can create clubs"
  on clubs for insert with check (auth.role() = 'authenticated');
create policy "Admins can update their clubs"
  on clubs for update using (auth.uid() = admin_id);
create policy "Admins can delete their clubs"
  on clubs for delete using (auth.uid() = admin_id);

create policy "Club members viewable by authenticated"
  on club_members for select using (auth.role() = 'authenticated');
create policy "Users can join clubs"
  on club_members for insert with check (auth.uid() = user_id);
create policy "Club admins can add members"
  on club_members for insert with check (
    exists (select 1 from clubs where id = club_id and admin_id = auth.uid())
  );
create policy "Users can leave clubs"
  on club_members for delete using (auth.uid() = user_id);
create policy "Admins can remove members"
  on club_members for delete using (
    exists (select 1 from clubs where id = club_id and admin_id = auth.uid())
  );

-- Rides: visible to club members or invitees
create policy "Rides viewable by club members"
  on rides for select using (
    auth.role() = 'authenticated' and (
      club_id is null or
      exists (select 1 from club_members where club_id = rides.club_id and user_id = auth.uid()) or
      organizer_id = auth.uid()
    )
  );
create policy "Authenticated users can create rides"
  on rides for insert with check (auth.uid() = organizer_id);
create policy "Organizers can update rides"
  on rides for update using (auth.uid() = organizer_id);
create policy "Organizers can delete rides"
  on rides for delete using (auth.uid() = organizer_id);

-- RSVPs
create policy "RSVPs viewable by ride participants"
  on ride_rsvps for select using (auth.role() = 'authenticated');
create policy "Users can manage their own RSVP"
  on ride_rsvps for all using (auth.uid() = user_id);

-- Chat rooms
create policy "Chat rooms viewable by participants"
  on chat_rooms for select using (
    exists (select 1 from chat_participants where room_id = chat_rooms.id and user_id = auth.uid())
    or created_by = auth.uid()
  );
create policy "Authenticated users can create chat rooms"
  on chat_rooms for insert with check (auth.uid() = created_by);
create policy "Creators can update their chat rooms"
  on chat_rooms for update using (auth.uid() = created_by);
create policy "Creators can delete their chat rooms"
  on chat_rooms for delete using (auth.uid() = created_by);

create policy "Participants viewable by room members"
  on chat_participants for select using (auth.role() = 'authenticated');
create policy "Users can join rooms"
  on chat_participants for insert with check (auth.uid() = user_id);

-- Messages
create policy "Messages viewable by room participants"
  on messages for select using (
    exists (select 1 from chat_participants where room_id = messages.room_id and user_id = auth.uid())
  );
create policy "Participants can send messages"
  on messages for insert with check (
    auth.uid() = sender_id and
    exists (select 1 from chat_participants where room_id = messages.room_id and user_id = auth.uid())
  );
create policy "Senders can delete their messages"
  on messages for delete using (auth.uid() = sender_id);

-- Notifications
create policy "Users see own notifications"
  on notifications for select using (auth.uid() = user_id);
create policy "System can insert notifications"
  on notifications for insert with check (true);
create policy "Users can mark notifications read"
  on notifications for update using (auth.uid() = user_id);

-- ─── REALTIME ─────────────────────────────────────────────────
-- Enable realtime on messages and notifications
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table ride_rsvps;

-- ─── FUNCTIONS ────────────────────────────────────────────────

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, handle, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Rider'),
    coalesce(new.raw_user_meta_data->>'handle', '@rider' || substring(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data->>'avatar_initials', 'RD')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update member count when club_members changes
create or replace function public.update_club_member_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update clubs set member_count = member_count + 1 where id = NEW.club_id;
  elsif (TG_OP = 'DELETE') then
    update clubs set member_count = member_count - 1 where id = OLD.club_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger club_member_count_trigger
  after insert or delete on club_members
  for each row execute procedure public.update_club_member_count();

-- Updated_at trigger for profiles
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure public.handle_updated_at();
