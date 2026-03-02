# Auth / OTP rate limits

When you see **"Too many requests"** or **429** when sending the verification code, Supabase Auth is rate limiting OTP emails.

## Default limits (Supabase)

- **OTP emails**: 30 per hour total (all users combined).
- **Per email**: One new OTP allowed every 60 seconds for the same email.

So during testing, a single email can only request a new code every 60 seconds, and the whole project is capped at 30 OTPs per hour unless you change it.

## How to increase the limit

### Option 1: Dashboard (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Rate Limits**  
   (or **Configuration** → **Auth** and find the rate limits section).
3. Adjust:
   - **OTP / Email sent**: e.g. **100** or **200** per hour for development; for 200+ users in production you may want **500+** or higher depending on sign-in frequency.
   - **Per-user window**: e.g. **30** seconds if you want to allow resend sooner (the app already has a 60s “Resend code” cooldown).

Save and wait a minute for the config to apply.

### Option 2: Management API

Use your [access token](https://supabase.com/dashboard/account/tokens) and project ref:

```bash
# Increase OTP limit (e.g. 200 per hour)
curl -X PATCH "https://api.supabase.com/v1/projects/YOUR_PROJECT_REF/config/auth" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rate_limit_otp": 200}'
```

Replace `YOUR_PROJECT_REF` and `YOUR_ACCESS_TOKEN`. Other related keys (see Supabase docs) include `rate_limit_email_sent` and per-user windows if your project exposes them.

## App behavior

- The **Resend code** button is disabled for 60 seconds after sending (see `RESEND_COOLDOWN_SEC` in `app/(auth)/otp.tsx`) to avoid hitting the per-email window.
- If the server returns a rate limit error, the user sees: *"Too many requests. Please wait about a minute before trying again."*

Increasing the Supabase OTP limit as above lets you test more often and supports more users in production.
