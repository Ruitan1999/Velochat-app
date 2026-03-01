-- Run this to see who is in each chat room. For push to work, the RECIPIENT must
-- be in chat_participants for that room (the sender is excluded by the trigger).
-- If the other user isn't listed here, they never joined the ride chat – have them
-- open the ride and tap "Ride Chat" so they get added.

select
  cr.id as room_id,
  cr.title as room_title,
  cr.ride_id,
  array_agg(cp.user_id) as participant_user_ids
from chat_rooms cr
left join chat_participants cp on cp.room_id = cr.id
where cr.type = 'ride'
group by cr.id, cr.title, cr.ride_id
order by cr.id desc
limit 10;
