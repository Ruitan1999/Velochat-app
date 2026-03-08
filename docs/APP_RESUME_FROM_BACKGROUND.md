# App Resume From Background

This document describes a class of bugs where the app stops loading data or shows endless loading spinners after the user backgrounds the app (e.g. 5–30+ seconds) and returns. It applies to React Native + Expo + Supabase.

---

## Symptoms

- After leaving the app for a few seconds (or longer) and coming back, the Chats/feed screen shows loading spinners and never loads.
- Console shows repeated `Rides fetch timed out` and `Chat rooms fetch timed out` warnings.
- The issue can occur even after short background periods (3–5 seconds).

---

## Root Causes (and Fixes)

Three issues were identified and fixed in this codebase. If you see similar behaviour, check for these patterns.

### 1. Using `refreshSession()` on resume (AuthContext)

**Problem:** When the app becomes active again, calling `supabase.auth.refreshSession()` can **hang indefinitely**. After backgrounding, the OS often closes TCP connections; the Supabase client may still try to use them, so the refresh request never completes. As a result, any logic that waits on “session refresh done” (e.g. bumping `appResumeKey`) never runs, and data hooks never refetch.

**Fix:** On resume from background, use **`getSession()`** instead of `refreshSession()`. `getSession()` reads from local storage/cache and returns quickly. Rely on **`startAutoRefresh()`** (already called when the app becomes active) to refresh the token in the background.

- **Where:** `src/lib/AuthContext.tsx` — AppState `change` listener when `state === 'active'` and coming from `background` or `inactive`.
- **Pattern:** After a short delay (e.g. 500ms) to let the network settle, call `getSession()`, update session/user state from the result, then increment `appResumeKey` so data hooks can refetch. Do **not** block on `refreshSession()` in this path.

### 2. useFocusEffect dependency cascade (Chats screen)

**Problem:** `useFocusEffect` was depending on `[refetchRides, refetchRooms, user?.id]`. The `refetch*` functions come from `useCallback(..., [user])`, so they get new references whenever `user` changes. AuthContext often sets a new `user` object reference (e.g. after `getSession()`), even when the user ID is the same. That causes:

1. `useFocusEffect` to re-run (dependency changed).
2. Each run triggers **non-silent** refetches → `loading = true` → spinners.
3. Multiple runs in quick succession → many concurrent fetches, all potentially hitting dead connections and timing out.

**Fix:** Keep refetches behind **refs** so the effect does not re-run when the refetch function identity changes. Depend only on stable values (e.g. `user?.id`).

- **Where:** `app/(tabs)/chats.tsx` — `useFocusEffect` that calls `refetchRides()` and `refetchRooms()`.
- **Pattern:** Store `refetchRides` and `refetchRooms` in refs (`refetchRidesRef.current`, `refetchRoomsRef.current`), update the refs on every render, and inside the effect call `refetchRidesRef.current()` and `refetchRoomsRef.current()`. Use dependency array `[user?.id]` only.

### 3. No guard against concurrent fetches (useData hooks)

**Problem:** Many callers (focus effect, poll interval, appResumeKey effect, realtime) can trigger a refetch at once. Without a guard, dozens of fetches run in parallel. After background, connections are often stale, so many of these hang and hit the 25s timeout, and the UI can stay in a loading state.

**Fix:** Add an **in-flight guard** in the fetch function: if a fetch is already running and the new request is **silent**, skip it. Always clear the guard in a `finally` block.

- **Where:** `src/hooks/useData.ts` — `useRides` and `useChatRooms` fetch functions.
- **Pattern:** `const fetchInFlightRef = useRef(false)`. At the start of fetch: if `fetchInFlightRef.current && opts?.silent` then return; else set `fetchInFlightRef.current = true`. In `finally`, set `fetchInFlightRef.current = false` (and `setLoading(false)`).

---

## Architecture Summary

- **AuthContext**  
  On app become active from background: after a short delay, call `getSession()`, sync session/user, then `setAppResumeKey(k => k + 1)`. Do not call `refreshSession()` in this path; use `startAutoRefresh()` for token refresh.

- **Data hooks (useRides, useChatRooms)**  
  - Initial fetch on mount.  
  - Refetch when `appResumeKey` changes (and `appResumeKey > 0`), using **silent** refetch.  
  - In-flight guard to avoid duplicate silent fetches.  
  - Realtime subscriptions and (optional) poll interval can still trigger refetches; the guard limits concurrency.

- **Chats screen**  
  - `useFocusEffect`: run refetches when the tab gains focus, using refs for the refetch functions and `[user?.id]` as the only dependency so the effect does not re-run on every `user` reference change.

---

## Debugging Tips

If similar “stuck after background” behaviour comes back:

1. **Log resume flow:** In AuthContext, log when AppState becomes active from background, when `getSession()` is called, and when `appResumeKey` is incremented. Confirm the resume path completes quickly (e.g. within tens of milliseconds).
2. **Log fetch triggers:** In the data hooks, log each fetch call with `silent`, `retry`, and an in-flight flag. Check for a storm of non-silent fetches or repeated focus-effect runs.
3. **Avoid `refreshSession()` on resume:** Prefer `getSession()` for the resume path; use `startAutoRefresh()` for actual token refresh so the UI never blocks on a potentially hanging network call.

---

## References

- Supabase React Native auth: [stop auto-refresh in background, restart on foreground](https://supabase.com/docs/reference/javascript/auth-startautorefresh).
- Expo Router: `useFocusEffect` runs when the screen gains focus; keep its dependency array minimal and use refs for callback identities to avoid cascading re-runs.
