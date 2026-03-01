-- One-off test: call the Edge Function from the DB (same way the trigger does).
-- 1. Replace YOUR_RECIPIENT_USER_UUID with one of your Supabase user IDs (so you get the push).
-- 2. Run this in SQL Editor.
-- 3. Wait ~5 seconds, then run check_pg_net_responses.sql to see the response.
-- If you get status 200 and a push on your device, the function works and the issue is the trigger (e.g. no recipients for the room).

do $$
declare
  v_key text;
  v_req_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key'
  limit 1;

  if v_key is null then
    raise exception 'Vault secret supabase_service_role_key not found. Run setup_push_vault_secret.sql first.';
  end if;

  v_req_id := net.http_post(
    url := 'https://hvwkcukmynnogoktyspl.supabase.co/functions/v1/send-notification',
    body := jsonb_build_object(
      'recipientIds', jsonb_build_array('YOUR_RECIPIENT_USER_UUID'),
      'title', 'Test from SQL',
      'body', 'If you get this, the DB can call the function.',
      'data', jsonb_build_object('roomId', 'test', 'type', 'chat')
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    )
  );

  raise notice 'pg_net request id: %. Check extensions._http_response (or net._http_response) in a few seconds.', v_req_id;
end $$;
