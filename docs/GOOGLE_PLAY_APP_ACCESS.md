# Google Play: App access / login credentials for review

Google Play requires you to declare how reviewers can access your app when it uses login, sign-in, or other restricted access.

## Where to fix it

1. Open **Google Play Console**: https://play.google.com/console  
2. Select your app (**VeloChat**).  
3. In the left menu go to **Policy** → **App content** (or **App content** in the main dashboard).  
4. Find the card **App access** (or **App access declaration**).  
5. Click **Start** or **Manage** (or **Fix** if it’s marked as an issue).

## What to declare

- **Does your app have restricted access?**  
  - If users must sign in (email/OTP, etc.) to use the app → choose **Yes, access is restricted** (or similar).  
  - If the app is fully usable without an account → choose **No** and save.

## If access is restricted (login required)

You must give Google **instructions and test credentials** so reviewers can sign in:

1. In the **App access** form, add **Instructions for access** (or “How to get access”), for example:

   ```
   VeloChat requires sign-in with email (magic link / OTP).
   
   To test:
   1. Open the app and tap Sign in / Log in.
   2. Enter the test account email below.
   3. Use the one-time code sent to that email, or use the test password if you use password sign-in.
   
   Test account (for Google Play review only):
   Email: [your-reviewer-test-email@example.com]
   Password: [test password, if applicable]
   
   If you need a code sent to the email, contact: [your-support-email]
   ```

2. In the **Credentials** (or similar) section, add:
   - **Test account email** (and password if your app uses password login).
   - Optionally a **demo account** or instructions to request access.

3. **Save** the form.

---

## Ready-to-paste: Sign up / Sign in with OTP (VeloChat)

VeloChat uses **email OTP only** (no password). Copy the text below into the **Instructions for access** and **Credentials** fields in the App access form. Replace the placeholder email with a real test account you control (e.g. a Gmail you use only for Play review).

### Instructions for access (paste into Play Console)

```
VeloChat uses email sign-in with a one-time code (OTP). There is no password.

HOW TO ACCESS THE APP (for reviewers):

Option A — Sign up (new account)
1. Open the app and tap "Sign up" (or "Create account").
2. Enter your name and the test account email below.
3. Tap to send the code. Check that email for a 6-digit one-time code from Supabase/VeloChat.
4. Enter the code in the app and tap Verify. You will be signed in.

Option B — Log in (existing account)
1. Open the app and tap "Log in" (or "Sign in").
2. Enter the test account email below.
3. Tap to send the code. Check that email for a 6-digit one-time code.
4. Enter the code in the app and tap Verify. You will be signed in.

Test account (for Google Play review only):
Email: [REPLACE-WITH-YOUR-REVIEWER-TEST-EMAIL@example.com]

Notes:
- Codes are sent by email and expire after a short time. Request a new code if needed.
- If the test email does not receive the code, check spam/junk or contact the developer.
Developer contact: [REPLACE-WITH-YOUR-SUPPORT-EMAIL]
```

### Credentials to enter in the form

- **Username / Email:** Your reviewer test email (e.g. `velochat.play.review@gmail.com` — use an address you control so you can receive the OTP).
- **Password:** Leave blank or enter: `N/A – app uses email OTP only; no password. Reviewer receives a one-time code by email after entering this address in the app.`

### Recommended: dedicated reviewer email

- Create a Gmail (or use an existing one) only for Play review, e.g. `velochat.play.review@gmail.com`.
- Put that email in the instructions and in the credentials. Reviewers can request an OTP to that inbox when testing.

---

## Recommended: dedicated reviewer account

- Create a **test account** only for Google (e.g. `velochat.play.review@gmail.com` or similar).  
- Use a simple password you can share in the form (you can change it after review).  
- If your app only uses **email OTP / magic link**, say so in the instructions and either:
  - Give a password if you add one for that account, or  
  - Offer to send a one-time code to the reviewer (and add a contact email).

## After saving

- The **App access** item should show as completed.  
- Re-run the check or submit your release again; the “Missing login credentials” issue should clear once the declaration and credentials are saved and accepted.

## If you believe the app has no restricted access

If the app does **not** require login to use (e.g. everything is public), choose the option that says **No restricted access** / **All functionality is available without login** and save. If the warning still appears, you can use “Send for review anyway” and explain in notes that the app does not have restricted access.
