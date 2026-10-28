# 03 — Login (Google sign-in, session, route guards)

**Status:** Implemented (2026-10-18). Automated checks pass; real Google sign-in not yet verified (needs `VITE_GOOGLE_CLIENT_ID`)
**Branch:** `login`
**Depends on:** [01-api-client-and-errors](./01-api-client-and-errors.md) (`apiClient`, `unwrap`, `onUnauthorized`, `tokenStorage`, login error messages in `ERROR_MESSAGES`), [02-frontend-setup](./02-frontend-setup.md) (router, shadcn, feedback components, `SaajhaLogo`)

## Goal

A Saajha employee signs in to FlowDesk with their @saajha.org Google account and stays signed in until the token expires or they sign out.

1. **`/login`** shows the Saajha logo, "Sign in to FlowDesk", and the Google sign-in button. It turns the Google ID token into a FlowDesk session via `POST /auth/google`.
2. **Every login failure** in the contract gets a clear message (not invited, wrong domain, deactivated, Google down, …).
3. **Session persistence.** The access token and its expiry live in `localStorage`. On reload, the app revalidates with `GET /auth/me`, which also gives the **current** role.
4. **Guards.** `RequireAuth` sends signed-out users to `/login?redirect=<where they were>`; `RequireRole` shows `ForbiddenState` (or hides UI) for the wrong role. Both are UX only; the backend enforces.
5. **Expiry and 401s.** When the token's 8 hours run out, or any protected call returns 401, the session ends and the login page says *"Your session has expired. Sign in again."*
6. **Logout** (client-side only; there's no backend endpoint).

## Flow

```
Browser (/login)            Google Identity Services        FlowDesk API
   │                                  │                          │
   │ 1. render <GoogleLogin>          │                          │
   │─────────────────────────────────>│                          │
   │ 2. user picks account            │                          │
   │<─────────────────────────────────│ credential (ID token)    │
   │ 3. POST /auth/google { idToken: credential }                │
   │────────────────────────────────────────────────────────────>│ verify sig/aud/domain,
   │                                                             │ invite ACCEPTED, active,
   │ 4a. 200 { data: { accessToken, expiresIn, employee } }      │ link Google sub
   │<────────────────────────────────────────────────────────────│
   │     setSession() → localStorage; me cache = employee;       │
   │     navigate(redirect ?? "/")                                │
   │ 4b. 4xx/502 → message from ERROR_MESSAGES, stay on /login    │
   │                                                             │
   │ ── later: page reload ─────────────────────────────────────  │
   │ 5. readSession(): valid → status "loading"; GET /auth/me ──>│
   │ 6a. 200 → "authenticated" with the current role             │
   │ 6b. 401 → onUnauthorized → clear → /login, "session expired"│
   │ 6c. 0/5xx → full-page ErrorState with Retry; token is KEPT   │
```

> **Why the token is kept on 6c.** A backend restart or a dropped Wi-Fi isn't proof the session is invalid. Only a 401 or the local `expiresAt` ends a session.

> **Why `/auth/me` on boot and not the stored employee.** The contract says `/auth/me` re-reads the employee, so a role changed by an admin (or a deactivation, which returns 401 `INVALID_AUTH_TOKEN`) takes effect on the next load. The employee is therefore not stored in `localStorage`, only the token and expiry.

## Environment variables

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | yes | `1234-abc.apps.googleusercontent.com` | Public OAuth client ID for Google Identity Services. Must be the **same** client as the backend's `GOOGLE_CLIENT_ID`, or `POST /auth/google` returns 401 `INVALID_GOOGLE_TOKEN` (the `aud` check). |

- Add it to the zod schema in `src/config/env.ts`: a trimmed non-empty string ending in `.apps.googleusercontent.com`.
- Error message when either variable is invalid: `"Invalid environment: <VAR> … Copy .env.example to .env.local."`, naming each failing variable (build it from the zod issues' `path`), so a missing client ID isn't reported as a bad API URL.
- `.env.example`: `VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`.
- `.env.test`: `VITE_GOOGLE_CLIENT_ID=test-client.apps.googleusercontent.com` (not a real client; Google is mocked in tests).
- The real value goes in **`.env.local`**, not `.env`: `.env` isn't gitignored in this repo, `*.local` is. The client ID isn't a secret (it ships to the browser anyway), but keeping all real values in `.env.local` is the project rule. **No client secret anywhere in this repo.**

**Google Cloud console** (one-time, done by the user): the OAuth client's *Authorized JavaScript origins* must include `http://localhost:5173` **and** `http://localhost` (GIS requires both for local dev). No redirect URI is needed; the popup/credential flow doesn't use one.

## Packages

| Package | Kind | Version | Purpose |
|---|---|---|---|
| `@react-oauth/google` | dependency | ^0.13 | `GoogleOAuthProvider`, `GoogleLogin` (renders Google's own button), `googleLogout` |
| everything else | — | — | already installed by specs 01/02 |

## Folder layout (new and changed)

```
.env.example, .env.test         CHANGED  VITE_GOOGLE_CLIENT_ID
src/
  config/env.ts                 CHANGED  VITE_GOOGLE_CLIENT_ID; per-variable error message
  config/env.test.ts            CHANGED  cases for the new variable
  main.tsx                      CHANGED  interim onUnauthorized handler removed (AuthProvider owns it)
  App.tsx                       CHANGED  <BrowserRouter><AuthProvider><AppRoutes/></AuthProvider></BrowserRouter>
  auth/
    types.ts                    NEW      Employee, Role aliases of generated types
    api.ts                      NEW      authKeys, fetchMe, useSignInWithGoogle
    tokenStorage.ts             CHANGED  + readSession(); getAccessToken() uses it
    tokenStorage.test.ts        NEW
    authContext.ts              NEW      AuthContext + AuthState type (no component, keeps fast-refresh happy)
    AuthProvider.tsx            NEW      session state machine, 401 + expiry handling, login/logout
    useAuth.ts                  NEW      useAuth(), useHasRole(roles)
    RequireAuth.tsx             NEW      route guard
    RequireRole.tsx             NEW      route/UI guard
    LoginPage.tsx               NEW      /login
    redirect.ts                 NEW      safeRedirect(param) for ?redirect=
    auth.test.tsx               NEW
  routes/
    router.tsx                  CHANGED  /login public; "/" under RequireAuth
    HomePage.tsx                CHANGED  "Signed in as …" card with Sign out (temporary until spec 04)
```

`src/auth/` (not `features/auth/`) follows the CLAUDE.md layout, because the session is app-wide infrastructure. `auth/api.ts` plays the role a feature's `api.ts` plays: it's the only place in `auth/` that calls `apiClient`.

Request flow: `LoginPage` / `AuthProvider` → `auth/api.ts` (`useSignInWithGoogle`, `fetchMe`) → `unwrap(apiClient…)` → backend.

## Types (`src/auth/types.ts`)

```ts
import type { components } from '@/api/schema'
export type Employee = components['schemas']['Employee']
export type Role = Employee['role']            // 'ADMIN' | 'MANAGER' | 'MEMBER'
export type LoginResult = components['schemas']['LoginResponse']['data']
```

## Token storage (`src/auth/tokenStorage.ts`)

Add one function; keep the rest of spec 01's behaviour.

| Function | Behaviour |
|---|---|
| `readSession()` | Returns `{ state: 'none' }` (no key, unparsable, wrong shape, or storage blocked), `{ state: 'expired' }` (`expiresAt <= Date.now()`; the key is cleared), or `{ state: 'valid', accessToken, expiresAt }`. |
| `getAccessToken()` | Now `readSession().state === 'valid' ? accessToken : null`. Same observable behaviour as before. |
| `setSession`, `clearSession` | unchanged |

`readSession` exists so the provider can tell "never signed in" from "your session ran out" on boot, and knows `expiresAt` for the expiry timer.

## Auth API (`src/auth/api.ts`)

```ts
export const authKeys = { all: ['auth'] as const, me: () => [...authKeys.all, 'me'] as const }

export function fetchMe(signal?: AbortSignal): Promise<Employee>      // unwrap(GET /auth/me).data
export function useSignInWithGoogle(): UseMutationResult<LoginResult, ApiError, string /* idToken */>
                                                                      // unwrap(POST /auth/google { idToken }).data
```

`useSignInWithGoogle` is only the request. Storing the session is the provider's job (`signIn(result)`), so there's one place that writes session state.

## Session state (`AuthProvider` + `useAuth`)

```ts
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error'

interface AuthState {
  status: AuthStatus
  employee: Employee | null        // set only when authenticated
  error: unknown                   // the /auth/me failure when status === 'error'
  sessionExpired: boolean          // true after expiry / 401; cleared on the next successful sign-in
  signIn(result: LoginResult): void
  signOut(): void
  retry(): void                    // refetch /auth/me after an 'error'
}
```

**State** inside the provider: `hasSession: boolean` (initialised from `readSession()`), `sessionExpired: boolean` (initialised `true` when `readSession()` was `'expired'`), plus the `/auth/me` query.

**`/auth/me` query:** `useQuery({ queryKey: authKeys.me(), queryFn: ({signal}) => fetchMe(signal), enabled: hasSession, staleTime: Infinity })`. Default query retry applies (no 4xx retry; network/5xx twice).

**Status is derived, in this order:**
1. `!hasSession` → `unauthenticated`
2. query has data → `authenticated` (`employee = data`)
3. query error that is **not** a 401 → `error`
4. otherwise → `loading` (a 401 is handled by the listener below and flips `hasSession` in the same tick)

**Rules:**

| Event | What happens |
|---|---|
| `signIn(result)` | `setSession({ accessToken, expiresIn })`; `queryClient.setQueryData(authKeys.me(), result.employee)`; `hasSession = true`; `sessionExpired = false`. No extra `/auth/me` call, since the login response's employee is current. |
| `onUnauthorized` (any 401 except `/auth/google`; subscribed in an effect, unsubscribed on unmount) | `endSession({ expired: true })` |
| expiry timer | While `authenticated`, a `setTimeout` fires at `expiresAt` (delay clamped to `[0, 2_147_483_647]`) → `endSession({ expired: true })`. Re-armed whenever a new session starts. |
| `signOut()` | `endSession({ expired: false })`; `googleLogout()` (stops GIS auto-select so the next sign-in shows the account chooser). **Changed in spec 04:** no `navigate`; `signedOut = true` and `RequireAuth` redirects to a bare `/login` |
| `endSession({ expired })` | `clearSession()`; `queryClient.clear()`; `hasSession = false`; `sessionExpired = expired && hadSession` (a stray 401 while already signed out doesn't show the message) |

The provider sits **inside** `<BrowserRouter>` (it needs `useNavigate` for `signOut`) and inside `QueryClientProvider`. The 401/expiry paths don't navigate themselves: `RequireAuth` reacts to `unauthenticated` and redirects with the current location, so there's one redirect rule.

`useAuth()` throws `Error("useAuth must be used inside <AuthProvider>")` outside the provider. `useHasRole(roles: readonly Role[]): boolean` is `status === 'authenticated' && roles.includes(employee.role)`.

> **The role comes only from `employee.role`** (login response or `/auth/me`). The JWT payload also contains a role; it is never decoded (CLAUDE.md §3).

## Guards

### `RequireAuth` (wraps protected routes; renders `<Outlet />` or children)

| `status` | Renders |
|---|---|
| `loading` | `<PageLoader fullScreen label="Checking your session…" />`; protected content is **not** rendered |
| `error` | full-page `ErrorState` (title "Couldn't check your session", `onRetry = retry`, `retrying` while refetching) plus a secondary "Sign out" button |
| `unauthenticated` | `<Navigate to={`/login?redirect=${encodeURIComponent(pathname + search + hash)}`} replace />` (no `redirect` param when the location is `/`) |
| `authenticated` | the route |

### `RequireRole({ roles, children?, fallback? })`

Inside `RequireAuth` only. If `useHasRole(roles)` → children / `<Outlet />`; else `fallback ?? <ForbiddenState />`. No route uses it yet (invites in spec 05 will: `roles={['ADMIN','MANAGER']}`). For hiding buttons, components call `useHasRole` directly. A 403 from the API is still handled by each screen regardless.

## Login page (`/login`)

Layout: full-height page with a subtle `bg-brand/5` background; a centered `Card` (max-w-sm):
- `SaajhaLogo` (64 px), heading **"Sign in to FlowDesk"**, sub-text **"Use your @saajha.org Google account."**
- an `Alert` slot (see below)
- the Google button: `<GoogleLogin onSuccess onError text="signin_with" shape="pill" theme="outline" size="large" width={320} />`, wrapped in `<GoogleOAuthProvider clientId={env.VITE_GOOGLE_CLIENT_ID} onScriptLoadError={…}>`. The provider wraps only the login page, so Google's script isn't loaded on every screen.
- footer: "Saajha · FlowDesk"

**Behaviour, in order:**
1. `status === 'loading'` → `PageLoader` (a valid token is being checked; don't flash the login form).
2. `status === 'authenticated'` → `<Navigate to={safeRedirect(params.get('redirect'))} replace />`. This is also how a successful sign-in leaves the page.
3. `onSuccess({ credential })`: if `credential` is missing → show the `INVALID_GOOGLE_TOKEN` message; else `mutate(credential)`, and on success `signIn(result)`.
4. While the mutation is pending: hide the Google button and show "Signing you in…" with a spinner (`aria-live="polite"`). The GIS button can't be disabled, so it is removed to prevent a double submit.
5. Mutation error → `Alert variant="destructive"` with `getErrorMessage(error)`; the Google button returns so the user can retry with another account. Exception: a 400 without `code` (only possible if the credential were empty) shows the `INVALID_GOOGLE_TOKEN` message rather than "Validation failed".
6. `onError` from `GoogleLogin` (popup closed, GIS error) → "Google sign-in failed. Try again." (same text as `INVALID_GOOGLE_TOKEN`).
7. `onScriptLoadError` → `Alert`: "Couldn't load Google sign-in. Check your connection or disable content blockers for this site, then reload." The button area stays empty.
8. `sessionExpired` and no other error → neutral `Alert`: "Your session has expired. Sign in again."

**Messages** (already in `ERROR_MESSAGES` from spec 01; this spec doesn't change them):

| Status | Code | Message shown |
|---|---|---|
| 401 | `INVALID_GOOGLE_TOKEN` | Google sign-in failed. Try again. |
| 401 | `GOOGLE_EMAIL_NOT_VERIFIED` | Your Google email address isn't verified. |
| 401 | `EMAIL_DOMAIN_NOT_ALLOWED` | Sign in with your @saajha.org Google account. |
| 403 | `NOT_INVITED` | You haven't been invited to FlowDesk, or haven't accepted your invite yet. |
| 403 | `ACCOUNT_INACTIVE` | Your FlowDesk account has been deactivated. |
| 403 | `GOOGLE_ACCOUNT_MISMATCH` | This FlowDesk account is linked to a different Google account. |
| 502 | `GOOGLE_UNAVAILABLE` | Google sign-in is temporarily unavailable. Try again shortly. |
| 500 | — | Something went wrong on our side. Try again. |
| 0 | `NETWORK_ERROR` | Can't reach the FlowDesk server. Check your connection and try again. |

> A 401 from `/auth/google` never triggers the global session-expired handling: spec 01's middleware already exempts that path.

### `safeRedirect(param)` (`src/auth/redirect.ts`)

Returns `param` only if `param.startsWith('/') && !param.startsWith('//') && !param.startsWith('/\\') && !param.startsWith(paths.login)`. Otherwise `paths.home`. This blocks open redirects such as `?redirect=//evil.com` and `?redirect=https://evil.com`.

## Routes (`src/routes/router.tsx`)

| Path | Element |
|---|---|
| `/login` | `LoginPage` (public) |
| `/` | `RequireAuth` → `HomePage` |
| `*` | `NotFoundState` (public, so a typo doesn't force a login) |

`HomePage` (temporary until spec 04's AppShell): `Card` with the logo, "Welcome, {name}", email, a role `Badge`, the API status line from spec 02, and a **Sign out** button (`signOut`).

## Tests (`src/auth/*.test.ts(x)`, Vitest + MSW + RTL)

`@react-oauth/google` is replaced with `vi.mock`: `GoogleOAuthProvider` renders children; `GoogleLogin` renders a button "Mock Google" that calls `onSuccess({ credential: 'google-id-token' })`; `googleLogout` is a `vi.fn()`. MSW handlers use the contract's example bodies.

| File | Case | Expected |
|---|---|---|
| `tokenStorage.test.ts` | nothing stored / garbage / expired / valid | `none` / `none` / `expired` + key removed / `valid` with token and `expiresAt` |
| `env.test.ts` | client ID missing; client ID `abc` | throws, message names `VITE_GOOGLE_CLIENT_ID` |
| `auth.test.tsx` | no session, visit `/` | lands on `/login`, no `redirect` param, Google button shown |
| | no session, visit `/teams?x=1` (any protected path) | `/login?redirect=%2Fteams%3Fx%3D1` |
| | valid token, `/auth/me` 200 | `PageLoader` first, then HomePage with name and role |
| | valid token, `/auth/me` 401 `INVALID_AUTH_TOKEN` | on `/login`, "Your session has expired" shown, storage cleared |
| | expired token in storage, visit `/` | on `/login` with the session-expired message, no `/auth/me` request |
| | valid token, `/auth/me` 500 (then retries exhausted) | `ErrorState` "Couldn't check your session"; storage **still** holds the token; Retry → 200 → HomePage |
| | click Mock Google, `/auth/google` 200 | request body is `{ idToken: 'google-id-token' }`; storage holds the token; lands on HomePage |
| | `/login?redirect=%2Fteams` sign-in 200 | navigates to `/teams` |
| | `/login?redirect=%2F%2Fevil.com` sign-in 200 | navigates to `/` |
| | `/auth/google` 403 `NOT_INVITED` / 401 `EMAIL_DOMAIN_NOT_ALLOWED` / 502 `GOOGLE_UNAVAILABLE` | the matching message; still on `/login`; storage empty |
| | pending `/auth/google` | "Signing you in…" shown, Google button gone |
| | signed in, click Sign out | storage empty, query cache empty, `googleLogout` called, on `/login` **without** the expired message |
| | signed in, fake timers past `expiresAt` | on `/login` with the expired message |
| | `RequireRole roles={['ADMIN']}` as MEMBER / as ADMIN | `ForbiddenState` / children |
| `redirect.test.ts` | `/teams`, `//evil.com`, `/\evil.com`, `https://evil.com`, `/login`, `null` | `/teams`, `/`, `/`, `/`, `/`, `/` |

## Contract notes

The auth operations are fully documented, and the generated schema matches the running backend (checked 2026-10-18: a fresh `openapi-typescript` run is identical to the committed `schema.d.ts`). Nothing blocks this spec. Points to be aware of (already in CLAUDE.md, not new gaps):

1. **No refresh endpoint.** After 8 hours the user signs in again; there's no silent renewal.
2. **No logout / revocation endpoint.** Sign-out only forgets the token locally; a copied token stays valid until `exp`.
3. **An employee created via `POST /employees` can't sign in** (403 `NOT_INVITED`), so the first admin must come through an accepted invite or a backend bootstrap.
4. `/auth/me` documents only 401 and 500. A deactivated employee gets **401** `INVALID_AUTH_TOKEN` there (per the `Unauthorized` response description), not 403 `ACCOUNT_INACTIVE`; the UI shows "session expired" in that case, and the next sign-in attempt shows "account deactivated".

## Acceptance checklist

- [x] `npm run api:types` re-run; `auth/types.ts` only aliases generated types
- [x] Missing/invalid `VITE_GOOGLE_CLIENT_ID` → startup error naming that variable
- [ ] `/login` shows the Saajha logo, heading, Google button; keyboard focus visible on it
- [ ] Real Google sign-in with an invited, accepted @saajha.org account → HomePage with name and role; `localStorage['flowdesk.session']` holds token + `expiresAt`
- [ ] Non-saajha.org Google account → "Sign in with your @saajha.org Google account."
- [ ] @saajha.org account without an accepted invite → `NOT_INVITED` message
- [ ] Backend stopped during sign-in → connection message; Google button usable again
- [ ] Reload while signed in → brief loader, then HomePage; `GET /auth/me` sent once with `Authorization: Bearer …`
- [ ] Token edited to garbage in localStorage + reload → `/login` with "session expired"
- [ ] Backend stopped + reload while signed in → "Couldn't check your session" with Retry; token not removed; restarting the backend and pressing Retry signs back in
- [ ] `expiresAt` set to the past (devtools) + reload → `/login` with "session expired", no `/auth/me` call
- [ ] Visiting `/x/y` signed out → `/login?redirect=%2Fx%2Fy`; after sign-in lands on `/x/y` (NotFound page, since no route exists yet)
- [ ] `?redirect=//evil.com` → lands on `/`
- [ ] Sign out → `/login`, storage cleared, Back button doesn't show protected content
- [ ] Signed-in user visiting `/login` → redirected to `/`
- [x] No token in any `console.*` output; no `dangerouslySetInnerHTML`; nothing reads the JWT payload
- [x] `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` pass

## Verified

**Automated (Vitest + MSW, contract example bodies): 65/65 tests pass across the repo, 19 in `auth.test.tsx`.** Covered: redirect to `/login` with and without `?redirect=`; `/auth/me` revalidation sends `Bearer <stored token>`; 401 `INVALID_AUTH_TOKEN` → session-expired message and storage cleared; an expired stored token → message and no `/auth/me` call; 500 → "Couldn't check your session", token kept, Retry recovers; the expiry timer ends the session; sign-in sends `{ idToken: credential }`, stores the token and honours a safe `?redirect=` while ignoring `//evil.com`; `NOT_INVITED`, `EMAIL_DOMAIN_NOT_ALLOWED`, `ACCOUNT_INACTIVE` and `GOOGLE_UNAVAILABLE` messages; the pending state hides the Google button; a signed-in visit to `/login` redirects; sign-out clears storage and cached data and calls `googleLogout`; `RequireRole` as MEMBER and as ADMIN. Plus `tokenStorage.test.ts` (4), `redirect.test.ts` (8) and `env.test.ts` (4).

**Against the running backend (curl, 2026-10-18).** The bodies match what the tests mock:
- `POST /auth/google {"idToken":"abc"}` → 401 `{"error":"Invalid Google ID token","code":"INVALID_GOOGLE_TOKEN"}`
- `POST /auth/google {"idToken":""}` → 400 `Validation failed`, `details[0].path = "idToken"` (the case the login page maps to the Google-failed message)
- `GET /auth/me` with `Bearer abc` → 401 `INVALID_AUTH_TOKEN`; with no header → 401 `AUTH_REQUIRED`
- CORS preflight from `http://localhost:5173` for `POST /auth/google` with `content-type,authorization` → 204, allowed (`Access-Control-Allow-Origin: *`)

**Still to do by hand** (the unticked items above) once `VITE_GOOGLE_CLIENT_ID` is in `.env.local`: real Google sign-in with an invited account, wrong-domain and not-invited accounts, reload/expiry/garbage-token behaviour in the browser, and how the login page looks.

## Implementation notes

- `setSession()` now **returns** the computed `expiresAt`, so the provider arms the expiry timer from the same number it stored (no second `Date.now()`).
- `AuthState` gained `retrying: boolean` (the `/auth/me` refetch in flight), used by `RequireAuth`'s Retry button.
- The expiry timer is armed whenever a session exists (including during `loading`), not only once `authenticated`. That's the same outcome and one fewer condition.
- After `queryClient.clear()`, the still-mounted (now disabled) `/auth/me` observer re-registers an empty `['auth','me']` entry. No data survives; the sign-out test asserts exactly that.
- A placeholder line `VITE_GOOGLE_CLIENT_ID=` was appended to the developer's `.env.local`. Until it's filled in, `npm run dev` stops at startup with the env error, as designed.

## Testing notes

- **Client ID:** put the real value in `.env.local` as `VITE_GOOGLE_CLIENT_ID=…` and restart `npm run dev` (Vite reads env only at startup). It must equal the backend's `GOOGLE_CLIENT_ID`.
- **"origin_mismatch" / blank Google button:** add `http://localhost:5173` and `http://localhost` to the OAuth client's Authorized JavaScript origins; changes can take a few minutes.
- **Test accounts:** a working login needs an @saajha.org employee with an ACCEPTED invite. Without the invite UI (spec 05), create one with `POST /invites` as an existing admin (curl with that admin's token) and accept it with `POST /invites/accept`, or use whatever bootstrap the backend provides.
- **403 as a lower role / expiry:** edit `expiresAt` in `localStorage['flowdesk.session']` to force expiry; set `accessToken` to `abc` to force a 401.

## Out of scope / follow-ups

- Google One Tap and auto sign-in (`useOneTap`, `auto_select`).
- Cross-tab sync (signing out in one tab signs out the others) via the `storage` event.
- Warning before the 8-hour expiry, or silent renewal (needs a backend refresh endpoint).
- AppShell, user menu, role-aware nav: spec 04. `/invites/accept`: spec 05.
