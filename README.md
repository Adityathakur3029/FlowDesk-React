# FlowDesk-React

Frontend for **FlowDesk**, Saajha's mini Jira-style project management tool (programs, tasks, teams, comments). It talks to the FlowDesk API (Express), and staff sign in with their **@saajha.org Google account**.

## Stack

Vite 8 · React 19 + TypeScript (strict) · React Router v7 · TanStack Query v5 · `openapi-fetch` with types generated from the API contract · shadcn/ui + Tailwind CSS v4 · Google Identity Services (`@react-oauth/google`) · sonner toasts · Vitest + MSW + Testing Library · oxlint

## Prerequisites

- Node.js 20+ and npm
- The FlowDesk API running on `http://localhost:3001` (its contract is at `/openapi.json`, with Swagger UI on the same host)
- A Google OAuth **Web** client: the **same** client ID the backend uses as `GOOGLE_CLIENT_ID`

## Getting started

```bash
npm install
cp .env.example .env.local    # then fill in the values below
npm run dev                   # http://localhost:5173
```

### Environment variables

Real values go in **`.env.local`**, which is gitignored by `*.local`. Don't use `.env`, because it isn't gitignored. Everything in `VITE_*` variables ships to the browser, so **never put a secret here** (no Google client secret, no JWT secret).

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3001` | FlowDesk API base URL |
| `VITE_GOOGLE_CLIENT_ID` | `1234-abc.apps.googleusercontent.com` | Public OAuth client ID. Must match the backend's `GOOGLE_CLIENT_ID`, otherwise sign-in fails with `INVALID_GOOGLE_TOKEN` |

Both variables are validated at startup in `src/config/env.ts`. If one is missing, the app stops with an error naming it. Vite reads env files only at startup, so restart `npm run dev` after editing them.

### Google Cloud console (one-time)

In the OAuth client's **Authorized JavaScript origins**, add:

- `http://localhost:5173`
- `http://localhost`

No redirect URI is needed. If the Google button is blank or shows `origin_mismatch`, this is usually the cause. Changes can take a few minutes to apply.

### Backend settings that affect the frontend

- `APP_BASE_URL` must be this frontend's origin (`http://localhost:5173` in dev), because invite emails link to `/invites/accept?token=…`.
- Only invited employees can sign in. An @saajha.org account needs an **accepted invite**; employees created directly through `POST /employees` get `NOT_INVITED`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Typecheck (`tsc -b`) + production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | oxlint |
| `npm test` / `npm run test:watch` | Vitest (MSW mocks the API; no backend needed) |
| `npm run api:types` | Regenerate `src/api/schema.d.ts` from `http://localhost:3001/openapi.json` (backend must be running) |

Run `npm run api:types` before starting work on a feature so the generated types match the running backend. Never edit `schema.d.ts` by hand.

## How sign-in works

1. `/login` shows the Google button. Google returns an ID token (`credential`).
2. The app sends it to `POST /auth/google` and receives a FlowDesk access token (valid for 8 hours) plus the employee.
3. The token and its expiry are stored in `localStorage` (`flowdesk.session`). Every API call sends `Authorization: Bearer <token>`.
4. On reload, `GET /auth/me` re-checks the token and fetches the employee's **current** role.
5. The session ends when the 8 hours run out, on any `401`, or on **Sign out** (sign-out happens in the browser only; the backend has no logout endpoint). After an expiry or `401`, the user is sent to `/login?redirect=<previous page>` with a "session expired" message.

Role checks in the UI (`RequireRole`, `useHasRole`) only hide or disable actions. The backend enforces permissions.

## Project layout

```
src/
  api/          openapi-fetch client, auth middleware, ApiError + error messages, generated schema.d.ts
  auth/         AuthProvider, useAuth, token storage, RequireAuth / RequireRole, LoginPage
  components/   ui/ (shadcn), brand/ (Saajha logo), feedback/ (loader, empty, error, forbidden, not found)
  config/       validated env
  features/     one folder per feature (invites, employees, teams, programs, tasks, comments)
  lib/          cn(), queryClient
  routes/       route tree and path constants
```

Requests go: page/component → feature hook (`features/*/api.ts`) → `apiClient` → API. Components never call `fetch` directly.

Conventions, the API rules and the role matrix are in [`.claude/CLAUDE.md`](.claude/CLAUDE.md). Each feature is designed in a spec in [`.claude/specs/`](.claude/specs/) before it's built.

## Status

| # | Feature | Spec | State |
|---|---|---|---|
| 1 | API client and error handling | [01](.claude/specs/01-api-client-and-errors.md) | Implemented |
| 2 | Frontend setup (Tailwind, shadcn, router, feedback states) | [02](.claude/specs/02-frontend-setup.md) | Implemented, browser checks pending |
| 3 | Login (Google sign-in, session, guards) | [03](.claude/specs/03-login.md) | Implemented, real Google sign-in not yet tested |
| 4 | App layout (shell, navigation, user menu) | | Next |
| 5 | Invitations (invite form, accept page) | | Planned |
| 6 | Member management | | Planned |
| 7 | Teams → programs → tasks → comments | | Planned |

## Troubleshooting

| Symptom | Fix |
|---|---|
| App fails at startup with `Invalid environment: …` | Fill in the named variable in `.env.local` and restart `npm run dev` |
| Google button blank / `origin_mismatch` | Add `http://localhost:5173` and `http://localhost` to the OAuth client's JavaScript origins |
| "Google sign-in failed" right after picking an account | `VITE_GOOGLE_CLIENT_ID` differs from the backend's `GOOGLE_CLIENT_ID` |
| "Sign in with your @saajha.org Google account" | Use an @saajha.org account (subdomains aren't accepted) |
| "You haven't been invited…" | The employee needs an accepted invite |
| "Can't reach the FlowDesk server" | Start the backend, or check `VITE_API_BASE_URL` |
