-- Server-side push notifications on new messages
-- Uses pg_net to call the send-notification Edge Function
-- Requires: service role key stored in vault (see instructions below)
--
-- SETUP (run once in SQL Editor):
--   select vault.create_secret(
--     'YOUR_SERVICE_ROLE_KEY_HERE',
--     'supabase_service_role_key',
--     'Service role key for Edge Function calls'
--   );

create extension if not exists pg_net with schema extensions;

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
  v_service_key text;
begin
  select title into v_room_title
  from chat_rooms where id = NEW.room_id;

  select name into v_sender_name
  from profiles where id = NEW.sender_id;

  select array_agg(user_id) into v_recipient_ids
  from chat_participants
  where room_id = NEW.room_id
    and user_id != NEW.sender_id;

  if v_recipient_ids is null or array_length(v_recipient_ids, 1) is null then
    return NEW;
  end if;

  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key'
  limit 1;

  if v_service_key is null then
    raise warning 'supabase_service_role_key not found in vault – skipping push';
    return NEW;
  end if;

  v_payload := jsonb_build_object(
    'recipientIds', to_jsonb(v_recipient_ids),
    'title', coalesce(v_room_title, 'New message'),
    'body', coalesce(v_sender_name, 'Someone') || ': ' || left(NEW.text, 200),
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
      'Authorization', 'Bearer ' || v_service_key
    )
  );

  return NEW;
end;
$$;

create trigger on_new_message_send_notification
  after insert on public.messages
  for each row
  execute function public.notify_message_recipients();
