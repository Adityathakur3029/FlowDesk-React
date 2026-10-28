# 06 — Teams and member editing (Teams page, create team, edit employee)

**Status:** Implemented (2026-10-18). Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `teams`
**Depends on:** [01-api-client-and-errors](./01-api-client-and-errors.md) (`apiClient`, `unwrap`, `ApiError`, `ERROR_MESSAGES`), [03-login](./03-login.md) (`useAuth`, `useHasRole`, `authKeys`), [04-app-layout-people](./04-app-layout-people.md) (AppShell, `navItems`, `PageHeader`, People page, `applyServerErrors`, `Pagination`)

> Numbering: 05 is reserved for the public `/invites/accept` page (spec 04, `paths.ts`).

## Goal

1. **Teams in the sidebar**, directly below People, for every role.
2. **Teams page (`/teams`)**: every active team, sorted by name, paginated. Each row shows the team name with its **member count** next to it, and the description below it. The name links to People filtered to that team.
3. **Create team** (ADMIN, MANAGER): a dialog with name, description and a **member picker**. You search people by name or email, and each pick becomes a removable chip (×) in a scrollable box, like adding recipients in Gmail.
4. **People page changes:**
   - a **Team** column (the team's name, or "No team"), and the **Team filter** spec 04 deferred (`teamId`);
   - an **Edit** button on each row. ADMIN can change name, role, active status and team. MANAGER can change the team only. MEMBERs don't see the button.

The backend added the two operations this needed, after we asked for them (2026-10-18): `q` search on `GET /employees` and `PATCH /employees/{id}`.

## Flow

```
Browser (ADMIN / MANAGER)                         FlowDesk API
  │ ── Create team ───────────────────────────────────│
  │ 1. type "jan" in the picker (debounced 250 ms)     │
  │    GET /employees?q=jan&limit=20                   │
  │───────────────────────────────────────────────────>│
  │ 2. 200 { data: Employee[] } best match first       │
  │<───────────────────────────────────────────────────│ suggestions → chips
  │ 3. submit  POST /teams { name, description? }      │
  │───────────────────────────────────────────────────>│
  │ 4. 201 { data: Team }  (empty team)                │
  │<───────────────────────────────────────────────────│
  │ 5. per chip, in parallel:                          │
  │    PUT /teams/{teamId}/members/{employeeId}        │
  │───────────────────────────────────────────────────>│ moves them out of any other team
  │ 6. 200 each (or 404/403 for some)                  │
  │<───────────────────────────────────────────────────│ toast; invalidate teams + employees
  │                                                    │
  │ ── Edit employee (People row) ─────────────────────│
  │ 7. PATCH /employees/{id} { changed fields only }   │  ADMIN only; skipped when nothing changed
  │───────────────────────────────────────────────────>│
  │ 8. then, if the team changed:                      │
  │    PUT /teams/{new}/members/{id}   or              │
  │    DELETE /teams/{old}/members/{id}  (→ No team)   │  ADMIN or MANAGER
  │───────────────────────────────────────────────────>│
```

The API has no "create team with members" call. `POST /teams` creates an empty team, and members are added one `PUT` at a time, so creating a team is **not atomic**. If some `PUT`s fail, the team still exists (see Create team, partial failure).

In the edit dialog, `PATCH` runs **before** the team change. Reactivating someone and moving them to a team in one save then works, because `PUT` needs an active employee.

## Environment variables

None new.

## Packages

| Package | Kind | Purpose |
|---|---|---|
| shadcn `command` (pulls in `cmdk`), `textarea` | **new**, source in `src/components/ui` | `npx shadcn add command textarea`. Command gives the picker's keyboard-navigable suggestion list (`shouldFilter={false}`, the server filters) |
| `react-hook-form`, `@hookform/resolvers`, `zod`, `sonner`, `lucide-react`, `@tanstack/react-query` | already installed | forms, schema, toasts, icons, queries |

## Folder layout (new and changed)

```
src/
  api/errors.ts                            CHANGED  + SELF_LOCKOUT, LAST_ADMIN codes and messages
  hooks/useDebouncedValue.ts               NEW      value that settles after N ms (picker search)
  components/
    ui/command.tsx, ui/textarea.tsx        NEW (shadcn)
    data/Pagination.tsx                    MOVED    from features/employees/components (now shared by People and Teams)
    layout/navItems.ts                     CHANGED  + Teams (below People)
  features/
    employees/
      index.ts                             NEW      public entry: employeeKeys, EmployeeMultiPicker
      types.ts                             CHANGED  + UpdateEmployeeRequest
      api.ts                               CHANGED  + useEmployeeSearch, useUpdateEmployee
      searchParams.ts                      CHANGED  + teamId (uuid | 'none')
      employeeSchema.ts                    NEW      zod schema for the edit form
      components/EmployeeTable.tsx         CHANGED  + Team column, + Edit action column
      components/EmployeeFilters.tsx       CHANGED  + Team select
      components/EditEmployeeDialog.tsx    NEW
      components/EmployeeMultiPicker.tsx   NEW      search + chips (Gmail-style), reusable for tasks/mentions later
      pages/PeoplePage.tsx                 CHANGED  passes team names and edit permissions down
    teams/
      index.ts                             NEW      public entry: teamKeys, useTeamDirectory, useSetEmployeeTeam
      types.ts                             NEW      Team, TeamList, TeamListParams, CreateTeamRequest aliases
      api.ts                               NEW      teamKeys, useTeams, useTeamDirectory, useCreateTeamWithMembers, useSetEmployeeTeam
      teamSchema.ts                        NEW      zod schema for the create form
      searchParams.ts                      NEW      ?offset
      components/TeamList.tsx              NEW
      components/CreateTeamDialog.tsx      NEW
      pages/TeamsPage.tsx                  NEW
  routes/
    paths.ts                               CHANGED  + teams: '/teams'
    router.tsx                             CHANGED  + /teams
```

Request flow as before: page/component → feature hook → `unwrap(apiClient.…)`.

**Cross-feature imports, only through `index.ts`:**
- `employees` → `@/features/teams`: `useTeamDirectory` (team names for the column, filter and edit dialog), `useSetEmployeeTeam` (team change in the edit dialog).
- `teams` → `@/features/employees`: `EmployeeMultiPicker`, `employeeKeys` (invalidated after membership changes).

Neither `index.ts` exports a page or anything that imports the other feature's index, so there's no import cycle. The router imports both pages by path, as it already does for `PeoplePage`. `EmployeeMultiPicker` takes team names as a prop instead of importing `teams` itself.

## Types

```ts
// features/teams/types.ts
export type Team = components['schemas']['Team']                  // includes memberCount
export type TeamList = components['schemas']['TeamListResponse']
export type TeamListParams = NonNullable<paths['/teams']['get']['parameters']['query']>
export type CreateTeamRequest = components['schemas']['CreateTeamRequest']

// features/employees/types.ts (added)
export type UpdateEmployeeRequest = components['schemas']['UpdateEmployeeRequest']
```

## Navigation

`navItems` becomes `[People (Users), Teams (UsersRound)]`. Teams has no `roles`, because every role can read teams. Only the Create button is role-gated.

## Error codes (`src/api/errors.ts`)

Add both to `BACKEND_ERROR_CODES` (they're in the contract's `ErrorResponse.code` list now) and to `ERROR_MESSAGES`:

| Code | Message |
|---|---|
| `SELF_LOCKOUT` | "You can't change your own role or deactivate yourself." |
| `LAST_ADMIN` | "There has to be at least one active admin. Make someone else an admin first." |

Already mapped and reused: `TEAM_NAME_EXISTS`, `FORBIDDEN`, `EMPLOYEE_EXISTS`.

## Teams data (`features/teams/api.ts`)

```ts
export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  list: (params: TeamListParams) => [...teamKeys.lists(), params] as const,
  directory: () => [...teamKeys.all, 'directory'] as const,
}

useTeams(params)            // GET /teams?limit=20&offset — the Teams page; keepPreviousData like People
useTeamDirectory()          // every active team: GET /teams?limit=100, following offset until meta.total.
                            // select → { teams: Team[], byId: Map<string, Team> }
useCreateTeamWithMembers()  // see Create team
useSetEmployeeTeam()        // { employeeId, fromTeamId, toTeamId } → PUT …/{toTeamId}/members/{id}
                            //   or, when toTeamId is null, DELETE …/{fromTeamId}/members/{id}
```

> **Why a directory query.** `Employee` only carries `teamId`. To show team names on People, the frontend needs id → name for every team. Teams are few (one per group in the org), so loading them all at 100 per page is cheap, and one cached query serves the People column, the Team filter, the edit dialog's Team select and the picker's "In Research" hint. An embedded team summary on `Employee` would make this unnecessary (Contract notes).

Every membership change and team creation invalidates `teamKeys.all` (member counts, directory) and `employeeKeys.all` (`teamId` changed).

## Teams page (`/teams`)

```
┌ PageHeader ──────────────────────────────────────────────────────┐
│ Teams                                           [ + Create team ] │
│ Groups of people who own programs.                                │
├ TeamList ────────────────────────────────────────────────────────┤
│ Design              3 members                                    │
│ Brand, product and web design                                    │
│──────────────────────────────────────────────────────────────────│
│ Research            1 member                                     │
│ User and market research                                         │
├ Pagination ──────────────────────────────────────────────────────┤
│ Showing 1–20 of 23                          [ Previous ] [ Next ] │
└──────────────────────────────────────────────────────────────────┘
```

- **URL:** only `offset` (integer ≥ 0, default 0, anything invalid → 0). `limit` is fixed at 20. There's no name search box, although `GET /teams` supports `q` (Out of scope).
- **Row:** a `<li>` in a bordered `divide-y` list. The team name is a `Link` to `/people?teamId={id}`. Next to it is a `Badge` (secondary) reading "1 member" or "{n} members" from `memberCount`. The description shows below in muted text, clamped to two lines, or nothing if it's null.
- **Create team** (`Plus` icon) only when `useHasRole(['ADMIN', 'MANAGER'])`.

| State | What renders |
|---|---|
| first load | 5 skeleton rows |
| success | the list + `Pagination` |
| empty (`meta.total === 0`) | `EmptyState` "No teams yet", with Create team as its action for ADMIN/MANAGER, and description "Ask an admin or manager to create one." for MEMBER |
| empty page past the end | `EmptyState` "This page is empty" + "Go to first page" |
| 500 / network | `ErrorState` "Couldn't load teams" + Retry |
| 401 | middleware ends the session |

`GET /teams` documents no 403 or 404.

## Create team dialog (`features/teams/components/CreateTeamDialog.tsx`)

### Form (`teamSchema.ts`)

Mirrors `CreateTeamRequest` for instant feedback only.

| Field | Control | zod rule | Message |
|---|---|---|---|
| `name` | `Input`, `maxLength` not set (zod reports it) | `z.string().trim().min(1).max(100)` | "Enter a team name." / "Use at most 100 characters." |
| `description` | `Textarea` (3 rows), optional | `z.string().max(2000)` | "Use at most 2,000 characters." |
| `members` | `EmployeeMultiPicker` | `z.array(employee)`, may be empty | — |

The body is `{ name }` plus `description` only when it isn't blank. A whitespace-only description is left out rather than sent, and `members` never goes in the `POST`.

### Member picker (`features/employees/components/EmployeeMultiPicker.tsx`)

```
Members
┌───────────────────────────────────────────────────────────┐
│ [Jane Doe ×] [Ravi Kumar ×] [Ana Janssen ×] [Benjamin…×]  │  ← chips wrap; box scrolls
│ [Priya Shah ×]  jan▌                                      │    past max-h-32 (≈4 lines)
└───────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────┐
  │ Janet King · janet.king@saajha.org          │  ← highlighted
  │ Benjamin Ojanen · ben.o@saajha.org  In Design│
  └─────────────────────────────────────────────┘
Adding someone who's already in a team moves them to this one.
```

- **Props:** `value: Employee[]`, `onChange`, `id`, `disabled`, `teamNames?: (teamId: string) => string | undefined`, `aria-describedby`.
- **Box:** one bordered, focusable-looking container (`focus-within` ring) holding the chips and a borderless text input that takes the remaining width. Clicking empty space in the box focuses the input. The box is `max-h-32 overflow-y-auto`, so a long list scrolls inside it and the dialog doesn't grow.
- **Chip:** a pill with the name, and the email as its `title`. Its × is a real `<button>` with `aria-label="Remove {name}"`. Removing a chip returns focus to the input.
- **Search:** the input value is debounced 250 ms (`useDebouncedValue`) and trimmed. When it's 1–100 characters, `useEmployeeSearch(q)` calls `GET /employees?q={q}&limit=20`. The input has `maxLength={100}`, so a 400 can't happen. The server's order (best match first) is kept. Already-picked people are hidden from the suggestions and at most 8 show (that's why it asks for 20). `keepPreviousData` keeps the list steady while the user types.
- **Suggestion row:** name, email (muted), and "In {team}" (`Badge` outline) when `teamId` is set and `teamNames` knows it.
- **List states** (shown only while the input has text and is focused):

  | State | Text |
  |---|---|
  | first fetch for this text | "Searching…" |
  | no results (or all already picked) | "No one matches “{q}”." |
  | error | "Couldn't search people. Try again." |

- **Keyboard** (shadcn `Command` with `shouldFilter={false}`, list rendered below the box, absolutely positioned and not portalled):
  - <kbd>↑</kbd>/<kbd>↓</kbd> move the highlight, and <kbd>Enter</kbd> picks it. <kbd>Enter</kbd> never submits the form from the picker.
  - <kbd>Backspace</kbd> in an empty input removes the last chip.
  - <kbd>Escape</kbd> clears the text and closes the list. It closes the dialog only when the list is already closed. The picker root carries `data-picker-open`, and `DialogContent`'s `onEscapeKeyDown` ignores Escape while it's open.
  - Picking clears the text and keeps focus in the input, so you can type the next name.
- **Accessibility:** the input is the combobox (`cmdk` sets `role="combobox"`, `aria-expanded`, `aria-activedescendant`), labelled by the "Members" `FieldLabel`. The chip list is a `<ul aria-label="Selected members">`.
- The hint "Adding someone who's already in a team moves them to this one." restates the `PUT` contract ("An employee is in at most one team, so this moves them"). The frontend doesn't decide anything here.

### Submit (`useCreateTeamWithMembers`)

```ts
mutationFn: async ({ body, members }) => {
  const team = (await unwrap(apiClient.POST('/teams', { body }))).data          // throws → nothing created
  const results = await Promise.allSettled(members.map((m) =>
    unwrap(apiClient.PUT('/teams/{teamId}/members/{employeeId}', { params: { path: { teamId: team.id, employeeId: m.id } } }))))
  const failed = members.flatMap((m, i) => results[i].status === 'rejected' ? [{ employee: m, error: results[i].reason }] : [])
  return { team, added: members.length - failed.length, failed }
}
onSettled: invalidate teamKeys.all + employeeKeys.all   // also after a partial failure
```

1. **Pending:** the button is disabled and reads "Creating team…". The dialog can't be closed (same rule as the invite dialog), and the fields and the picker are disabled.
2. **Success, all added:** close, reset, and toast `success('Team “{name}” created')` with description "{n} members added." (or "No members yet." when there were none).
3. **Partial failure** (team created, some `PUT`s failed): close and reset as well, since the team exists and resubmitting would give `TEAM_NAME_EXISTS`. Toast `warning('Team “{name}” created, but {k} of {n} people weren't added')` with the failed names in the description, plus "Add them from People with Edit." The list refreshes, so the counts show what really happened.
4. **`POST /teams` errors.** The dialog stays open and keeps the values:

| Response | Where | Text |
|---|---|---|
| 400 `Validation failed` | `details[].path` → `name` / `description`; the rest in a form `Alert` | server message |
| 409 `TEAM_NAME_EXISTS` | on **name** | "A team with this name already exists." |
| 403 `FORBIDDEN` | form `Alert` | "You don't have permission to do that." |
| 401 | middleware ends the session | — |
| 500 / network | form `Alert` | `getErrorMessage` |

Writes are never retried (`queryClient` default).

## People page changes

### Team column, filter and URL

- **Column** "Team", between Role and Joined. It shows the name from `useTeamDirectory().byId`, "No team" (muted) for `teamId: null`, a small `Skeleton` while the directory loads, and "Unknown team" if the id isn't in the directory, or the directory failed to load. The table's own states are unchanged: a failing directory never blocks the people list.
- **Filter:** a `Select` labelled "Team" with All teams, No team, then every team by name. If the URL holds an id that isn't in the directory, the select shows an extra "Unknown team" item so the value stays visible. Picking a team resets `offset`.
- **URL:** `teamId` = a UUID or `none`. `parseEmployeeSearch` accepts only those two shapes (anything else is dropped, so it can't cause a 400) and sends it as `teamId`. "Clear filters" clears it too. The Teams page links here with `?teamId={id}`.

### Edit action

- An **Edit** column with a ghost icon `Button` (`Pencil`) per row, `aria-label="Edit {name}"`. It's rendered when `useHasRole(['ADMIN', 'MANAGER'])`. For MEMBERs the column isn't there at all.
- It opens `EditEmployeeDialog` for that row's employee.

### Edit dialog (`EditEmployeeDialog.tsx`)

Title "Edit {name}", description `{emailId}` (the email isn't editable, because it's bound to the Google account).

| Field | Control | Who can change it | zod rule |
|---|---|---|---|
| `name` | `Input` | ADMIN | `z.string().trim().min(1, 'Enter a name.').max(150, 'Use at most 150 characters.')` |
| `role` | `Select` Member / Manager / Admin | ADMIN, not on their own row | `z.enum([...])` |
| `isActive` | `Switch` "Active", hint "Inactive people can't sign in and are hidden from lists." | ADMIN, not on their own row | `z.boolean()` |
| `teamId` | `Select` No team + directory teams | ADMIN, MANAGER, and only while the form's `isActive` is true | `z.string().nullable()` |

Disabled fields still show their current value, with one hint line each:
- MANAGER: name, role and active show "Only admins can change this."
- Own row (ADMIN): role and active show "You can't change your own role or deactivate yourself." This is a UX hint, like hiding buttons: the backend's 409 `SELF_LOCKOUT` is still handled.
- Inactive (form value): team shows "Reactivate them to change their team." (`PUT` documents 404 for a non-active employee.)
- Directory loading or failed: team is disabled with "Loading teams…" or "Couldn't load teams."

**Save** ("Save changes", "Saving…" while pending; disabled while nothing differs from the employee as last saved):
1. `patch` = the changed fields among `name` (trimmed), `role` and `isActive`. If it's non-empty, `PATCH /employees/{id}` with it (`useUpdateEmployee`). Only an ADMIN can produce a non-empty patch, because the other fields are disabled for MANAGER.
2. If `teamId` changed: `useSetEmployeeTeam` (`PUT` to the new team, or `DELETE` from the old one when "No team" is picked).
3. **Success:** close, toast `success('Saved changes to {name}')`, invalidate `employeeKeys.all` and `teamKeys.all`. When it's the signed-in employee's own row, also invalidate `authKeys.me()`, so the user menu shows the new name.
4. **The PATCH succeeded but the team change failed:** stay open. The saved values become the dialog's new baseline, so a retry only resends the team. An alert reads "Saved {name}'s details, but their team couldn't be changed: {getErrorMessage}". Invalidate as in 3.
5. **Errors** (the dialog stays open and keeps the values):

| Response | Where | Text |
|---|---|---|
| `PATCH` 400 `Validation failed` | `details[].path` → `name` / `role` / `isActive`; the rest in a form `Alert` | server message |
| `PATCH` 409 `SELF_LOCKOUT` | form `Alert` | mapped message |
| `PATCH` 409 `LAST_ADMIN` | form `Alert` | mapped message |
| `PATCH` or membership 403 `FORBIDDEN` | form `Alert` | "You don't have permission to do that." |
| `PATCH` 404 | form `Alert` + invalidate the people list | server message ("Employee not found") |
| membership 404 (team deleted, or the employee isn't active) | form `Alert` + invalidate teams and people | server message |
| 401 | middleware ends the session | — |
| 500 / network | form `Alert` | `getErrorMessage` |

The pending, close and reset rules are the same as the invite dialog's.

> **Consequences to know.** Deactivating someone signs them out on their next request (401) and hides them from team member lists and `memberCount`. They keep their `teamId`, so the Team column still shows it (with the "Inactive" badge) when "Include inactive" is on. A role change applies on the person's next request, with no sign-in needed. If an admin demotes another admin, that admin's UI updates when their `/auth/me` is next fetched (on reload). A 403 is handled everywhere in between.

## Employees data additions (`features/employees/api.ts`)

```ts
useEmployeeSearch(q: string)   // enabled when q !== ''; queryKey employeeKeys.list({ q, limit: 20 });
                               // keepPreviousData; staleTime default (30 s)
useUpdateEmployee()            // useMutation<Employee, ApiError, { id, body: UpdateEmployeeRequest }>
                               //   PATCH /employees/{id} → data
```

## Tests (Vitest + MSW + RTL)

| File | Case | Expected |
|---|---|---|
| `features/teams/teams.test.tsx` | 200 with two teams | names, "3 members" / "1 member", description; name links to `/people?teamId=…` |
| | as MEMBER / MANAGER / ADMIN | Create team absent / present / present |
| | `meta.total: 0` | "No teams yet" (+ action for MANAGER) |
| | 500 → Retry → 200 | "Couldn't load teams", then the list |
| | create with no members | `POST /teams` body `{ name: 'Design' }` (trimmed, no blank description); toast; list refetched |
| | create with 2 picked members | POST then 2 `PUT`s with the new team id; toast "2 members added." |
| | one `PUT` 404 | warning toast naming the person; dialog closed |
| | 409 `TEAM_NAME_EXISTS` | message under Name; dialog open |
| | 400 `details: [{ path: 'name' }]` / 403 | on the field / form alert |
| `features/employees/picker.test.tsx` | type "ja" | one request `q=ja&limit=20` after the debounce; suggestions show "In Design" for a member of Design |
| | pick with click and with ↓ + Enter | chip appears; text cleared; Enter didn't submit the form |
| | picked person | not in the suggestions any more |
| | × on a chip / Backspace in empty input | chip removed |
| | 200 `data: []` / 500 | "No one matches “ja”." / "Couldn't search people. Try again." |
| `features/employees/people.test.tsx` (extended) | rows with `teamId` | team name in the Team column; "No team" for null |
| | `?teamId=none` / team select | request has `teamId=none` / URL has `teamId=<id>` and no offset |
| | as MEMBER / MANAGER / ADMIN | Edit buttons absent / present / present |
| | ADMIN edits name + role | `PATCH` body only `{ name, role }`; toast; list refetched |
| | ADMIN changes team only | no `PATCH`; `PUT /teams/{new}/members/{id}` |
| | team → No team | `DELETE /teams/{old}/members/{id}` |
| | MANAGER | name, role and active disabled with the hint; team enabled |
| | own row as ADMIN | role and active disabled |
| | `PATCH` 409 `LAST_ADMIN` / `SELF_LOCKOUT` | mapped alert; dialog open |
| | `PATCH` 200, `PUT` 404 | "Saved …, but their team couldn't be changed" alert; retry sends only the `PUT` |
| `features/employees/searchParams.test.ts` | `teamId=none`, a UUID, `teamId=abc` | kept, kept, dropped |

## Contract notes

Checked 2026-10-18 after the backend update: `npm run api:types` picks up `q` on `GET /employees`, `PATCH /employees/{id}`, `UpdateEmployeeRequest`, the `SELF_LOCKOUT` and `LAST_ADMIN` codes, and `EMPLOYEE_EXISTS` on the `POST /employees` 409. CLAUDE.md gaps 2 and 4 are closed. Still open, nothing blocking:

1. **No team summary on `Employee`.** The frontend loads every team to turn `teamId` into a name. Fine at today's scale. A `team: { id, name } | null` on `Employee` would remove the directory query.
2. **Creating a team with members isn't atomic** (one `POST`, then one `PUT` per member). The UI reports a partial failure instead of hiding it. A `memberIds` field on `CreateTeamRequest` would make it one transaction.
3. **No bulk membership change.** Moving 10 people means 10 `PUT`s.

## Acceptance checklist

- [x] `npm run api:types` re-run; `features/*/types.ts` only alias generated types
- [ ] Sidebar shows Teams below People for every role; active state follows the URL
- [ ] `/teams` lists active teams by name with correct member counts; paging works; a name opens People filtered to that team
- [ ] As MEMBER: no Create team, no Edit. As MANAGER: both, with only Team editable. As ADMIN: everything
- [ ] Create team: search finds people by name and email; chips add and remove (×, Backspace); the box scrolls past ~4 lines; Enter in the picker never submits; Escape closes the list before the dialog
- [ ] Create with members → team appears with the right count; a moved member's old team count drops
- [ ] Duplicate name (any case) → `TEAM_NAME_EXISTS` under Name
- [ ] People: Team column and filter (`All`, `No team`, each team) match `GET /employees?teamId=…`
- [ ] Edit as ADMIN: rename, change role, deactivate and reactivate (with Include inactive), change team and clear it; each reflected in the list
- [ ] Own row: role and active disabled; renaming yourself updates the user menu
- [ ] Demote the last admin (via another path) → `LAST_ADMIN` alert
- [ ] 403 handled: demote the signed-in manager in the DB, then create a team or change a team → `FORBIDDEN` alert
- [ ] Keyboard and 375 px checks for the Teams page, both dialogs and the picker
- [x] CLAUDE.md updated: role matrix (edit employee = ADMIN), contract facts and gaps, `components/data/`
- [x] `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` pass

## Verified

**Automated (Vitest + MSW, contract-shaped bodies): 129/129 tests pass across the repo, in two consecutive runs.** New:
- `teams.test.tsx` (16): list with counts, descriptions and `/people?teamId=` links, and Teams `aria-current="page"`; Create team per role; empty state for MEMBER; 500 → Retry. Create without members sends `{ name: 'Platform' }` (trimmed, blank description left out). Create with two picked members (the search request is exactly `q=ra&limit=20`, the "In Design" hint shows) does the POST and then both PUTs. A partial failure gives the warning toast naming the person and closes the dialog. `TEAM_NAME_EXISTS` shows under Name. 400 `details` and 403 show in the dialog. Picker: ↓/↑/Enter picks without submitting the form, focus stays in the input, a picked person isn't suggested again, × and Backspace remove chips, Escape closes the list before the dialog, and a search 500 shows the error text.
- `editEmployee.test.tsx` (10): Team column names and "No team"; no Edit for MEMBER. ADMIN's PATCH carries only the changed fields (`{ name: 'Ravi K', role: 'MANAGER' }`). A team-only change is just a PUT, and "No team" is a DELETE from the old team. MANAGER gets name, role and active disabled with only the team enabled. On their own row an ADMIN can rename but not change role or status. Switching someone inactive locks the team. `LAST_ADMIN` and `SELF_LOCKOUT` show as alerts. PATCH 200 followed by PUT 404 shows the "Saved …, but…" alert, and the retry sends only the PUT.
- `people.test.tsx` (+1): `?teamId=none&offset=20` sends `teamId=none&limit=20&offset=20`, and picking a team writes `?teamId=<id>` without the offset.
- `searchParams.test.ts` (+5): `teamId` accepts `none` or a UUID and drops anything else, and round-trips into the URL and the API params.

**Against the running backend (curl, 2026-10-18):** `npm run api:types` picked up `q`, `PATCH /employees/{id}`, `UpdateEmployeeRequest` and the new codes. The contract has 37 operations. With `Bearer abc`, `GET /teams`, `GET /employees?q=ja`, `PATCH /employees/{id}`, `POST /teams` and `PUT /teams/{id}/members/{id}` all return 401 `INVALID_AUTH_TOKEN` (the session-end path). CORS preflights from `http://localhost:5173` for `PATCH`, `PUT`, `DELETE` and `POST` with `authorization, content-type` return 204 and allow the methods.

**Still to do by hand** (unticked items above): everything that needs a signed-in session against real data: counts after create and move, the real search order, edit flows per role, `LAST_ADMIN` and 403 after demotion, keyboard and 375 px checks.

## Implementation notes

- **`FormErrorAlert`** (`components/feedback/`): the form-level alert from the invite dialog, now shared by all three dialogs. `InviteMemberDialog` uses it too, with no behaviour change.
- **Picker labelling:** cmdk assigns the input its own id, so a `<label htmlFor>` can't target it. The input gets its accessible name from cmdk's `label` prop ("Members"), and the visible text is a shadcn `FieldTitle`.
- **Picker root** is cmdk's own `Command` primitive, not shadcn's `Command` wrapper, whose popover-card styles don't fit an inline field. The suggestion list uses shadcn's `CommandList` and `CommandItem`.
- **Picker tests** live in `teams.test.tsx` rather than a separate `picker.test.tsx`: the Create team dialog is the picker's only host today, and testing it there also covers the Escape interplay with the dialog.
- **Edit dialog pending state** is react-hook-form's `isSubmitting`, which covers the whole PATCH → PUT sequence, rather than either mutation's `isPending`.
- **Tests:** `src/test/server.ts` now has one initial handler, an empty `GET /teams`, because every People render loads the team directory. Tests that need teams override it with `server.use`. `setup.ts` stubs `ResizeObserver` (cmdk) and raises Testing Library's async timeout to 3 s, because the first full-app render in a file took over a second with 14 files in parallel. The spec-03 "token expires" test now uses a 1 s token instead of 0.3 s, which was racing the first People render.
- `npx shadcn add command textarea` also added `ui/input-group.tsx` (a dependency of `command.tsx`) and asked to overwrite `dialog.tsx`, which was declined, so the existing dialog is unchanged.

## Out of scope / follow-ups

- Team detail page, rename or edit team (`PATCH /teams/{id}`), delete team (`DELETE`, ADMIN; `TEAM_OWNS_PROGRAMS`), and member list per team (`GET /teams/{id}/members`).
- Team name search on the Teams page (`GET /teams?q=` exists).
- Name search box on People (`q` now exists; it would change the list order, so it needs its own design).
- Reusing `EmployeeMultiPicker` (or a single-select variant) for task assignees and @mentions, with their own specs.
- `/invites/accept` (spec 05).
