# VeloChat — Expo + Supabase + Firebase

Urban cycling club coordination app. Group rides, chat rooms, clubs, and friends — all ephemeral 24h messaging with push notifications.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Mobile framework | Expo SDK 51 (React Native) |
| Navigation | Expo Router v3 |
| Backend / DB | Supabase (Postgres + Auth + Realtime) |
| Push notifications | Firebase Cloud Messaging (FCM) via Expo |
| Build & submit | EAS Build + EAS Submit |

---

## Project Structure

```
velochat/
├── app/                        # Expo Router screens
│   ├── (auth)/                 # Login, Sign Up
│   ├── (tabs)/                 # Bottom nav: Chats, Clubs, Riders
│   ├── chat/[roomId].tsx       # Chat screen (realtime)
│   ├── ride/[rideId].tsx       # Ride detail + RSVP
│   ├── club/[clubId].tsx       # Club detail + members
│   ├── new-ride.tsx            # Create ride
│   └── new-chat.tsx            # Create chat room
├── src/
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client + TypeScript types
│   │   ├── AuthContext.tsx     # Auth state provider
│   │   ├── notifications.ts    # FCM registration + listeners
│   │   ├── theme.ts            # Design tokens (colors, spacing)
│   │   └── utils.ts            # Date/time helpers
│   ├── components/
│   │   └── ui.tsx              # Avatar, Button, Card, etc.
│   └── hooks/
│       └── useData.ts          # Supabase data hooks + realtime
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Full DB schema + RLS policies
│   └── functions/
│       └── send-notification/  # Edge function for FCM
├── app.json                    # Expo config
└── eas.json                    # EAS build profiles
```

---

## Setup Guide

### 1. Prerequisites

```bash
# Install Node.js 18+ and then:
npm install -g expo-cli eas-cli

# Clone and install
cd velochat
npm install
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New project
2. Dashboard → **SQL Editor** → paste entire contents of `supabase/migrations/001_initial_schema.sql` → Run
3. Dashboard → **Settings → API** → copy:
   - `Project URL` → paste into `src/lib/supabase.ts` as `SUPABASE_URL`
   - `anon public` key → paste as `SUPABASE_ANON_KEY`

```ts
// src/lib/supabase.ts
const SUPABASE_URL = 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJ...'
```

4. Dashboard → **Authentication → Providers** → enable Email

### 3. Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → New project
2. Add **Android app** (use package name from `app.json`: `com.yourname.velochat`)
   - Download `google-services.json` → place in project root
3. Add **iOS app** (use bundle ID: `com.yourname.velochat`)
   - Download `GoogleService-Info.plist` → place in project root
4. **Project Settings → Cloud Messaging** → copy Server Key
5. In Supabase Dashboard → **Edge Functions → Secrets** → add:
   - `FIREBASE_SERVER_KEY` = your FCM server key

### 4. Deploy the Edge Function

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set FIREBASE_SERVER_KEY=your_key_here

# Deploy
supabase functions deploy send-notification
```

### 5. EAS Setup (for builds)

```bash
# Login to Expo account (create one at expo.dev if needed)
eas login

# Configure project
eas build:configure

# Update eas.json with your EAS project ID
# Update app.json with your bundle IDs and Apple/Google credentials
```

---

## Running Locally

```bash
# Start dev server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Run on physical device — scan QR code with Expo Go app
```

> ⚠️ Push notifications only work on **physical devices**, not simulators.

---

## Building for App Stores

### Development Build (for testing on device)
```bash
eas build --platform all --profile development
```

### Preview Build (internal testing)
```bash
eas build --platform all --profile preview
```

### Production Build
```bash
# Build
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios      # App Store Connect
eas submit --platform android  # Google Play Console
```

---

## Store Requirements

### Apple App Store
- Apple Developer account: **$99/year** at [developer.apple.com](https://developer.apple.com)
- App Store Connect account
- Update `eas.json` with your `appleId`, `ascAppId`, `appleTeamId`

### Google Play Store
- Google Play Developer account: **$25 one-time** at [play.google.com/console](https://play.google.com/console)
- Create a service account and download JSON key
- Update `eas.json` with path to `google-play-service-account.json`

---

## Environment Variables Reference

| File | Variable | Where to get it |
|---|---|---|
| `src/lib/supabase.ts` | `SUPABASE_URL` | Supabase → Settings → API |
| `src/lib/supabase.ts` | `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `src/lib/notifications.ts` | `FIREBASE_CONFIG` | Firebase → Project Settings |
| `src/lib/notifications.ts` | `YOUR_EAS_PROJECT_ID` | expo.dev → your project |
| Supabase Edge Function Secret | `FIREBASE_SERVER_KEY` | Firebase → Cloud Messaging |

---

## Key Features

- 🔐 **Auth** — Email/password via Supabase Auth, session persisted on device
- 🚴 **Group Rides** — Post rides with date/time, RSVP (in/out), auto-created chat room
- 💬 **Chat Rooms** — General topic rooms, 24h expiry, extendable, realtime via Supabase Realtime
- 🛡 **Clubs** — Create clubs, manage members, admin controls
- 👥 **Riders** — Follow/friend other riders
- 🔔 **Push Notifications** — FCM via Expo, sent server-side through Supabase Edge Function
- ✏️ **Edit & Delete** — Owners can edit or delete their rides and chat rooms
- 🔒 **Row Level Security** — Every table protected, users only see their data

---

## Strava Integration Setup

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Create a new Application:
   - **App Name**: VeloChat
   - **Category**: Training
   - **Authorization Callback Domain**: `velochat.app` (or your domain)
3. Copy your **Client ID** and **Client Secret**
4. Paste them into `src/lib/strava.ts`:

```ts
const STRAVA_CLIENT_ID = '12345'
const STRAVA_CLIENT_SECRET = 'abc123...'
```

5. In `app.json`, make sure `scheme` is set to `velochat` (already done)
6. The redirect URI `velochat://strava-callback` will work automatically with Expo

---

## Route File Support (GPX / FIT)

**GPX files** — exported from Garmin, Wahoo, RideWithGPS, Komoot, etc.
**FIT files** — exported from Garmin devices and most bike computers

When creating a ride:
- Tap **Import from Strava** to browse saved routes (requires Strava connection)
- Or tap **Upload Route** to pick a GPX/FIT file from your device
- The route renders as a dark map thumbnail on the ride card and at the top of the ride chat
- Distance and elevation are auto-populated

**Supabase Storage** — route files are uploaded to the `ride-routes` bucket. Create it in:
Dashboard → Storage → New bucket → name: `ride-routes` → Public: ON
