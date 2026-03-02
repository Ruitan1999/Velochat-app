-- Allow finding a profile by exact email for club invite (so private accounts can be found when inviter knows their email)
create or replace function public.get_profile_by_invite_email(p_email text)
returns setof public.profiles
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(trim(u.email)) = lower(trim(nullif(p_email, '')));
$$;

comment on function public.get_profile_by_invite_email(text) is 'Returns the profile for the user with the given email, for club-invite search. Allows finding private accounts by exact email.';
