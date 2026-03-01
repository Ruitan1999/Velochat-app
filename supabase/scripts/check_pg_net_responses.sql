-- Run this 10–20 seconds AFTER sending a message in the app. It shows whether pg_net
-- actually called the Edge Function and what response came back.
-- Try the one that exists in your project (net or extensions schema).

-- Option A: net schema – only columns that exist in Supabase pg_net (no "body" – some versions use different names)
select id, status_code, error_msg, created
from net._http_response
order by created desc
limit 5;

-- To see the full response (including body/content), run this and check the column names your project has:
-- select * from net._http_response order by created desc limit 1;

-- If "relation net._http_response does not exist", try Option B:
-- select id, status_code, error_msg, created from extensions._http_response order by created desc limit 5;

-- What to look for:
-- - No rows or no recent row (within last minute): trigger might not be firing, or vault key was null.
-- - status_code 200: function and OneSignal likely succeeded (run "select * ... limit 1" to see response body).
-- - status_code 401: wrong or missing service role key in headers.
-- - status_code 502: check Edge Function logs or "select * from net._http_response" for OneSignal error details.
