# App Resume From Background

This document describes a class of bugs where the app stops loading data or shows endless loading spinners after the user backgrounds the app (e.g. 5–30+ seconds) and returns. It applies to React Native + Expo + Supabase.

---

## Symptoms

- After leaving the app for a few seconds (or longer) and coming back, the Chats/feed screen shows loading spinners and never loads.
- Console shows repeated `Rides fetch timed out` and `Chat rooms fetch timed out` warnings.
- The issue can occur even after short background periods (3–5 seconds).
- After longer backgrounds (30+ minutes), spinner shows for ~25 seconds even though the token is still valid.

---

## Root Causes (and Fixes)

Five issues have been identified and fixed in this codebase. If you see similar behaviour, check for these patterns.

### 1. Using `refreshSession()` on resume (AuthContext)

**Problem:** When the app becomes active again, calling `supabase.auth.refreshSession()` can **hang indefinitely**. After backgrounding, the OS often closes TCP connections; the Supabase client may still try to use them, so the refresh request never completes. As a result, any logic that waits on "session refresh done" (e.g. bumping `appResumeKey`) never runs, and data hooks never refetch.

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

### 4. JWT Expiration on resume (AuthContext)

**Problem:** After the app has been in background for longer than the JWT expiry (default 3600 seconds / 1 hour), `getSession()` returns the **expired cached token**. If `appResumeKey` is bumped immediately, data hooks fire requests with a 401-invalid token and fail. `startAutoRefresh()` eventually refreshes the token and fires `onAuthStateChange`, but by then data hooks have already failed and nothing re-triggers them.

**Fix:** After `getSession()`, check `session.expires_at` against the current time. If the token is expired, call `refreshSession()` with a 10-second timeout **before** bumping `appResumeKey`, so data hooks only fire once a valid token is available.

- **Where:** `src/lib/AuthContext.tsx` — inside the resume `setTimeout` callback, after `getSession()`.
- **Pattern:**
  ```typescript
  const nowSecs = Math.floor(Date.now() / 1000)
  const tokenExpired = data.session?.expires_at != null && data.session.expires_at <= nowSecs
  if (tokenExpired) {
    try {
      const { data: refreshed } = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
      ])
      // use refreshed session ...
    } catch (refreshErr) {
      if (/refresh token/i.test(refreshErr.message)) {
        await supabase.auth.signOut() // unrecoverable — force sign out
      }
      // otherwise fall through with cached session; startAutoRefresh will retry
    }
  }
  // always bump appResumeKey after the above
  setAppResumeKey(k => k + 1)
  ```
- **Exception:** If `refreshSession()` throws with a message matching `/refresh token/i` (e.g. "Invalid Refresh Token: Refresh Token Not Found"), the session is unrecoverable. Call `supabase.auth.signOut()` so `onAuthStateChange` clears state and `AuthGate` redirects to login.

### 5. Non-silent re-fetch triggered by user object reference change (useData hooks)

**Problem:** On every resume, `AuthContext` calls `setUser(data.session.user)`. The Supabase client always returns a **new object** from `getSession()` even when the user is identical. Because `useCallback(..., [user])` depended on the `user` object reference, the `fetch` callback was recreated on every resume. This triggered `useEffect(() => { fetch() }, [fetch])` — a **non-silent** fetch that sets `loading = true` and shows a spinner. After a long background (30+ minutes) the network is briefly slow, so this non-silent fetch hit the 25-second timeout, leaving the screen stuck for nearly a minute before recovering.

**Fix:** Derive `const userId = user?.id ?? null` (a stable string primitive) and use `userId` as the `useCallback` dependency instead of `user`. The callback only recreates when the actual user identity changes (login/logout), not when `setUser` is called with a new object of the same user. On resume, only the silent `appResumeKey` effect fires — no spinner, data updates quietly in the background.

- **Where:** `src/hooks/useData.ts` — `useRides` and `useChatRooms`.
- **Pattern:**
  ```typescript
  const { user, appResumeKey } = useAuth()
  const userId = user?.id ?? null  // stable primitive

  const fetch = useCallback(async (opts?: DataFetchOpts) => {
    if (!userId) { setLoading(false); return }
    // ... use userId in all queries
  }, [userId])  // NOT [user]

  useEffect(() => { fetch() }, [fetch])  // only fires when userId changes (login/logout)

  useEffect(() => {
    if (appResumeKey === 0 || !userId) return
    fetchRef.current?.({ silent: true })  // silent — no spinner
  }, [appResumeKey, userId])
  ```

---

## Architecture Summary

- **AuthContext**
  On app become active from background: call `startAutoRefresh()` immediately, then after a 500ms delay call `getSession()`. If the token is expired, call `refreshSession()` (10s timeout) before bumping `appResumeKey`. If the refresh token is invalid, sign out. Otherwise sync session/user and bump `appResumeKey`.

- **Data hooks (useRides, useChatRooms)**
  - Initial fetch on mount (non-silent, shows spinner).
  - Callback depends on `userId` (string primitive), not `user` object, so it does not recreate on resume.
  - Refetch when `appResumeKey` changes (and `appResumeKey > 0`), using **silent** refetch — no spinner.
  - In-flight guard to avoid duplicate silent fetches.
  - Realtime subscriptions re-subscribe on each `appResumeKey` increment.

- **Chats screen**
  - `useFocusEffect`: run silent refetches when the tab gains focus, using refs for the refetch functions and `[user?.id]` as the only dependency so the effect does not re-run on every `user` reference change.

---

## Debugging Tips

If similar "stuck after background" behaviour comes back:

1. **Log resume flow:** In AuthContext, log when AppState becomes active from background, when `getSession()` is called, whether `tokenExpired` is true, and when `appResumeKey` is incremented. Confirm the resume path completes quickly.
2. **Log fetch triggers:** In the data hooks, log each fetch call with `silent`, `retry`, and the in-flight flag. A non-silent fetch on resume means `userId` changed (check if `setUser` is being called unnecessarily) or `useFocusEffect` fired with unstable deps.
3. **Avoid `refreshSession()` on resume unless token is expired:** For the normal resume path (token still valid), use `getSession()` only. Only call `refreshSession()` when `expires_at` is in the past.
4. **Do not depend on `user` object in `useCallback`:** The Supabase client creates a new `User` object on every `getSession()` call. Depending on `user` instead of `user?.id` causes the callback to recreate on every resume, triggering non-silent fetches.

---

## References

- Supabase React Native auth: [stop auto-refresh in background, restart on foreground](https://supabase.com/docs/reference/javascript/auth-startautorefresh).
- Expo Router: `useFocusEffect` runs when the screen gains focus; keep its dependency array minimal and use refs for callback identities to avoid cascading re-runs.
