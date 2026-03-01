# Google Play Data Safety – What to Answer for VeloChat

Use this guide when filling out the **Data safety** section in Google Play Console (Policy → App content → Data safety).

---

## Does your app collect or share user data?

**Answer: Yes.**

---

## Data types to declare

Add each of the following. For each type, use the details below.

### 1. **Name**

- **Collected:** Yes  
- **Shared:** No (only with our backend Supabase; you can answer "No" for "shared with third parties" if you consider Supabase your infrastructure).  
- **Required or optional:** Required (for account).  
- **Purpose:** App functionality (account, profile, display in rides/chats).  
- **Encrypted in transit:** Yes.

---

### 2. **Email address**

- **Collected:** Yes  
- **Shared:** No (same as above).  
- **Required or optional:** Required.  
- **Purpose:** App functionality (account creation, sign-in, account management).  
- **Encrypted in transit:** Yes.

---

### 3. **User-generated content** (e.g. "Other user-generated content" or "Messages")

- **Collected:** Yes  
- **Shared:** No.  
- **Required or optional:** Required for core features (e.g. sending messages, creating rides).  
- **Purpose:** App functionality (chat messages, ride details, club content).  
- **Encrypted in transit:** Yes.

*If Play Console has separate options for "Messages" or "Other in-app content", you can use "Messages" for chat and "Other" for ride titles/descriptions.*

---

### 4. **Photos** (profile picture)

- **Collected:** Yes  
- **Shared:** No.  
- **Required or optional:** Optional.  
- **Purpose:** App functionality (profile photo).  
- **Encrypted in transit:** Yes.

---

### 5. **Files and documents** (route files)

- **Collected:** Yes (GPX/FIT route files users upload).  
- **Shared:** No.  
- **Required or optional:** Optional.  
- **Purpose:** App functionality (ride routes, maps).  
- **Encrypted in transit:** Yes.

---

### 6. **Device or other IDs** (push token / installation ID)

- **Collected:** Yes (push notification token for OneSignal/FCM).  
- **Shared:** Yes (with OneSignal for push delivery).  
- **Required or optional:** Optional (app works without notifications).  
- **Purpose:** Push notifications (e.g. new messages, ride updates).  
- **Encrypted in transit:** Yes.

---

## Optional integrations (only if you enable Strava)

If users can connect Strava in your app:

- **Fitness / activity data** (or “Other”):  
  - **Collected:** Yes (via Strava OAuth: profile, activities/routes).  
  - **Shared:** Yes (with Strava; you receive data from them).  
  - **Required or optional:** Optional.  
  - **Purpose:** App functionality (import routes).  
  - **Encrypted in transit:** Yes.

---

## What you can say “No” to (for current VeloChat)

- **Precise location / Approximate location** — Say **No** unless you actually use device GPS (e.g. for “nearby rides”). Right now the app only uses *text* location (e.g. “Central Park”), not device location.
- **Financial / Payment info** — No (unless you add payments later).
- **Health** — No (unless you add health features).
- **Crash logs / Diagnostics** — No (unless you add a crash reporting SDK).
- **Analytics** — No (unless you add analytics).

---

## Security practices (Data safety form)

- **Data encrypted in transit:** Yes (HTTPS/TLS).  
- **Users can request data deletion:** Yes. In the form, you can say users can request deletion (e.g. by email) and that you process requests within a reasonable time, as described in your privacy policy.

---

## Privacy policy URL

- You **must** provide a **public URL** to your privacy policy (e.g. `https://yoursite.com/privacy` or a GitHub Pages URL).
- Use the content from `docs/PRIVACY_POLICY.md`: replace placeholders ([Your support or privacy email], dates, company name), then host the page and paste that URL in Play Console.

---

## Short summary for the store listing

You can use something like:

*"VeloChat collects name, email, profile info (including optional photo), chat messages, ride details and optional route files to run the app. Push notification tokens are used to send you alerts and are processed by our notification provider. Data is encrypted in transit. We don’t sell your data. You can request account and data deletion by contacting us."*

---

*After publishing, if you add features (e.g. location, payments, analytics), update both the Data safety form and your privacy policy.*
