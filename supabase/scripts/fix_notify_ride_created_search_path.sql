-- Run in SQL Editor if ride-created notifications still don't fire after applying 016.
-- Fixes: function net.http_post not found (pg_net lives in schema "extensions").

create or replace function public.notify_ride_created(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_created_by uuid;
  v_room_title text;
  v_ride_id uuid;
  v_recipient_ids uuid[];
  v_trigger_secret text;
  v_payload jsonb;
  v_url text;
begin
  v_url := nullif(trim(current_setting('app.settings.supabase_url', true)), '');
  if v_url is null then
    v_url := 'https://hvwkcukmynnogoktyspl.supabase.co/functions/v1/send-notification';
  else
    v_url := rtrim(v_url, '/') || '/functions/v1/send-notification';
  end if;

  select cr.created_by, coalesce(r.title, cr.title), cr.ride_id
  into v_created_by, v_room_title, v_ride_id
  from chat_rooms cr
  left join rides r on r.id = cr.ride_id
  where cr.id = p_room_id and cr.type = 'ride';

  if v_created_by is null then
    return;
  end if;

  if auth.uid() is distinct from v_created_by then
    raise exception 'Only the room creator can trigger ride-created notification';
  end if;

  select array_agg(cp.user_id) into v_recipient_ids
  from chat_participants cp
  where cp.room_id = p_room_id and cp.user_id != v_created_by;

  if v_recipient_ids is null or array_length(v_recipient_ids, 1) is null then
    return;
  end if;

  select trim(decrypted_secret) into v_trigger_secret
  from vault.decrypted_secrets
  where name = 'push_trigger_secret'
  limit 1;

  if v_trigger_secret is null or v_trigger_secret = '' then
    raise warning 'push_trigger_secret not found in vault – skipping ride-created push';
    return;
  end if;

  v_payload := jsonb_build_object(
    'recipientIds', to_jsonb(v_recipient_ids),
    'title', 'New ride: ' || coalesce(v_room_title, 'Group ride'),
    'body', 'Tap to view the ride and chat.',
    'data', jsonb_build_object(
      'roomId', p_room_id::text,
      'rideId', coalesce(v_ride_id::text, ''),
      'type', 'ride_created'
    )
  );

  perform net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', v_trigger_secret
    )
  );
end;
$$;

grant execute on function public.notify_ride_created(uuid) to authenticated;
