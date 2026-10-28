# 04 — App layout and People (sidebar, employee list, invite member)

**Status:** Implemented (2026-10-18). Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `sidebar`
**Depends on:** [01-api-client-and-errors](./01-api-client-and-errors.md) (`apiClient`, `unwrap`, `ApiError`, `getErrorMessage`, `ERROR_MESSAGES`), [02-frontend-setup](./02-frontend-setup.md) (shadcn, router, feedback components, `SaajhaLogo`), [03-login](./03-login.md) (`RequireAuth`, `useAuth`, `useHasRole`, `signOut`)

## Goal

Signed-in users get the real app frame, and the first screen in it: **People**.

1. **AppShell**: a left sidebar (logo, navigation), a top header (sidebar toggle, page title, user menu) and the page content. It replaces the temporary `HomePage`.
2. **Extensible navigation**: the sidebar is driven by one `navItems` list. Each item declares its path, icon and the roles it's shown to. Today there's one item, **People**. Teams, Programs and Tasks are added later by appending to the list, without touching the sidebar component.
3. **People page (`/people`)**: every active employee in a paginated table (name, email, role, joined), with a role filter and an "Include inactive" toggle. Filters and page live in the URL.
4. **Invite member**: ADMIN and MANAGER see an **Invite member** button on the People page. It opens a dialog (email, name, role) that calls `POST /invites` and handles every documented error. MEMBERs don't see the button.
5. **Global render-error boundary**: a crash in one page shows an error panel inside the shell instead of a blank screen.

The public `/invites/accept` page isn't part of this spec (see Out of scope).

## Flow

```
Browser                                    FlowDesk API
   │ 1. visit /  (signed in)                   │
   │    → <Navigate to="/people" replace>      │
   │ 2. /people?role=MANAGER&offset=20         │
   │    GET /employees?role=MANAGER&limit=20&offset=20
   │──────────────────────────────────────────>│
   │ 3. 200 { data: Employee[], meta }         │
   │<──────────────────────────────────────────│ render table + pager
   │                                           │
   │ ── ADMIN / MANAGER only ─────────────────  │
   │ 4. click "Invite member" → dialog         │
   │ 5. submit  POST /invites { email, name, role }
   │──────────────────────────────────────────>│ record invite, send email
   │ 6a. 201 { data: EmployeeInvite }          │
   │<──────────────────────────────────────────│ toast, close dialog
   │ 6b. 400 / 403 / 409 / 502 → errors in the dialog, values kept
```

The People list isn't invalidated after an invite: an invite doesn't create an employee. The employee only appears once the invitee accepts (`POST /invites/accept`).

## Environment variables

None new.

## Packages

| Package | Kind | Purpose |
|---|---|---|
| `react-hook-form` | dependency, **new** | Invite form state |
| `@hookform/resolvers` | dependency, **new** | `zodResolver` (v5, which supports zod 4) |
| shadcn components, **new** | source in `src/components/ui` | `npx shadcn add sidebar dialog input label select table dropdown-menu avatar switch field`. `sidebar` also pulls in `sheet`, `tooltip` and `src/hooks/use-mobile.ts` |
| `lucide-react`, `zod`, `sonner`, `@tanstack/react-query`, `react-router` | already installed | icons, schema, toasts, queries, routing |

> `src/hooks/` is new. It's where shadcn puts `use-mobile.ts` (the `hooks` alias in `components.json`). Add it to the CLAUDE.md folder layout.

## Folder layout (new and changed)

```
src/
  hooks/use-mobile.ts                    NEW (shadcn)  used by the sidebar for its mobile sheet
  components/
    ui/…                                 NEW (shadcn)  see Packages
    layout/
      AppShell.tsx                       NEW      SidebarProvider + AppSidebar + Header + error boundary + <Outlet/>
      AppSidebar.tsx                     NEW      logo, nav groups built from navItems, filtered by role
      Header.tsx                         NEW      SidebarTrigger, page title, UserMenu
      UserMenu.tsx                       NEW      avatar initials → dropdown: name, email, role, Sign out
      PageHeader.tsx                     NEW      page <h1>, description, actions, document <title>
      navItems.ts                        NEW      NavItem type + the navItems list
    feedback/
      RouteErrorBoundary.tsx             NEW      class error boundary, resets on navigation
  features/
    employees/
      types.ts                           NEW      Employee, EmployeeListParams aliases
      api.ts                             NEW      employeeKeys, fetchEmployees, useEmployees
      searchParams.ts                    NEW      parse/serialise ?role&includeInactive&offset
      components/EmployeeTable.tsx       NEW
      components/EmployeeFilters.tsx     NEW
      components/Pagination.tsx          NEW      "Showing 21–40 of 57" + Previous / Next
      pages/PeoplePage.tsx               NEW
    invites/
      index.ts                           NEW      public entry: exports InviteMemberDialog
      types.ts                           NEW      CreateInviteRequest, EmployeeInvite aliases
      api.ts                             NEW      inviteKeys, useCreateInvite
      inviteSchema.ts                    NEW      zod schema for the form
      components/InviteMemberDialog.tsx  NEW
  routes/
    paths.ts                             CHANGED  + people: '/people'
    router.tsx                           CHANGED  protected routes nested in AppShell; "/" → /people
    HomePage.tsx                         DELETED  replaced by the shell (the API-status card goes with it)
```

Request flow: `PeoplePage` → `useEmployees` (`features/employees/api.ts`) → `unwrap(apiClient.GET('/employees'))`; `InviteMemberDialog` → `useCreateInvite` (`features/invites/api.ts`) → `unwrap(apiClient.POST('/invites'))`.

> **Cross-feature import.** `PeoplePage` needs the invite dialog, but features don't import each other's internals. Each feature can expose a public `index.ts`, and other features import only from it (`import { InviteMemberDialog } from '@/features/invites'`), never `@/features/invites/components/…`. This is the first one. Add the rule to CLAUDE.md.

## Types

```ts
// features/employees/types.ts
import type { components, paths } from '@/api/schema'
export type Employee = components['schemas']['Employee']
export type EmployeeRole = components['schemas']['EmployeeRole']   // 'ADMIN' | 'MANAGER' | 'MEMBER'
export type EmployeeListParams = NonNullable<paths['/employees']['get']['parameters']['query']>
export type EmployeeList = components['schemas']['EmployeeListResponse']

// features/invites/types.ts
export type CreateInviteRequest = components['schemas']['CreateInviteRequest']
export type EmployeeInvite = components['schemas']['EmployeeInvite']
```

`auth/types.ts` already has `Employee` and `Role`. The employees feature defines its own aliases of the same generated types instead of importing from `auth/`, so the feature doesn't depend on auth internals.

## Navigation (`components/layout/navItems.ts`)

```ts
export interface NavItem {
  label: string
  to: string                 // a paths.* constant
  icon: LucideIcon
  roles?: readonly Role[]    // omitted = every signed-in role
}

export const navItems: NavItem[] = [
  { label: 'People', to: paths.people, icon: Users },
  // Later: Teams, Programs, Tasks. Append here; the sidebar needs no change.
]
```

**AppSidebar:**
- shadcn `Sidebar` with `collapsible="icon"`. On desktop it collapses to an icon rail; below the `md` breakpoint it becomes an off-canvas sheet (shadcn's built-in `useIsMobile`).
- `SidebarHeader`: `SaajhaLogo` (32 px) + "FlowDesk". Only the logo shows when collapsed.
- `SidebarContent` → one `SidebarGroup` labelled "Workspace" → a `SidebarMenuButton` per visible item, rendered `asChild` around React Router's `NavLink`. `isActive` comes from the `NavLink` match (`/people` and anything under it). The active item is derived from the URL and never kept in state.
- An item is visible when it has no `roles` or `roles.includes(employee.role)`. Filtering is UX only; every page still handles 403.
- Collapsed items show their label as a tooltip (`SidebarMenuButton tooltip={label}`).
- Clicking an item on mobile closes the sheet (`setOpenMobile(false)`).

**Collapsed / expanded state** is a per-device UI preference. shadcn's `SidebarProvider` already persists it in a `sidebar_state` cookie and toggles on <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>B</kbd>. Keep that default; no extra storage code. The cookie isn't read by the backend and holds no session data.

## Header and user menu

> Replaced by [12-layout-and-density](./12-layout-and-density.md): there's no header on desktop. The user menu (`SidebarUserMenu`) and a collapse button sit in the sidebar footer, and phones get a `MobileTopBar` with only the toggle. The section below is kept as the original design.

- `Header`: sticky top bar, `h-14`, bottom border. Left: `SidebarTrigger` (labelled "Toggle sidebar") and a `Separator`. Middle: the page `<h1>` (each page passes its title through a `title` prop on a `PageHeader`, see below). Right: `UserMenu`.
- `UserMenu`: a `<button>` showing an `Avatar` with initials (first letters of the first two words of `employee.name`, uppercased). It opens a `DropdownMenu`:
  - label: name (bold), email (muted), role `Badge`
  - separator
  - **Sign out** (`LogOut` icon) → `signOut()` from `useAuth` (spec 03: clears storage and cache, goes to `/login`)
- The trigger's accessible name is "Account menu for {name}".

**Page header.** Pages render `<PageHeader title="People" description? actions?>` at the top of their content: the `<h1>`, an optional muted line, and right-aligned actions (the Invite button). It also sets the document title with React 19's `<title>{title} · FlowDesk</title>`. The `Header` bar itself doesn't show the title, so the title comes from one place. Put `PageHeader.tsx` in `components/layout/`.

## Routes (`src/routes/router.tsx`)

| Path | Element |
|---|---|
| `/login` | `LoginPage` (public, unchanged) |
| (layout) | `RequireAuth` → `AppShell` |
| `/` | `<Navigate to={paths.people} replace />` |
| `/people` | `PeoplePage` |
| `*` (inside the shell) | the existing `NotFoundState`, unchanged (its "Go home" goes to `/`, which redirects to People). Replaces today's public catch-all |

> **404 placement.** Today `*` is public so a typo doesn't force a sign-in. With the shell it moves inside `RequireAuth`: a signed-out user on `/typo` goes to `/login?redirect=%2Ftypo` and then sees the 404 inside the shell after signing in. That's simpler than two catch-alls, and only `/login` and `/invites/accept` are meant to be public. The spec-03 test for `/teams?x=1` (signed out → `/login?redirect=…`) still holds.

## Error boundary (`components/feedback/RouteErrorBoundary.tsx`)

Declarative-mode React Router has no `errorElement`, so this is a small class component (`getDerivedStateFromError` + `componentDidCatch`).
- `AppShell` wraps `<Outlet />` in `<RouteErrorBoundary key={location.pathname}>`. The `key` resets the boundary when the user navigates elsewhere, so the sidebar keeps working after a crash.
- Fallback: `ErrorState` with title "This page crashed", message "Something went wrong. Try again." (the generic text, since a render error isn't an `ApiError`) and a **Reload** button that calls `window.location.reload()`.
- No `componentDidCatch` logging: React 19 already reports caught errors to the console (`onCaughtError` default). Nothing else is logged, and never the token.
- API errors are **not** thrown into the boundary (no `throwOnError`). Each query renders its own `ErrorState`.

## People page (`/people`)

### URL state (`features/employees/searchParams.ts`)

| Param | Values | Default | Sent to the API as |
|---|---|---|---|
| `role` | `ADMIN`, `MANAGER`, `MEMBER` | none (all roles) | `role` |
| `includeInactive` | `true` | absent (= false) | `includeInactive=true` only when set |
| `offset` | integer ≥ 0 | `0` | `offset` |

- `limit` is fixed at **20** (the contract default) and isn't in the URL.
- `parseEmployeeSearch(searchParams)` drops anything invalid (unknown role, `offset=-3`, `offset=abc`, `includeInactive=yes`) and uses the default. This is URL hygiene, so a hand-edited link can't produce a 400; it doesn't decide anything the API decides.
- Changing a filter resets `offset` to 0. Each change pushes a history entry, so Back undoes it.
- `teamId` isn't exposed yet (there's no teams UI to pick from). The parser ignores it.

### Data (`features/employees/api.ts`)

```ts
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params: EmployeeListParams) => [...employeeKeys.lists(), params] as const,
}

export function fetchEmployees(params: EmployeeListParams, signal?: AbortSignal): Promise<EmployeeList>
  // unwrap(apiClient.GET('/employees', { params: { query: params }, signal }))  — the whole body: data + meta

export function useEmployees(params: EmployeeListParams)
  // useQuery({ queryKey: employeeKeys.list(params), queryFn, placeholderData: keepPreviousData })
```

`keepPreviousData` keeps the current page visible while the next page or filter loads, so the table doesn't flash a skeleton on every click. While `isPlaceholderData`, the table gets `aria-busy="true"` and reduced opacity, and the pager buttons are disabled.

### Layout

```
┌ PageHeader ─────────────────────────────────────────────────────────┐
│ People                                          [ + Invite member ] │
│ Everyone in your organisation.                                      │
├ EmployeeFilters ────────────────────────────────────────────────────┤
│ Role [ All roles ▾ ]    [◯] Include inactive        Clear filters   │
├ EmployeeTable ──────────────────────────────────────────────────────┤
│ Name                 Email                    Role      Joined      │
│ Jane Doe  (You)      jane.doe@saajha.org      MANAGER   15 Oct 2026 │
│ Ravi Kumar Inactive  ravi.kumar@saajha.org    MEMBER    02 Oct 2026 │
├ Pagination ─────────────────────────────────────────────────────────┤
│ Showing 1–20 of 57                          [ Previous ] [ Next ]   │
└─────────────────────────────────────────────────────────────────────┘
```

- **Invite member** button (`UserPlus` icon) is rendered only when `useHasRole(['ADMIN', 'MANAGER'])`. It opens `InviteMemberDialog`.
- **Filters:** a `Select` labelled "Role" (All roles, Admin, Manager, Member), a `Switch` labelled "Include inactive", and a "Clear filters" ghost button shown only when a filter is set.
- **Table** (shadcn `Table` inside an `overflow-x-auto` container, so it scrolls sideways on phones instead of the page):
  - **Name**, plus a "You" `Badge` (outline) when `id === employee.id`, plus an "Inactive" `Badge` (secondary) when `!isActive`.
  - **Email** (`emailId`).
  - **Role**: `Badge` with the role in title case ("Manager").
  - **Joined**: `createdAt` formatted with `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })`.
  - No team column yet: `teamId` is only a UUID until the teams feature exists.
  - Rows aren't clickable (no detail page yet).
- **Pagination:** "Showing {offset+1}–{offset+data.length} of {meta.total}". **Previous** is disabled at `offset === 0`; **Next** is disabled when `offset + limit >= meta.total`. Both are real `<button>`s that update `offset` by `limit`. Hidden when `meta.total <= limit` and `offset === 0`.

### States

| State | What renders |
|---|---|
| first load (`isPending`) | `PageHeader` (with the Invite button if allowed) + 5 skeleton rows in the table |
| success | the table |
| empty, no filters | `EmptyState` "No people yet", with the Invite button as its `action` for ADMIN/MANAGER (practically unreachable, since you're an employee yourself) |
| empty, filters set | `EmptyState` "No people match these filters" with a "Clear filters" action |
| empty page past the end (`data.length === 0 && meta.total > 0`, e.g. a stale `?offset=200`) | `EmptyState` "This page is empty" with a "Go to first page" action |
| 400 validation | can't happen after `parseEmployeeSearch`; if it does, `ErrorState` with `getErrorMessage` (the server's "Validation failed" text) and Retry |
| 401 | the client middleware ends the session (spec 03) |
| 500 / network | `ErrorState` "Couldn't load people" with Retry (`refetch`, `retrying = isFetching`) |

`GET /employees` documents no 403 or 404, so the page has no forbidden or not-found state.

## Invite member dialog (`features/invites`)

### API (`features/invites/api.ts`)

```ts
export const inviteKeys = { all: ['invites'] as const }   // no invite queries yet; kept for later invalidation

export function useCreateInvite()
  // useMutation<EmployeeInvite, ApiError, CreateInviteRequest>({
  //   mutationFn: (body) => unwrap(apiClient.POST('/invites', { body })).then((r) => r.data) })
```

No cache invalidation on success: no query lists invites, and an invite doesn't add an employee.

### Form (`features/invites/inviteSchema.ts`)

Mirrors `CreateInviteRequest` for instant feedback only. The server's `details` always win.

| Field | Control | zod rule | Message |
|---|---|---|---|
| `email` | `Input type="email" autoComplete="off"`, hint "Must be an @saajha.org address." | `z.string().trim().min(1).max(255).pipe(z.email())` | "Enter an email address." / "Enter a valid email address." / "Use at most 255 characters." |
| `name` | `Input autoComplete="off"` | `z.string().trim().min(1).max(150)` | "Enter a name." / "Use at most 150 characters." |
| `role` | `Select`: Member, Manager, Admin | `z.enum(['ADMIN','MANAGER','MEMBER'])`, default `MEMBER` | — |

> **No client-side domain check.** The `@saajha.org` rule is backend business logic (CLAUDE.md §1), and the backend also rejects subdomains and lookalikes. The form shows the rule as a hint, and the server's 400 for `email` lands on the field.

Fields use shadcn `Field` / `FieldLabel` / `FieldDescription` / `FieldError`, so each input has a `<label>`, and errors are linked with `aria-invalid` + `aria-describedby`. Focus moves to the first invalid field on submit.

### Behaviour

1. **Open:** the Invite button opens a `Dialog` titled "Invite a member", description "They'll get an email with a link to join FlowDesk. The link works for 72 hours." Focus goes to Email.
2. **Submit** (`Send invite`, `Mail` icon): disabled and labelled "Sending invite…" while pending. While pending, the dialog can't be closed (Escape, outside click and Cancel are ignored), so a closed dialog never hides a request still in flight.
3. **Success (201):** close the dialog, reset the form, and toast `success("Invite sent to {data.emailId}")` with description "The link expires {expiresAt formatted with dateStyle medium + timeStyle short}."
4. **Errors**, handled in this order. Every one keeps the entered values so the user can fix and resend:

| Response | Where it shows | Text |
|---|---|---|
| 400 `Validation failed` | each `fieldErrors[path]` on its field (`email`, `name`, `role`); `formErrors` and unknown paths in a form-level `Alert` | the server's `message` |
| 400 `Malformed JSON body` | form-level `Alert` | `getErrorMessage` |
| 403 `FORBIDDEN` | form-level `Alert` | "You don't have permission to do that." (the role may have changed since sign-in) |
| 409 `EMPLOYEE_EXISTS` | on the **email** field | "An employee with this email already exists." |
| 409 `INVITE_PENDING` | form-level `Alert` | "An invite for this email is already being created. Try again in a moment." |
| 502 `EMAIL_DELIVERY_FAILED` | form-level `Alert` | "The invite email couldn't be sent, so the invite was cancelled. Try again." |
| 401 | middleware ends the session; the dialog unmounts with the shell | — |
| 500 / network | form-level `Alert` | `getErrorMessage` |

All of these messages already exist in `ERROR_MESSAGES` / `getErrorMessage`. The dialog uses them as-is and adds no new strings to `errors.ts`.

5. **Re-inviting** an email with a pending invite succeeds (201) and revokes the earlier link (contract). The dialog doesn't warn about it: the API can't tell the frontend whether a pending invite existed.
6. Mutations aren't retried (`queryClient` default), which matters here: a retried `POST /invites` would send a second email and revoke the first.

## Tests (Vitest + MSW + RTL)

MSW handlers return the contract's example bodies. A helper renders the app signed in as a given role (token in storage, `/auth/me` returns an employee with that role).

| File | Case | Expected |
|---|---|---|
| `components/layout/layout.test.tsx` | signed in, visit `/` | lands on `/people`; sidebar shows "People" marked `aria-current="page"` |
| | nav item with `roles: ['ADMIN']` (test-only list) as MEMBER / ADMIN | hidden / shown |
| | open user menu | name, email and role shown; Sign out → `/login`, storage cleared |
| | signed in, `/typo` | `NotFoundState` inside the shell (sidebar visible) |
| | a page that throws while rendering | "This page crashed" inside the shell; clicking People renders the page again |
| `features/employees/searchParams.test.ts` | `?role=MANAGER&offset=20&includeInactive=true`; `?role=BOSS&offset=-1&includeInactive=yes`; empty | parsed values; all defaults; all defaults |
| `features/employees/people.test.tsx` | 200 with 1 employee (`meta.total: 1`) | row with name, email, "Manager", formatted date; no pager |
| | request made for `/people?role=MEMBER&includeInactive=true&offset=20` | query is `role=MEMBER&includeInactive=true&limit=20&offset=20` |
| | change the role filter while on `offset=20` | URL has the new role and no `offset` |
| | `meta.total: 45`, `offset=20` | "Showing 21–40 of 45"; Previous and Next enabled; Next → `offset=40`, Next then disabled |
| | inactive employee / own row | "Inactive" badge / "You" badge |
| | 200 `data: []` with a filter set | "No people match these filters"; Clear filters → URL has no params |
| | `data: []`, `meta.total: 3`, `offset=200` | "This page is empty"; Go to first page → `offset` removed |
| | 500 | "Couldn't load people" + Retry; Retry → 200 → table |
| | as MEMBER / MANAGER / ADMIN | Invite button absent / present / present |
| `features/invites/invite.test.tsx` | submit empty form | field errors for email and name; no request sent |
| | valid submit, 201 | body `{ email, name, role: 'MEMBER' }` (trimmed); dialog closes; toast "Invite sent to jane.doe@saajha.org" |
| | pending | button "Sending invite…" disabled; Escape doesn't close |
| | 400 `details: [{ path: 'email', message: 'Invalid email: must be an @saajha.org address' }]` | that message under Email; values kept |
| | 409 `EMPLOYEE_EXISTS` | message under Email |
| | 409 `INVITE_PENDING` / 502 `EMAIL_DELIVERY_FAILED` / 403 `FORBIDDEN` / 500 | form-level alert with the mapped text; dialog stays open |

## Contract notes

The generated schema matches the running backend (checked 2026-10-18: a fresh `openapi-typescript` run is identical to `src/api/schema.d.ts`). Nothing blocks this spec. To raise with the backend:

1. **Can a MANAGER invite an ADMIN?** `POST /invites` allows ADMIN or MANAGER and accepts any `role`, so as documented a manager can create admins. If that's not intended, the backend should return 403 for it and document it. The UI offers all three roles and handles a 403 either way. It doesn't hide "Admin" for managers, because that would be the frontend inventing a role rule.
2. **No `GET /invites`** (CLAUDE.md gap 1): the page can't show pending invites, and the dialog can't warn that re-inviting revokes an earlier link.
3. **No employee name search** on `GET /employees` (only `role`, `teamId`, `includeInactive`). A search box would have to filter only the current page, which is misleading, so there isn't one.
4. `GET /employees/{id}` returns 404 for deactivated employees, while the list can include them (`includeInactive=true`). Only matters when an employee detail page is added.

## Acceptance checklist

- [x] `npm run api:types` re-run; `features/*/types.ts` only alias generated types
- [ ] Signed in, `/` → `/people` inside the shell: sidebar with logo + "People", header with toggle and user menu
- [ ] Sidebar collapses to icons on desktop (button and <kbd>Ctrl</kbd>+<kbd>B</kbd>), the choice survives a reload, and below `md` it's an off-canvas sheet that closes after picking an item
- [ ] User menu shows name, email, role; Sign out → `/login` with storage cleared
- [ ] People table matches `GET /employees` for the signed-in user's org; "You" badge on own row
- [ ] Role filter, Include inactive and paging update the URL and the request; Back restores the previous view; a hand-edited invalid param falls back to the default without a 400
- [ ] Empty filter result, empty page past the end, and backend stopped (ErrorState + Retry) all render as specified
- [ ] As MEMBER: no Invite button. As MANAGER and ADMIN: button present
- [ ] Invite with a new @saajha.org email → 201, toast, email received with an `/invites/accept?token=…` link to `http://localhost:5173`
- [ ] Invite `someone@gmail.com` → server message under Email; existing employee's email → `EMPLOYEE_EXISTS` under Email
- [ ] Backend email transport failing → `EMAIL_DELIVERY_FAILED` alert (if triggerable locally)
- [ ] 403 handled: demote the signed-in manager in the DB, keep the tab open, send an invite → `FORBIDDEN` alert
- [ ] Unknown path while signed in → 404 inside the shell
- [ ] Keyboard: tab through sidebar, user menu, filters, pager and dialog with visible focus; dialog traps focus and returns it to the Invite button on close
- [ ] Usable at 375 px wide: no page-level horizontal scroll (the table scrolls inside its container)
- [x] CLAUDE.md updated: `src/hooks/`, `components/layout/PageHeader`, the feature `index.ts` rule
- [x] `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` pass

## Verified

**Automated (Vitest + MSW, contract example bodies): 98/98 tests pass across the repo.** New: `layout.test.tsx` (5: `/` → `/people` with People `aria-current="page"`; a role-limited nav item hidden for MEMBER and shown for ADMIN; user menu shows name, email, role and signs out to a bare `/login`; 404 inside the shell; a crashing page is contained and recovers on navigation), `searchParams.test.ts` (7), `people.test.tsx` (10: row contents and badges; URL → exact query `role=MEMBER&includeInactive=true&limit=20&offset=20`; filter change drops `offset`; paging 21–40 → 41–45 with Next disabled; empty-filter and past-the-end states; 500 → Retry; Invite button per role), `invite.test.tsx` (10: client validation without a request; trimmed body; chosen role; pending state ignores Escape; 400 `details` on the field; `EMPLOYEE_EXISTS` on Email; `INVITE_PENDING`, `EMAIL_DELIVERY_FAILED`, `FORBIDDEN`, 500 as form alerts with values kept). The spec-03 auth tests were updated for the People landing page and still pass.

**Against the running backend (curl, 2026-10-18):** `GET /employees` without a token → 401 `AUTH_REQUIRED`; with `Bearer abc` → 401 `INVALID_AUTH_TOKEN` (the client middleware's session-end path); `POST /invites` with `Bearer abc` → 401 `INVALID_AUTH_TOKEN`; CORS preflight from `http://localhost:5173` for `GET /employees` with `authorization` → 204, allowed. `npm run api:types` output is identical to the committed `schema.d.ts`.

**Still to do by hand** (unticked items above): everything that needs a signed-in browser session: real data in the table, filters/paging/Back, sidebar collapse persistence and mobile sheet, real invite email, 403 after demotion, keyboard and 375 px checks.

## Implementation notes

- **Spec-03 fix: sign-out no longer navigates.** With the landing page at `/people`, `signOut()` landed on `/login?redirect=%2Fpeople`: React Router runs `navigate()` as a transition, so `RequireAuth` rendered first with the old location. `AuthState` gained `signedOut` (true after `signOut()`, cleared by sign-in or a 401), `RequireAuth` drops `?redirect=` when it's set, and `AuthProvider` no longer uses `useNavigate`. One redirect rule, in `RequireAuth`.
- **Sidebar persistence:** shadcn's `SidebarProvider` writes the `sidebar_state` cookie but never reads it (it expects a server to). `AppShell` reads it for `defaultOpen`.
- `TooltipProvider` sits in `AppShell` (the only tooltips are in the shell), not `App.tsx`.
- The crash fallback's button reads **Retry** (it reloads the page): `ErrorState`'s label is fixed, so it isn't a separate "Reload".
- Shared helpers: `lib/formErrors.ts` (`applyServerErrors`, usable by every later form) and `lib/roles.ts` (`ROLE_LABELS`).
- `--sidebar-primary` and `--sidebar-ring` now use the Saajha primary and ring colours (the shadcn default was blue in dark mode).
- Test setup: jsdom stubs for `matchMedia`, pointer capture and `scrollIntoView` (sidebar, Radix Select), and `toast.dismiss()` after each test (sonner's toast store is module-level). `src/test/renderApp.tsx` renders the app signed in as a given role.
- `vite build` warns that the main chunk is 679 kB (212 kB gzip). Route-level code splitting can come once there are more pages.

## Testing notes

- Roles: sign in with three accounts (ADMIN, MANAGER, MEMBER), or change your own `role` in the DB and reload (`/auth/me` re-reads it).
- Paging needs more than 20 employees. Create them with `POST /employees` as an admin via curl (they can't sign in, which doesn't matter for the list) and deactivate a few in the DB to test Include inactive.
- The invite email link uses the backend's `APP_BASE_URL`, which must be `http://localhost:5173`.

## Out of scope / follow-ups

- `/invites/accept` public page (next spec, invitations).
- Employee detail page, team column and `teamId` filter (with the teams feature).
- Pending-invite list, revoke, resend (needs `GET /invites` etc.; CLAUDE.md gap 1).
- Changing a role or deactivating an employee (no endpoint; CLAUDE.md gap 2).
- Name search (no API support).
- Light/dark theme toggle in the user menu.
- More sidebar items: Teams, Programs, Tasks, added to `navItems` by their own specs.
