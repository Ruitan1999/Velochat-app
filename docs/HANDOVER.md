# Handover for Agents

Brief context for AI agents (e.g. Antigravity) taking over work on VeloChat. Read this first when joining the project.

---

## Project summary

**VeloChat** — React Native (Expo) cycling community app: ride posts, clubs, ride chats, and general group chats. Auth via Supabase (magic link OTP). Push notifications via OneSignal.

- **Entry:** `expo-router/entry` → `app/_layout.tsx`
- **Backend:** Supabase (auth, Postgres, realtime, RPCs)
- **State:** React context for auth; custom hooks in `src/hooks/useData.ts` for rides, chat rooms, messages, clubs, etc.

---

## Tech stack

| Layer        | Choice |
|-------------|--------|
| Framework   | Expo SDK 54, React 19, React Native 0.81 |
| Routing     | Expo Router (file-based), `app/` directory |
| Backend     | Supabase (auth, DB, realtime) |
| Push        | OneSignal (+ Expo push for dev) |
| UI          | Custom components in `src/components/`, theme in `src/lib/theme.ts` |

---

## App structure (routes)

- **`app/_layout.tsx`** — Root: fonts, `AuthProvider`, `AuthGate` (session gate + redirect), `Stack`. Do not block render on `refreshSession()` on resume; see `docs/APP_RESUME_FROM_BACKGROUND.md`.
- **`app/(auth)/`** — Login, signup, OTP. Shown when no session.
- **`app/(tabs)/`** — Main tabs: Chats (default), Clubs, Me (profile). Chats = ride feed + general chat list.
- **`app/chat/[roomId].tsx`** — Chat room screen.
- **`app/ride/[rideId].tsx`** — Ride detail.
- **`app/club/[clubId].tsx`** — Club detail.
- **`app/new-ride.tsx`**, **`app/new-chat.tsx`**, **`app/edit-chat/[roomId].tsx`**, **`app/notifications.tsx`**, **`app/delete-account.tsx`** — Self-explanatory.

---

## Key code locations

| What | Where |
|------|--------|
| Auth (session, user, profile, OTP, sign out) | `src/lib/AuthContext.tsx` |
| Supabase client + types | `src/lib/supabase.ts` |
| Data hooks (rides, chat rooms, messages, clubs, etc.) | `src/hooks/useData.ts` |
| Tab unread badge state | `src/lib/tabUnreadStore.ts` |
| Push (FCM token, notification handlers) | `src/lib/notifications.ts`, OneSignal in `src/lib/onesignal.ts` |
| Theme (colors, spacing, font sizes) | `src/lib/theme.ts` |
| Shared UI (Avatar, Card, EmptyState, etc.) | `src/components/ui` |

---

## Important patterns and gotchas

1. **App resume from background**  
   If the app “stops loading” or shows endless spinners after being backgrounded, see **`docs/APP_RESUME_FROM_BACKGROUND.md`**. Do not use `refreshSession()` on resume; use `getSession()` and `appResumeKey` so data hooks refetch after session is re-read.

2. **`useSegments()` (expo-router)**  
   Return type can be a single-element tuple. Use `segments.at(1)` (or similar safe access) instead of `segments[1]` to avoid TS2493 (tuple has no element at index 1). See `app/_layout.tsx` around the auth redirect logic.

3. **Duplicate React/React-DOM**  
   Resolved via `package.json` **`overrides`** for `react` and `react-dom` (19.1.0) so transitive deps (e.g. jest-expo-enzyme) don’t install a second version. Don’t remove overrides without re-running `npm install` and `expo-doctor`.

4. **Patches**  
   `patch-package` runs at postinstall. There is a patch for `expo-keep-awake`. Patches live in `patches/`.

5. **Chats tab refetch**  
   `app/(tabs)/chats.tsx` uses **refs** for `refetchRides` / `refetchRooms` inside `useFocusEffect` so the effect doesn’t re-run on every `user` reference change. Keep dependency array to `[user?.id]` (or similar stable deps only).

---

## Scripts and CI

- **`npm run typecheck`** — `tsc --noEmit`. Must pass in CI.
- **`npm run lint`** — `expo lint`.
- **`npm run ci`** — typecheck + lint (used in GitHub Actions).
- **`npm run start`** — Expo dev server (port 8082).
- **`npm run ios`** / **`npm run android`** — Run on device/simulator.
- **EAS:** `build:ios`, `build:android`, `build:ios:store`, `submit:ios`, etc. See `package.json` and `eas.json`.

---

## Docs in `docs/`

| Doc | Purpose |
|-----|--------|
| **APP_RESUME_FROM_BACKGROUND.md** | Why data doesn’t load after background; fixes (getSession, refs, in-flight guard). |
| **AUTH_RATE_LIMITS.md** | Supabase OTP rate limits and how to adjust. |
| **NATIVE_TOOLING.md** | CocoaPods install/upgrade for iOS. |
| **PRIVACY_POLICY.md** | App privacy policy text. |
| **PUSH_NOTIFICATIONS_SETUP.md**, **ONESIGNAL_*.md**, **DEBUG_PUSH_NOTIFICATIONS.md** | Push and OneSignal setup/debug. |
| **APP_STORE_IOS.md**, **PLAY_STORE_PUBLISH.md**, **APP_STORE_DESCRIPTIONS.md**, **DATA_SAFETY_*.md**, **GOOGLE_PLAY_*.md**, **IOS_CREDENTIALS_*.md** | Store submission and credentials. |

---

## Supabase

- URL and anon key in `src/lib/supabase.ts` (replace for your project if needed).
- Auth: magic link OTP; session in SecureStore/AsyncStorage.
- Realtime: used for messages, ride RSVPs, chat list updates; channels are per-user or per-room. After long background, connections can drop; data hooks refetch when `appResumeKey` increments.

---

## Quick checklist for new agents

- [ ] Read this handover and `docs/APP_RESUME_FROM_BACKGROUND.md` if touching auth, Chats tab, or data loading.
- [ ] Run `npm run typecheck` and `npm run lint` before proposing changes.
- [ ] Use `segments.at(i)` (or safe access) when using `useSegments()` beyond the first element.
- [ ] Don’t call `refreshSession()` in the app-resume path; use `getSession()` and `appResumeKey`.
- [ ] Keep `useFocusEffect` deps stable (refs for callbacks) on the Chats screen to avoid refetch storms.
