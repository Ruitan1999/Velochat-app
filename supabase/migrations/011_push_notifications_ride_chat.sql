-- Push notifications for ride chat messages via OneSignal.
-- Auth: uses a custom push_trigger_secret (not the service_role key) to avoid key format issues.
-- The trigger sends x-trigger-secret header; the Edge Function checks it against PUSH_TRIGGER_SECRET env.

create or replace function public.notify_message_recipients()
returns trigger
language plpgsql
security definer
as $$
declare
  v_room_title text;
  v_sender_name text;
  v_recipient_ids uuid[];
  v_payload jsonb;
  v_body text;
  v_trigger_secret text;
begin
  -- Use the ride's live title for ride chats (so renamed rides show the updated title)
  select coalesce(r.title, cr.title) into v_room_title
  from chat_rooms cr
  left join rides r on r.id = cr.ride_id
  where cr.id = NEW.room_id;

  select name into v_sender_name
  from profiles where id = NEW.sender_id;

  -- Exclude the sender and anyone currently viewing the room (they see it in real-time)
  select array_agg(user_id) into v_recipient_ids
  from chat_participants
  where room_id = NEW.room_id
    and user_id != NEW.sender_id
    and is_active = false;

  if v_recipient_ids is null or array_length(v_recipient_ids, 1) is null then
    return NEW;
  end if;

  select trim(decrypted_secret) into v_trigger_secret
  from vault.decrypted_secrets
  where name = 'push_trigger_secret'
  limit 1;

  if v_trigger_secret is null or v_trigger_secret = '' then
    raise warning 'push_trigger_secret not found in vault – skipping push';
    return NEW;
  end if;

  v_body := coalesce(v_sender_name, 'Someone') || ': '
    || case
         when NEW.image_url is not null and coalesce(trim(NEW.text), '') = '' then 'Sent a photo'
         else left(coalesce(NEW.text, ''), 200)
       end;

  v_payload := jsonb_build_object(
    'recipientIds', to_jsonb(v_recipient_ids),
    'title', coalesce(v_room_title, 'New message'),
    'body', v_body,
    'data', jsonb_build_object(
      'roomId', NEW.room_id::text,
      'type', 'chat'
    )
  );

  perform net.http_post(
    url := 'https://hvwkcukmynnogoktyspl.supabase.co/functions/v1/send-notification',
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-trigger-secret', v_trigger_secret
    )
  );

  return NEW;
end;
$$;

drop trigger if exists on_new_message_send_notification on messages;
create trigger on_new_message_send_notification
  after insert on messages
  for each row
  execute function notify_message_recipients();
