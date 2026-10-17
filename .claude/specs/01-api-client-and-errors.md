# 01 — API client and error handling (data layer)

**Status:** Planned
**Branch:** `feature/api-client`
**Depends on:** nothing in this repo. Built against the backend contract at `http://localhost:3001/openapi.json` (FlowDesk API 1.0.0, audited 2026-10-17).

## Goal

Every later feature talks to the backend through the same pieces, so they're built once, here:

1. **One typed client.** `apiClient` (openapi-fetch) is typed by `src/api/schema.d.ts`, which is generated from the contract. Paths, params, bodies and responses are all checked by TypeScript.
2. **One error type.** Every failure (backend JSON error, validation error, HTML error page, network failure) becomes an `ApiError` with `status`, optional `code`, per-field errors and `details`.
3. **One message map.** Each backend error `code` has exactly one user-facing message, kept in `src/api/errors.ts`.
4. **Auth hook points.** The client attaches the stored bearer token and reports 401s through an event that the auth feature (spec 03) subscribes to. This spec stores no tokens of its own and does no login.
5. **Query defaults that understand `ApiError`**: no retrying 4xx, bounded retry on network/5xx.
6. **Tests** (Vitest + MSW) that pin all of the above using the contract's real error bodies.

No UI beyond a temporary API status line. Toasts, `ErrorState` and the rest come with the setup/layout specs.

## Flow

```
Component        Feature hook            apiClient (+authMiddleware)         FlowDesk API
   │                  │                            │                               │
   │ useQuery(...)    │                            │                               │
   │─────────────────>│ unwrap(apiClient.GET(..))  │                               │
   │                  │───────────────────────────>│ 1. onRequest: add             │
   │                  │                            │    Authorization: Bearer <t>  │
   │                  │                            │    (only if a live token)     │
   │                  │                            │──────────────────────────────>│
   │                  │                            │<──────────────────────────────│ 2. response
   │                  │                            │ 3. onResponse: 401 and path   │
   │                  │                            │    ≠ /auth/google →           │
   │                  │                            │    emitUnauthorized()         │
   │                  │ 4a. ok  → data             │                               │
   │                  │ 4b. !ok → throw toApiError(status, body)                   │
   │                  │ 4c. fetch rejected → throw ApiError(0, NETWORK_ERROR)      │
   │ { data | error } │                            │                               │
   │<─────────────────│                            │                               │
```

The middleware only **reports** a 401; it doesn't swallow it. The caller still receives its `ApiError` (401), so a screen that's mid-render doesn't hang. What happens on a 401 is decided by whoever subscribes:
- **this spec (interim):** `main.tsx` clears the stored session and the query cache;
- **spec 03:** the auth provider replaces that with "clear session, redirect to `/login?redirect=…`, show *session expired*".

`/auth/google` is excluded because its 401s (`INVALID_GOOGLE_TOKEN`, `GOOGLE_EMAIL_NOT_VERIFIED`, `EMAIL_DOMAIN_NOT_ALLOWED`) are login errors to show on the login page, not an expired session.

## Environment variables

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | yes | `http://localhost:3001` | FlowDesk API base URL. Must be an absolute `http(s)` URL; a trailing `/` is stripped. |

- Validated with zod in `src/config/env.ts` on import. If it's missing or invalid, throw `Error("Invalid environment: VITE_API_BASE_URL must be an absolute http(s) URL. Copy .env.example to .env.local.")`, so the app fails at startup instead of on the first request.
- `src/config/env.ts` is the **only** module that reads `import.meta.env`.
- `.env.example` (committed) holds `VITE_API_BASE_URL=http://localhost:3001`. Real values go in `.env.local` (already gitignored by `*.local`).
- `.env.test` (committed, not a secret) holds `VITE_API_BASE_URL=http://localhost:3001`. Vitest loads it in `test` mode, and MSW intercepts that origin.
- `VITE_GOOGLE_CLIENT_ID` is **not** added here. Spec 03 adds it, so the app keeps running before there's a Google client.

## Packages

| Package | Kind | Version | Purpose |
|---|---|---|---|
| `openapi-fetch` | dependency | ^0.17 | Typed fetch client over the generated `paths` |
| `@tanstack/react-query` | dependency | ^5.104 | Server state; `QueryClient` defaults |
| `zod` | dependency | ^4.6 | Env validation (and forms later) |
| `openapi-typescript` | dev | ^7.13 | Generates `src/api/schema.d.ts` from `/openapi.json` |
| `vitest` | dev | ^5.0 | Test runner (uses the Vite config) |
| `msw` | dev | ^3.0 | Mocks the backend at the network level in tests |
| `jsdom` | dev | ^30.1 | DOM + `localStorage` for tests |

> **TypeScript 6 vs openapi-typescript.** `openapi-typescript@7` declares a peer dependency of `typescript ^5.x`, and this repo uses `typescript ~6.0.2`. Add `"overrides": { "openapi-typescript": { "typescript": "$typescript" } }` to `package.json` so npm installs without `--legacy-peer-deps`. Then confirm `npm run api:types` actually generates the file. If generation fails under TS 6, **stop and report it**. Don't downgrade TypeScript for the whole project.

## Config changes

| File | Change |
|---|---|
| `tsconfig.app.json` | Add `"strict": true` (openapi-fetch's `{ data, error }` narrowing needs `strictNullChecks`). Add `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`. |
| `tsconfig.json` (root) | Add the same `compilerOptions.baseUrl` / `paths` (shadcn reads the root file later). |
| `vite.config.ts` | Import `defineConfig` from `vitest/config`. Add `resolve.alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }`. Add `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`. |
| `package.json` scripts | `"api:types": "openapi-typescript http://localhost:3001/openapi.json -o src/api/schema.d.ts"`, `"typecheck": "tsc -b"`, `"test": "vitest run"`, `"test:watch": "vitest"` |

> `tsconfig.app.json` has `erasableSyntaxOnly: true`, so **no TS `enum`s and no constructor parameter properties**. Use `as const` arrays/objects and explicitly declared class fields.

## Folder layout (new and changed)

```
.env.example                    NEW      VITE_API_BASE_URL placeholder
.env.test                       NEW      VITE_API_BASE_URL for Vitest
package.json                    CHANGED  deps, scripts, overrides
tsconfig.json, tsconfig.app.json, vite.config.ts   CHANGED (see above)
src/
  config/
    env.ts                      NEW      zod-validated `env` object
  api/
    schema.d.ts                 NEW      GENERATED by `npm run api:types`; committed so build/CI don't need the backend
    client.ts                   NEW      `apiClient`, `authMiddleware`, `unwrap()`
    errors.ts                   NEW      `ApiError`, `toApiError`, `getErrorMessage`, `isApiError`, `hasErrorCode`,
                                         `KNOWN_ERROR_CODES`, `ERROR_MESSAGES`
    authEvents.ts               NEW      `onUnauthorized(listener) → unsubscribe`, `emitUnauthorized()`
    errors.test.ts              NEW
    client.test.ts              NEW
  auth/
    tokenStorage.ts             NEW      `getAccessToken()`, `setSession()`, `clearSession()`
  lib/
    queryClient.ts              NEW      `queryClient` with ApiError-aware defaults
    queryClient.test.ts         NEW
  test/
    setup.ts                    NEW      MSW lifecycle, `localStorage.clear()` after each test
    server.ts                   NEW      `setupServer()` with no default handlers (each test declares its own)
  main.tsx                      CHANGED  `<QueryClientProvider>`; interim `onUnauthorized` handler
  App.tsx                       CHANGED  temporary "API status" screen from `GET /health-check` (replaced in spec 04)
  App.css                       CHANGED  trimmed to what the status screen uses (or deleted)
```

**Layering (from CLAUDE.md):** component → feature hook (`features/*/api.ts`) → `unwrap(apiClient.METHOD(...))` → backend. Nothing else calls `fetch`, and nothing outside `src/api/` imports `openapi-fetch`. This spec has no features yet; the status screen calls `unwrap(apiClient.GET('/health-check'))` inside a `useQuery` in `App.tsx`, which is acceptable only because that screen is temporary.

## Token storage (`src/auth/tokenStorage.ts`)

Spec 03 owns login. This module is only the storage the client reads from.

| Function | Behaviour |
|---|---|
| `setSession({ accessToken, expiresIn })` | Writes `{ accessToken, expiresAt: Date.now() + expiresIn * 1000 }` as JSON under the key `flowdesk.session`. `expiresIn` is seconds, as in `LoginResponse`. |
| `getAccessToken(): string \| null` | Reads and parses the key. Returns `null` **and clears the key** when it's missing, unparsable, has the wrong shape, or `expiresAt <= Date.now()`. |
| `clearSession()` | Removes the key. |

Every `localStorage` access is wrapped in `try/catch` (private mode or blocked storage); on failure the function behaves as "no session". Tokens are never logged.

## Auth events (`src/api/authEvents.ts`)

A tiny synchronous emitter, kept in `api/` because the client is what emits:
- `onUnauthorized(listener: () => void): () => void` subscribes and returns an unsubscribe function.
- `emitUnauthorized()` calls every listener. A listener that throws doesn't stop the others; the error is reported with `console.error`.

## Client (`src/api/client.ts`)

```ts
export const apiClient = createClient<paths>({ baseUrl: env.VITE_API_BASE_URL })
apiClient.use(authMiddleware)
```

Rules, in order:

1. **`authMiddleware.onRequest`.** If `getAccessToken()` returns a token, set `Authorization: Bearer <token>`; otherwise leave the header off (public endpoints, and protected ones will return `AUTH_REQUIRED`). Don't set `Content-Type` by hand: openapi-fetch already sends `application/json` for JSON bodies, which the contract requires ("`Content-Type: application/json` is required for the body to be parsed").
2. **`authMiddleware.onResponse`.** If `response.status === 401` and the request path isn't `/auth/google`, call `emitUnauthorized()`. Return the response untouched.
3. **`unwrap(promise)`** is the only way feature code reads a result:
   - The openapi-fetch result's `response.ok` is true → return `data` (it's `undefined` for 204 responses such as `DELETE /teams/{teamId}`).
   - It isn't → `throw toApiError(response.status, error)`. openapi-fetch puts the parsed JSON body in `error`, or the raw text when the body isn't JSON.
   - The promise rejects with an `AbortError` (`DOMException` named `AbortError`) → re-throw it unchanged, since TanStack Query uses it to cancel requests.
   - It rejects with anything else (a `TypeError` from fetch: backend down, DNS, CORS) → `throw new ApiError({ status: 0, code: 'NETWORK_ERROR' })`, keeping the original error as `cause`.

## Error model (`src/api/errors.ts`)

### `ApiError`

```ts
export class ApiError extends Error {
  readonly status: number                 // HTTP status; 0 = network failure
  readonly code?: string                  // backend `code`, or 'NETWORK_ERROR'
  readonly fieldErrors: Record<string, string>   // validation: path → first message
  readonly formErrors: string[]           // validation issues with path ''
  readonly details?: unknown              // ErrorResponse.details (e.g. { blockers }, { programs })
  readonly serverMessage?: string         // backend `error` string, verbatim
  // constructor(init: {...}, options?: { cause?: unknown }) assigns each field explicitly.
  // `message` = serverMessage ?? `HTTP ${status}` (for logs; UI uses getErrorMessage)
}
```

`name` is `'ApiError'`. Field declarations are explicit; no parameter properties (`erasableSyntaxOnly`).

### `toApiError(status, body)`

The contract's error bodies (verified against the live backend):

| Shape | When | Example |
|---|---|---|
| `ValidationErrorResponse` `{ error, details: {path, message}[] }`, **no `code`** | invalid params/query/body, malformed JSON | `{"error":"Validation failed","details":[{"path":"email","message":"Invalid email address"}]}` · `{"error":"Malformed JSON body","details":[{"path":"","message":"Expected property name…"}]}` |
| `ErrorResponse` `{ error, code?, details? }`, `details` is an object if present | coded 400s, 401, 403, 404 (no code), 409, 410, 500, 502 | `{"error":"Task is blocked by unfinished dependencies","code":"TASK_BLOCKED","details":{"blockers":[…]}}` · `{"error":"Team not found"}` |
| Non-JSON | unknown route (Express default HTML 404), proxies | `<!DOCTYPE html>…Cannot GET /nope…` |

Classify in this order:
1. **Validation:** `body` is an object, `typeof body.error === 'string'`, `Array.isArray(body.details)`, and `body.code` is absent. For each issue with a non-empty `path`, set `fieldErrors[path]` if it isn't set already (first message wins). Push issues with `path === ''` to `formErrors`. `serverMessage = body.error`.
2. **ErrorResponse:** `body` is an object with `typeof body.error === 'string'`. Copy `code` (if it's a string), `details` and `serverMessage = body.error`.
3. **Anything else** (string, HTML, empty, `null`, wrong shape): `new ApiError({ status })` with no code and no server message.

Never parse the `error` string to make decisions. Branch on `code`, then `status`.

### `getErrorMessage(err: unknown): string`

1. `err` isn't an `ApiError` → `"Something went wrong. Try again."`
2. `err.code` is in `ERROR_MESSAGES` and maps to a string → that string.
3. `err.code` maps to `null` (meaning "the server message is the better message") **or** the code is unknown, and `err.status` is 400, 404, 409 or 410 and `serverMessage` is set → `serverMessage`. The contract defines `error` as a human-readable message.
4. Status fallback:

   | Status | Message |
   |---|---|
   | 0 | Can't reach the FlowDesk server. Check your connection and try again. |
   | 400 | Some of the information is invalid. Check it and try again. |
   | 401 | Your session has expired. Sign in again. |
   | 403 | You don't have permission to do that. |
   | 404 | Not found. |
   | 409 | That conflicts with the current state. Refresh and try again. |
   | 410 | This link has expired. |
   | 502, 503, 504 | The service is temporarily unavailable. Try again shortly. |
   | other 5xx | Something went wrong on our side. Try again. |
   | anything else | Something went wrong. Try again. |

> **A 500's server message is never shown.** The contract says details are logged server-side, and the body is just `"Internal server error"`.

Helpers: `isApiError(e): e is ApiError` and `hasErrorCode(e, code): boolean`.

### Error codes and messages

`KNOWN_ERROR_CODES` is an `as const` array copied **verbatim** from the `ErrorResponse.code` description in `/openapi.json` (comment: `// Source: components.schemas.ErrorResponse.code description — keep in sync`), plus the frontend-only `NETWORK_ERROR`. `ERROR_MESSAGES: Record<KnownErrorCode, string | null>` must have an entry for **every** code; `null` means "show the server message", used where the backend's message names the specific task, key or id.

| Code | Status | Where (contract) | Message (`null` = server message) |
|---|---|---|---|
| `INVALID_INVITE_TOKEN` | 400 | `POST /invites/accept` | This invite link isn't valid. Ask for a new invite. |
| `INVITE_REVOKED` | 400 | `POST /invites/accept` | This invite was replaced by a newer one or couldn't be delivered. Use the latest invite email or ask for a new invite. |
| `INVITE_ALREADY_ACCEPTED` | 409 | `POST /invites/accept` | This invite has already been accepted. Sign in with Google. |
| `INVITE_PENDING` | 409 | `POST /invites` | An invite for this email is already being created. Try again in a moment. |
| `INVITE_EXPIRED` | 410 | `POST /invites/accept` | This invite has expired. Ask for a new invite. |
| `EMPLOYEE_EXISTS` | 409 | `POST /invites`, `POST /invites/accept` | An employee with this email already exists. |
| `EMAIL_DELIVERY_FAILED` | 502 | `POST /invites` | The invite email couldn't be sent, so the invite was cancelled. Try again. |
| `AUTH_REQUIRED` | 401 | any protected endpoint | Sign in to continue. |
| `INVALID_AUTH_TOKEN` | 401 | any protected endpoint | Your session has expired. Sign in again. |
| `FORBIDDEN` | 403 | role/ownership-restricted endpoints | You don't have permission to do that. |
| `INVALID_GOOGLE_TOKEN` | 401 | `POST /auth/google` | Google sign-in failed. Try again. |
| `GOOGLE_EMAIL_NOT_VERIFIED` | 401 | `POST /auth/google` | Your Google email address isn't verified. |
| `EMAIL_DOMAIN_NOT_ALLOWED` | 401 | `POST /auth/google` | Sign in with your @saajha.org Google account. |
| `NOT_INVITED` | 403 | `POST /auth/google` | You haven't been invited to FlowDesk, or haven't accepted your invite yet. |
| `ACCOUNT_INACTIVE` | 403 | `POST /auth/google` | Your FlowDesk account has been deactivated. |
| `GOOGLE_ACCOUNT_MISMATCH` | 403 | `POST /auth/google` | This FlowDesk account is linked to a different Google account. |
| `GOOGLE_UNAVAILABLE` | 502 | `POST /auth/google` | Google sign-in is temporarily unavailable. Try again shortly. |
| `PROGRAM_KEY_EXISTS` | 409 | `POST /programs` | A program with this key already exists. |
| `OWNER_TEAM_NOT_FOUND` | 400 | `POST /programs`, `PATCH /programs/{programId}` | The owner team doesn't exist or has been deleted. |
| `ASSIGNEE_NOT_FOUND` | 400 | `POST`/`PATCH` tasks | The assignee doesn't exist or is inactive. |
| `INVALID_DATE_RANGE` | 400 | `POST`/`PATCH` tasks | The due date must be on or after the start date. |
| `TASK_BLOCKED` | 409 | `POST`/`PATCH` tasks | This task is blocked by unfinished dependencies. *(UI lists `details.blockers`)* |
| `TASK_DONE` | 409 | `POST …/dependencies` | `null` ("Reopen the task before adding an unfinished dependency") |
| `DEPENDENCY_TASK_NOT_FOUND` | 400 | `POST` tasks, `POST …/dependencies` | `null` |
| `DEPENDENCY_OTHER_PROGRAM` | 400 | `POST` tasks, `POST …/dependencies` | `null` |
| `SELF_DEPENDENCY` | 400 | `POST …/dependencies` | A task can't depend on itself. |
| `DEPENDENCY_EXISTS` | 409 | `POST …/dependencies` | `null` |
| `DEPENDENCY_LIMIT_REACHED` | 400 | `POST …/dependencies` | `null` ("A task can have at most 50 dependencies") |
| `DEPENDENCY_CYCLE` | 409 | `POST …/dependencies` | Adding this dependency would create a cycle. |
| `PARENT_COMMENT_NOT_FOUND` | 400 | `POST` comments | The comment you're replying to no longer exists. |
| `PARENT_TARGET_MISMATCH` | 400 | `POST` comments | A reply must be on the same task or program as its parent. |
| `NESTED_REPLY` | 400 | `POST` comments | Replies can't have replies. Reply to the top-level comment. |
| `TOO_MANY_MENTIONS` | 400 | `POST` comments, `PATCH` comment | `null` ("A comment can mention at most 20 people") |
| `MENTION_NOT_FOUND` | 400 | `POST` comments, `PATCH` comment | `null` |
| `TEAM_NAME_EXISTS` | 409 | `POST /teams`, `PATCH /teams/{teamId}` | A team with this name already exists. |
| `TEAM_OWNS_PROGRAMS` | 409 | `DELETE /teams/{teamId}` | This team still owns programs. Move them to another team first. *(UI lists `details.programs`)* |
| `NETWORK_ERROR` | 0 | frontend only | Can't reach the FlowDesk server. Check your connection and try again. |

> Rendering `details.blockers` / `details.programs` is the job of the tasks/teams features. This spec only guarantees `details` reaches them intact.

## Query defaults (`src/lib/queryClient.ts`)

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})
```

- 4xx is never retried; a repeat gives the same answer. Network (0) and 5xx are retried at most twice with TanStack's default backoff.
- Mutations are never retried automatically, because a retried `POST /invites` would send a second email and revoke the first invite.
- No global `onError` toast yet. That arrives with the UI spec, and it will use `getErrorMessage`.

`main.tsx` wraps `<App />` in `<QueryClientProvider client={queryClient}>` and registers the interim handler:

```ts
onUnauthorized(() => { clearSession(); queryClient.clear() })
```

Spec 03 moves this into the auth provider and adds the redirect.

## Temporary API status screen (`src/App.tsx`)

Replace the Vite demo with a minimal screen to check that the stack works end to end:
- `useQuery({ queryKey: ['health'], queryFn: () => unwrap(apiClient.GET('/health-check')) })`
- loading → "Checking API…"; success → "API ok · database time <dbTime>"; error → `getErrorMessage(error)` plus a **Retry** button (`refetch`).

`GET /health-check` returns 500 with `HealthError` when the database is down; that path shows the 5xx fallback message. Delete `src/assets/hero.png`, `react.svg` and `vite.svg` if nothing references them any more.

## Tests (Vitest + MSW)

`src/test/server.ts` exports `server = setupServer()`. `src/test/setup.ts` runs `server.listen({ onUnhandledRequest: 'error' })` before all tests, `server.resetHandlers()` + `localStorage.clear()` after each, and `server.close()` after all. Handlers return the **exact bodies from the contract examples** above.

| File | Case | Expected |
|---|---|---|
| `errors.test.ts` | 400 `{"error":"Validation failed","details":[{"path":"email",…},{"path":"email",…}]}` | `fieldErrors.email` = first message; no `code` |
| | 400 Malformed JSON (`path: ""`) | `formErrors[0]` set; `fieldErrors` empty |
| | 409 `TASK_BLOCKED` with `details.blockers` | `code === 'TASK_BLOCKED'`; `details` deep-equals the input |
| | 404 `{"error":"Team not found"}` | no code; `getErrorMessage` → "Team not found" |
| | 404 HTML string | status 404, no code, no `serverMessage`; message "Not found." |
| | 500 `{"error":"Internal server error"}` | message is the 5xx fallback, never the server text |
| | 409 with an unknown code | falls back to `serverMessage` |
| | `DEPENDENCY_EXISTS` (mapped `null`) | shows `serverMessage` |
| | every `KNOWN_ERROR_CODES` entry | has a key in `ERROR_MESSAGES` (loop) |
| `client.test.ts` | token stored, not expired | request has `Authorization: Bearer <token>` |
| | no token / expired token | no `Authorization` header; expired key removed from storage |
| | 401 `INVALID_AUTH_TOKEN` from `/auth/me` | `unwrap` rejects with an `ApiError` 401; `onUnauthorized` listener called **once** |
| | 401 `INVALID_GOOGLE_TOKEN` from `/auth/google` | rejects with `ApiError`; listener **not** called |
| | `HttpResponse.error()` (network failure) | `ApiError` status 0, code `NETWORK_ERROR` |
| | 204 from `DELETE /teams/{teamId}` | resolves to `undefined` |
| | aborted request (`signal`) | rejects with `AbortError`, not `ApiError` |
| `queryClient.test.ts` | `retry(0, ApiError 404)` / `retry(0, ApiError 0)` / `retry(2, ApiError 500)` | `false` / `true` / `false` |

## Contract gaps found while writing this spec

Report these to the backend; the client handles them as described and doesn't work around them silently.

1. **`ErrorResponse.code` is a free `string`.** The 36 codes are listed only in its *description*, so openapi-typescript can't generate a union type. That's why `KNOWN_ERROR_CODES` is copied by hand. Ask for `code` to be an `enum` in the schema; once it is, derive the type from `components["schemas"]["ErrorResponse"]["code"]` and delete the manual list.
2. **Unknown routes return Express's HTML 404**, not `ErrorResponse`. They're outside the contract, so `toApiError` treats any non-JSON body as status-only.
3. **404s and validation errors carry no `code`.** The client tells them apart by status and by `details` being an array. That works, but it's implicit.
4. **The `POST /employees` 409 has no documented `code`** (already listed in CLAUDE.md).

## Acceptance checklist

- [ ] `npm install` succeeds without `--legacy-peer-deps`; `npm run api:types` (backend running) writes `src/api/schema.d.ts` under TypeScript 6
- [ ] `tsconfig.app.json` is `strict`; `@/` imports resolve in both `tsc` and Vite
- [ ] Missing `VITE_API_BASE_URL` → the app throws the documented startup error
- [ ] Stored, non-expired token → `Authorization: Bearer <token>` sent; none when absent; an expired token is removed and not sent
- [ ] 400 validation → `ApiError` with `fieldErrors[path]`; malformed JSON → `formErrors[0]`
- [ ] 409 `TASK_BLOCKED` → `code` set, `details.blockers` intact
- [ ] 404 JSON → server message shown; 404 HTML → "Not found."
- [ ] 500 → generic message only; 502 → "temporarily unavailable" (or the code's message)
- [ ] Backend stopped → `ApiError` status 0 `NETWORK_ERROR`, connection message
- [ ] 204 → `unwrap` resolves `undefined`; aborted request → `AbortError` passes through
- [ ] 401 from a protected endpoint fires `onUnauthorized` once and the interim handler clears the session + query cache; 401 from `/auth/google` does not fire it
- [ ] Queries don't retry 4xx; retry network/5xx at most twice; mutations never retry
- [ ] Every `KNOWN_ERROR_CODES` entry has an `ERROR_MESSAGES` entry
- [ ] Status screen shows "API ok · database time …" against `localhost:3001`, and the connection message with a working Retry when the backend is stopped
- [ ] No module outside `src/config/env.ts` reads `import.meta.env`; nothing outside `src/api/` imports `openapi-fetch` or calls `fetch`
- [ ] `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` pass

## Testing notes

- Real 401s: `curl -H "Authorization: Bearer abc" http://localhost:3001/auth/me` returns `{"error":"Invalid or expired access token","code":"INVALID_AUTH_TOKEN"}`. In the browser, set `localStorage['flowdesk.session'] = JSON.stringify({ accessToken: 'abc', expiresAt: Date.now() + 3600e3 })`, then call `unwrap(apiClient.GET('/auth/me'))` from the console (temporarily expose it) and check that the key is cleared afterwards.
- Real network failure: stop the backend and reload the status screen.
- Real malformed JSON: `curl -X POST -H "Content-Type: application/json" -d '{bad' http://localhost:3001/invites/accept`.

## Out of scope / follow-ups

- Toasts, `ErrorState` / `ForbiddenState` / `NotFoundState` components, Tailwind and shadcn: the frontend-setup and layout specs.
- Google login, `VITE_GOOGLE_CLIENT_ID`, the auth provider, the 401 redirect and the "session expired" message: spec 03.
- A react-hook-form helper that applies `ApiError.fieldErrors` / `formErrors` to a form: the first spec with a form (invitations).
- Request timeouts / `AbortSignal.timeout`, TanStack Query devtools, request logging.
- Regenerating `schema.d.ts` in CI or checking it for drift.
