# 07 — Programs (Programs page, create program, program page with comments)

**Status:** Implemented (2026-10-19), extended the same day with program dates and the program page. Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `programs`
**Depends on:** [01-api-client-and-errors](./01-api-client-and-errors.md) (`apiClient`, `unwrap`, `ApiError`, `ERROR_MESSAGES`), [03-login](./03-login.md) (`useAuth`, `useHasRole`), [04-app-layout-people](./04-app-layout-people.md) (AppShell, `navItems`, `PageHeader`, `applyServerErrors`, `Pagination`), [06-teams-and-member-editing](./06-teams-and-member-editing.md) (`useTeamDirectory`, `teamKeys`, `FormErrorAlert`, the create-dialog pattern)

## Goal

1. **Programs at the top of the sidebar** (above People and Teams), for every role.
2. **Programs page (`/programs`)**: every active program, newest first, paginated. Each row shows the program's **key**, name (a link to the program page) and description, **status**, **owner team**, **start/end dates** and created date.
3. **Create program** (ADMIN, MANAGER): one dialog that collects everything `POST /programs` needs and fills in sensible defaults, so the user can create a program without knowing the API rules:
   - **Name** (required).
   - **Key** (required), suggested from the name as you type (Jira-style: "Marketing Research" → `MR`), uppercased as you type, with a live preview of the task keys it produces (`MR-1, MR-2…`) and a warning that it can't be changed later.
   - **Owner team** (required), picked from every active team and preselected with the signed-in user's own team.
   - **Status**, defaulting to Planned.
   - **Start date** and **End date** (optional).
   - **Description** (optional).
4. **Program page (`/programs/:programId`)**: the program's details, its **program-level comments** (read, add, reply) and an **Analytics & reports** section that says "Coming soon".

The contract already has every operation this needs. Nothing is blocked on the backend.

## Flow

```
Browser (ADMIN / MANAGER)                         FlowDesk API
  │ 1. open /programs                                  │
  │    GET /programs?limit=20&offset=0                 │
  │    GET /teams?limit=100 (team directory, cached)   │
  │───────────────────────────────────────────────────>│
  │ 2. 200 { data: Program[], meta }  newest first     │
  │    200 { data: Team[], meta }                      │
  │<───────────────────────────────────────────────────│ owner team ids → names
  │ 3. "Create program" → dialog                       │
  │    type name "Marketing Research"                  │ key field fills with "MR" (frontend only)
  │    owner team preselected = my team                │
  │ 4. submit                                          │
  │    POST /programs { ownerTeamId, key, name,        │
  │                     status, description? }         │
  │───────────────────────────────────────────────────>│ trims + uppercases key, checks team, key unique
  │ 5. 201 { data: Program }                           │
  │<───────────────────────────────────────────────────│ toast; invalidate programs; go to page 1
  │    or 409 PROGRAM_KEY_EXISTS → error on Key        │
  │    or 400 OWNER_TEAM_NOT_FOUND → error on Owner    │
  │       team, refetch the team directory             │
```

Creating a program is one `POST`, so unlike creating a team it's atomic: either the program exists or nothing changed.

The key suggestion is a typing convenience, not a rule. The server still trims, uppercases and validates the key, and the zod schema only mirrors the contract's documented pattern.

## Environment variables

None new.

## Packages

| Package | Kind | Purpose |
|---|---|---|
| shadcn `dialog`, `select`, `input`, `textarea`, `field`, `badge`, `table`, `skeleton` | already in `src/components/ui` | dialog, owner team and status selects, list |
| `react-hook-form`, `@hookform/resolvers`, `zod`, `sonner`, `lucide-react`, `@tanstack/react-query` | already installed | forms, schema, toasts, icons, queries |

No new packages or shadcn components.

## Folder layout (new and changed)

```
src/
  api/schema.d.ts                            REGENERATED  Program/CreateProgramRequest/UpdateProgramRequest + startDate, endDate
  api/errors.ts                              CHANGED  PROGRAM_KEY_EXISTS message mentions deleted programs
  components/layout/navItems.ts              CHANGED  + Programs (FolderKanban), first
  components/layout/UserMenu.tsx             CHANGED  initials() moved to lib/initials.ts
  lib/initials.ts                            NEW      initials(name), shared by UserMenu and comments
  features/
    programs/
      types.ts                               NEW      Program, ProgramStatus, ProgramList, ProgramListParams, CreateProgramRequest aliases
      api.ts                                 NEW      programKeys, usePrograms, useProgram, useCreateProgram
      programStatus.ts                       NEW      PROGRAM_STATUSES (contract order), PROGRAM_STATUS_LABELS, badge variant per status
      programDates.ts                        NEW      formatProgramDate, formatProgramDates (calendar dates, formatted in UTC)
      programKey.ts                          NEW      suggestProgramKey(name)
      programKey.test.ts                     NEW
      programSchema.ts                       NEW      zod schema for the create form
      searchParams.ts                        NEW      ?offset
      components/ProgramStatusBadge.tsx      NEW
      components/OwnerTeamName.tsx           NEW      owner team name / "No owner team" / "Unknown team" (table and program page)
      components/ProgramTable.tsx            NEW
      components/CreateProgramDialog.tsx     NEW
      pages/ProgramsPage.tsx                 NEW
      pages/ProgramPage.tsx                  NEW      /programs/:programId
      programs.test.tsx                      NEW
      programPage.test.tsx                   NEW
    comments/
      types.ts                               NEW      Comment, CommentReply, CommentList, CreateCommentRequest, EmployeeSummary aliases
      api.ts                                 NEW      commentKeys, useProgramComments (infinite), useCreateProgramComment
      commentSchema.ts                       NEW      zod schema for the comment box
      commentBody.ts                         NEW      parseCommentBody(): text and mention tokens
      commentBody.test.ts                    NEW
      components/CommentBody.tsx             NEW      plain text + "@Name" mentions
      components/CommentItem.tsx             NEW      one comment, reply or tombstone
      components/CommentForm.tsx             NEW      new comment or reply
      components/CommentThread.tsx           NEW      comment + replies + inline reply form
      components/ProgramComments.tsx         NEW      the program page's Comments section
      index.ts                               NEW      ProgramComments
      programComments.test.tsx               NEW
  routes/
    paths.ts                                 CHANGED  + programs, program ('/programs/:programId'), programPath(id)
    router.tsx                               CHANGED  + /programs, /programs/:programId
  test/setup.ts, vite.config.ts              CHANGED  asyncUtilTimeout 5 s, testTimeout 15 s (see Testing notes)
```

Request flow as before: page/component → feature hook (`features/programs/api.ts`, `features/comments/api.ts`) → `unwrap(apiClient.…)`.

**Cross-feature imports, only through `index.ts`:** `programs` → `@/features/teams` for `useTeamDirectory` (owner team names, the Owner team select) and `teamKeys` (refetched after `OWNER_TEAM_NOT_FOUND`); `programs` → `@/features/comments` for `ProgramComments`. `comments` imports no feature, and nothing imports `programs`, so there's no cycle and **no `programs/index.ts`** yet. The tasks spec adds one when it needs `programKeys` or `ProgramStatusBadge`. The router imports `ProgramsPage` and `ProgramPage` by path.

## Types

```ts
// features/programs/types.ts
export type Program = components['schemas']['Program']
export type ProgramStatus = components['schemas']['ProgramStatus']
export type ProgramList = components['schemas']['ProgramListResponse']
export type ProgramListParams = NonNullable<paths['/programs']['get']['parameters']['query']>
export type CreateProgramRequest = components['schemas']['CreateProgramRequest']
```

## Status display (`programStatus.ts`, `ProgramStatusBadge.tsx`)

Display only. The contract says any status can move to any other, so the frontend has no transition rules.

| `ProgramStatus` | Label | `Badge` variant |
|---|---|---|
| `PLANNED` | Planned | `outline` |
| `ACTIVE` | Active | `default` |
| `ON_HOLD` | On hold | `secondary` |
| `COMPLETED` | Completed | `secondary` |
| `CANCELLED` | Cancelled | `destructive` |

`PROGRAM_STATUSES` keeps the contract's enum order (Planned, Active, On hold, Completed, Cancelled), which is also the order in the Status select. The label is always shown, so colour is never the only signal.

## Navigation

`navItems` becomes `[Programs (FolderKanban), People (Users), Teams (UsersRound)]`: Programs comes first. Programs has no `roles`, because every role can read programs. Only the Create button is role-gated. The sidebar marks Programs active on `/programs` and on every program page (it matches the item's path or anything under it). `/` still redirects to People (Out of scope).

## Error codes (`src/api/errors.ts`)

Both codes are already in `BACKEND_ERROR_CODES` and `ERROR_MESSAGES`. One message changes:

| Code | Message now | Message after |
|---|---|---|
| `PROGRAM_KEY_EXISTS` | "A program with this key already exists." | "Another program already uses this key. Keys of deleted programs stay taken too, so pick a different one." |
| `OWNER_TEAM_NOT_FOUND` | "The owner team doesn't exist or has been deleted." | unchanged |

> **Why change it.** The contract says a key "stays taken after the program is soft-deleted", and deleted programs aren't listed. Without the extra sentence, a user who searches the list for the key and doesn't find it has no idea why it's taken.

## Programs data (`features/programs/api.ts`)

```ts
export const programKeys = {
  all: ['programs'] as const,
  lists: () => [...programKeys.all, 'list'] as const,
  list: (params: ProgramListParams) => [...programKeys.lists(), params] as const,
  detail: (programId: string) => [...programKeys.all, 'detail', programId] as const,
}

usePrograms(params)   // GET /programs?limit=20&offset — the Programs page; placeholderData: keepPreviousData
useProgram(id)        // GET /programs/{programId} → data — the program page
useCreateProgram()    // useMutation<Program, ApiError, CreateProgramRequest>
                      //   POST /programs → data
                      //   onSuccess: invalidate programKeys.all
                      //   onError: if OWNER_TEAM_NOT_FOUND, invalidate teamKeys.all (the picked team is gone)
```

Owner team names come from the existing `useTeamDirectory()` (spec 06). `Program`, like `Employee`, only carries the team's id (Contract notes).

## Programs page (`/programs`)

```
┌ PageHeader ─────────────────────────────────────────────────────────────────┐
│ Programs                                                 [ + Create program ] │
│ Each program groups related tasks and is owned by a team.                    │
├ ProgramTable ───────────────────────────────────────────────────────────────┤
│ Key    Name                   Status     Owner team  Dates                Created      │
│ [MKT]  Marketing Research     (Active)   Research    1 Oct – 31 Dec 2026  17 Oct 2026  │
│        Q4 market research…                                                         │
│ [HIR]  Hiring Drive           (Planned)  People Ops  Not set              15 Oct 2026  │
├ Pagination ─────────────────────────────────────────────────────────────────┤
│ Showing 1–20 of 23                                     [ Previous ] [ Next ]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **URL:** only `offset` (integer ≥ 0, default 0, anything invalid → 0), parsed like `features/teams/searchParams.ts`. `limit` is fixed at 20. No filters or search yet, although `GET /programs` supports `status`, `ownerTeamId` and `q` (Out of scope).
- **Table** (shadcn `Table` in an `overflow-x-auto rounded-lg border` wrapper, like `EmployeeTable`, so narrow screens scroll the table and never the page):

  | Column | Content |
  |---|---|
  | Key | `Badge variant="outline"` with `font-mono`, e.g. `MKT` |
  | Name | name (`font-medium`) as a `Link` to `/programs/{id}`; description below in muted `text-sm`, `line-clamp-2`, `max-w-md`; nothing when it's null |
  | Status | `ProgramStatusBadge` |
  | Owner team | `OwnerTeamName`: team name from `useTeamDirectory().byId`; "No owner team" (muted) when `ownerTeamId` is null (programs created before teams existed, per the contract); a small `Skeleton` while the directory loads; "Unknown team" (muted) if the id isn't in the directory or the directory failed. A failing directory never blocks the list |
  | Dates | `formatProgramDates()`: both → `formatRange` ("1 Oct – 31 Dec 2026"); only start → "From 1 Oct 2026"; only end → "Until 31 Dec 2026"; neither → "Not set" (muted). `whitespace-nowrap` |
  | Created | `createdAt`, `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })`, `whitespace-nowrap` |

- **Dates are calendar dates** (`YYYY-MM-DD`, `format: date`). `new Date('2026-10-01')` is UTC midnight, so `programDates.ts` formats with `timeZone: 'UTC'`; in the viewer's zone the date would show a day early anywhere west of UTC.
- The program **name** links to its page. The rest of the row isn't clickable, so the link stays a single, normal tab stop.
- **Create program** (`Plus` icon) in the header only when `useHasRole(['ADMIN', 'MANAGER'])`.

| State | What renders |
|---|---|
| first load | 5 skeleton rows (6 cells each) |
| success | the table + `Pagination` |
| next page loading | the current page stays, dimmed (`aria-busy`), Pagination disabled |
| empty (`meta.total === 0`) | `EmptyState` "No programs yet", with Create program as its action for ADMIN/MANAGER, and description "Ask an admin or manager to create one." for MEMBER |
| empty page past the end | `EmptyState` "This page is empty" + "Go to first page" |
| 500 / network | `ErrorState` "Couldn't load programs" + Retry |
| 401 | middleware ends the session |

`GET /programs` documents 400 for bad query values. The page only ever sends `limit=20` and a non-negative integer `offset`, so it can't happen. It documents no 403 or 404.

## Create program dialog (`features/programs/components/CreateProgramDialog.tsx`)

```
┌ Create a program ──────────────────────────────────────────┐
│ Programs group related tasks. Each one is owned by a team.  │
│                                                             │
│ Name                                                        │
│ [ Marketing Research                                    ]   │
│                                                             │
│ Key                                                         │
│ [ MR        ]                                               │
│ Tasks will be numbered MR-1, MR-2… The key can't be         │
│ changed later.                                              │
│                                                             │
│ Owner team                         Status                   │
│ [ Research            ▾ ]          [ Planned          ▾ ]   │
│ Owner team is for information;                              │
│ anyone can work on the program.                             │
│                                                             │
│ Start date (optional)              End date (optional)      │
│ [ 01/10/2026        📅 ]           [ 31/12/2026       📅 ]   │
│                                                             │
│ Description (optional)                                      │
│ [                                                       ]   │
│ [                                                       ]   │
│                                                             │
│                              [ Cancel ] [ + Create program ] │
└─────────────────────────────────────────────────────────────┘
```

`DialogContent` is `sm:max-w-lg`. Owner team and Status, and Start date and End date, sit side by side from `sm` up and stack below it. Title "Create a program", description "Programs group related tasks. Each one is owned by a team."

### Form (`programSchema.ts`)

Mirrors `CreateProgramRequest` for instant feedback only; the server's `details` win.

| Field | Control | Default | zod rule | Messages |
|---|---|---|---|---|
| `name` | `Input`, placeholder "Marketing Research" | `''` | `z.string().trim().min(1).max(150)` | "Enter a program name." / "Use at most 150 characters." |
| `key` | `Input`, `autoComplete="off"`, `spellCheck={false}`, `className="font-mono uppercase"`, placeholder "MKT"; `onChange` stores `value.toUpperCase()` | suggested from name | `z.string().trim().toUpperCase().min(1).regex(/^[A-Z][A-Z0-9]{1,9}$/)` | "Enter a key." / "Use 2–10 letters or digits, starting with a letter." |
| `ownerTeamId` | `Select`, placeholder "Pick a team" | the signed-in employee's `teamId`, if it's in the directory; else `''` | `z.string().min(1)` | "Pick the team that owns this program." |
| `status` | `Select` with `PROGRAM_STATUSES` and their labels | `'PLANNED'` | `z.enum(PROGRAM_STATUSES)` | — |
| `startDate` | `Input type="date"`, label "Start date (optional)" | `''` | `z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/)` | "Enter a valid date." |
| `endDate` | `Input type="date"`, label "End date (optional)" | `''` | same | "Enter a valid date." |
| `description` | `Textarea`, 4 rows, placeholder "What the program is for" | `''` | `z.string().max(10000)` | "Use at most 10,000 characters." |

No `maxLength` attributes on the inputs, as in the team dialog: zod reports the limit instead of silently cutting the text off.

**No client-side date-range check.** "End on or after start" is a backend date rule (CLAUDE.md §1), so the form doesn't repeat it; the server answers `INVALID_DATE_RANGE` and the dialog shows it under End date. Past dates are allowed (contract). A native date input holds either `''` or a full `YYYY-MM-DD`, so the zod rule only mirrors the format.

**Body:** `{ ownerTeamId, key, name, status }`, plus `startDate` / `endDate` only when set, and `description` only when it isn't blank (a whitespace-only description is left out, as for teams). Blank dates are omitted rather than sent as `null`; both mean "not set" on create. `status` is always sent, even when it's the contract's default `PLANNED`, so what the user saw in the select is what's stored.

### Key suggestion (`programKey.ts`)

`suggestProgramKey(name: string): string`:

1. Uppercase the name and split it into words on anything that isn't `A–Z` or `0–9`. Drop empty words.
2. Two or more words → the first character of each word. One word → its first 3 characters. No words → `''`.
3. Drop leading digits (a key starts with a letter), then keep the first 10 characters.
4. If fewer than 2 characters are left, return `''` (no suggestion; the user types a key).

| Name | Suggestion |
|---|---|
| Marketing Research | `MR` |
| Q4 Market Research | `QMR` |
| Onboarding | `ONB` |
| 2026 Hiring Drive | `HD` (`2HD` → leading digit dropped) |
| Design-System v2 | `DSV` |
| A | `''` |
| नई पहल (no ASCII letters) | `''` |

**When it fills the field:** on every change to `name`, if the key field is empty **or** still equals the previous suggestion, set it to the new suggestion (`setValue('key', …, { shouldValidate: isSubmitted })`). Once the user types their own key, the name no longer touches it. If they clear the key, suggestions resume. No "touched" flag is needed: "empty or equal to the last suggestion" is the whole rule.

**Key hint** (`FieldDescription`, `id="program-key-hint"`, referenced by the input's `aria-describedby` together with the error):
- when the current value matches the pattern: "Tasks will be numbered {KEY}-1, {KEY}-2… The key can't be changed later."
- otherwise: "2–10 letters or digits, starting with a letter. It can't be changed later."

> **Why warn about immutability.** `key` is immutable (`PATCH /programs/{id}` rejects it with 400) and stays taken after the program is deleted, so a typo is permanent. The preview makes the consequence concrete before submit.

### Owner team select

Options are `useTeamDirectory().data.teams` in the server's order (by name). Hint (`FieldDescription`): "The owner team is for information; anyone can work on the program." (restates the contract: "informational for now and doesn't restrict who can work on the program").

| Directory state | Select | Hint instead of the default |
|---|---|---|
| loading | disabled, placeholder "Loading teams…" | — |
| error | disabled | "Couldn't load teams." + a link-style `Button` "Try again" (`directory.refetch()`) |
| loaded, no teams | disabled | "There are no teams yet. A program needs an owner team, so [create a team](/teams) first." The link closes the dialog and goes to Teams. Both roles that see this dialog can create teams |
| loaded | enabled | default hint |

**Default:** when the dialog opens (and after each reset), if `employee.teamId` (from `useAuth`) is in the directory, preselect it. If the directory loads after the dialog opened, apply the same default as long as the user hasn't picked a team yet. Otherwise the select starts empty with "Pick a team".

### Submit (`useCreateProgram`)

1. **Pending:** the button is disabled and reads "Creating program…" with a spinner. Fields are disabled, and the dialog can't be closed (Escape, overlay, Cancel), the same rule as the invite and team dialogs.
2. **Success:** close, reset, and toast `success('Program “{name}” created')` with description "Its tasks will be numbered {key}-1, {key}-2…". `name` and `key` come from the **response** (the server's trimmed, uppercased values). `programKeys.all` is invalidated. If the page is past the first page, navigate to offset 0, because the list is newest first and the new program is the first row there. The page passes this in as `onCreated`.
3. **Errors.** The dialog stays open and keeps the values:

| Response | Where | Text |
|---|---|---|
| 400 `Validation failed` | `details[].path` → `name` / `key` / `ownerTeamId` / `status` / `startDate` / `endDate` / `description` via `applyServerErrors`; the rest in a `FormErrorAlert` | server message |
| 400 `OWNER_TEAM_NOT_FOUND` | clear `ownerTeamId`, then the error on **Owner team** (focused); the team directory refetches (see `useCreateProgram`), so the deleted team leaves the list | "The owner team doesn't exist or has been deleted." |
| 400 `INVALID_DATE_RANGE` | on **End date** (focused) | "The end date must be on or after the start date." (the dialog's own text: the shared `ERROR_MESSAGES` entry says "due date", which is the task wording) |
| 409 `PROGRAM_KEY_EXISTS` | on **Key** (focused) | the new message above |
| 403 `FORBIDDEN` | `FormErrorAlert` | "You don't have permission to do that." |
| 401 | middleware ends the session | — |
| 500 / network | `FormErrorAlert` | `getErrorMessage` |

Check `OWNER_TEAM_NOT_FOUND`, `PROGRAM_KEY_EXISTS` and `INVALID_DATE_RANGE` with `hasErrorCode` **before** `applyServerErrors`, as the team dialog does for `TEAM_NAME_EXISTS`. Without that, these coded errors have no `fieldErrors` and would land in the form alert.

Writes are never retried (`queryClient` default).

> **Consequence to know.** A team can't be deleted while it owns an active program (`DELETE /teams/{id}` → 409 `TEAM_OWNS_PROGRAMS`). Every program created here makes its owner team undeletable until the program is moved or deleted, and neither is possible in the UI yet (Out of scope). Team deletion isn't in the UI either, so nothing breaks today.

## Program page (`/programs/:programId`, `features/programs/pages/ProgramPage.tsx`)

Opened from the program name in the list. Every role sees the same page; nothing on it is role-gated (editing a program is Out of scope, and any active employee can comment).

```
← Programs
Marketing Research                                    (h1, via PageHeader → "Marketing Research · FlowDesk")
[MKT] (Active)
┌ main ─────────────────────────────────────┐ ┌ aside "Program details" ─────┐
│ Description                               │ │ Details                      │
│ Q4 market research for the new product…   │ │ Owner team   Research        │
│ (whitespace-pre-wrap; "No description.")  │ │ Start date   1 Oct 2026      │
│                                           │ │ End date     31 Dec 2026     │
│ Comments                                  │ │ Created      17 Oct 2026     │
│ [ Add a comment…                       ]  │ │ Updated      18 Oct 2026     │
│                          [ Post comment ] │ ├──────────────────────────────┤
│ (RK) Ravi Kumar · 17 Oct 2026, 10:30      │ │ Analytics & reports          │
│      Draft ready, @Jane Doe please review │ │ Progress charts and reports… │
│      [ Reply ]                            │ │ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐   │
│   │ (JD) Jane Doe · 17 Oct 2026, 11:05    │ │ ╎   📊  Coming soon      ╎   │
│   │      Looks good…                      │ │ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘   │
│ [ Show older comments ]                   │ └──────────────────────────────┘
└───────────────────────────────────────────┘
```

- **Layout:** `grid lg:grid-cols-[minmax(0,1fr)_20rem]`. The aside comes first in the DOM, so on narrow screens the details sit above the comments; from `lg` up it's placed in the right column.
- **Data:** `useProgram(programId)` (`GET /programs/{programId}`, key `programKeys.detail(id)`) and the team directory for the owner team name (`OwnerTeamName`, same rules as the table). Dates use `formatProgramDate`, "Not set" when null.
- **Analytics & reports:** a static `Card` that says "Coming soon". No API call; there's no analytics endpoint.

| State | What renders |
|---|---|
| loading | back link + skeleton header and columns (`aria-busy`) |
| success | as above |
| 404 (unknown or soft-deleted) | `NotFoundState` "Program not found" / "This program doesn't exist or has been deleted." |
| 400 (`programId` isn't a UUID, e.g. a hand-typed URL) | same `NotFoundState`: to the user it's just as missing |
| 500 / network | `ErrorState` "Couldn't load the program" + Retry |
| 401 | middleware ends the session |

## Program comments (`features/comments`)

A new feature folder, so the tasks spec can reuse it for task comments. Its `index.ts` exports only `ProgramComments`; `comments` imports no other feature.

**Data (`comments/api.ts`):**

```ts
export const commentKeys = {
  all: ['comments'] as const,
  program: (programId: string) => [...commentKeys.all, 'program', programId] as const,
}

useProgramComments(programId)        // useInfiniteQuery: GET /programs/{id}/comments?order=desc&limit=20&offset
                                     //   next offset = meta.offset + data.length while < meta.total
useCreateProgramComment(programId)   // useMutation<Comment, ApiError, CreateCommentRequest>
                                     //   POST /programs/{id}/comments → data
                                     //   onSuccess: invalidate commentKeys.program(id)
                                     //   onError: PARENT_COMMENT_NOT_FOUND → invalidate too (the parent is gone)
```

- **Newest thread first** (`order=desc`), with the comment box on top, so a new comment appears right under it after the refetch. Replies stay oldest first (contract). `limit`/`offset` page **threads**; "Show older comments" fetches the next page. Refetching after a post refetches every loaded page with its own offset, so a thread that shifts to the next page isn't duplicated.
- **Comment box (`CommentForm`)**, for a new comment and for a reply: `Textarea` (label "Comment" / "Reply", visually hidden), zod `body: z.string().trim().min(1).max(10000)` ("Write something first." / "Use at most 10,000 characters."). Ctrl/Cmd + Enter posts. Pending: textarea and button disabled, button "Posting…". Success: toast "Comment added" / "Reply added", box cleared, reply box closed. Body `{ body }`, plus `parentId` for a reply.
- **Thread (`CommentThread`)**: the comment, then its replies indented under a left border, then (after **Reply**) an inline reply box with Cancel. No Reply on a tombstone (a deleted comment can't be replied to).
- **Comment (`CommentItem`)**: `<article aria-label="Comment by {name}">` (or "Reply by…"), avatar initials, author, `createdAt` (`dateStyle: 'medium', timeStyle: 'short'`), "(edited)" when `editedAt` is set. A **tombstone** (`isActive: false`) shows "This comment was deleted." and no author.
- **Body (`CommentBody`)**: plain text with `whitespace-pre-wrap`, so React escapes everything and nothing in a body can run. Mention tokens `@[Label](mention:<uuid>)` (`parseCommentBody`) render as a highlighted "@Name" using the person's **current** name from `mentions`, falling back to the label. Markdown isn't rendered (Out of scope: it needs a sanitising Markdown renderer, a new package).

| State | What renders |
|---|---|
| first load | 3 skeleton comments |
| success | the threads + "Show older comments" while there are more |
| empty | `EmptyState` "No comments yet" / "Start the discussion. Everyone in FlowDesk can comment on a program." (the box is above it) |
| first load fails (500 / network) | `ErrorState` "Couldn't load comments" + Retry; the box still shows |
| older page fails | threads stay; "Couldn't load older comments. Try again." above the button |
| 401 | middleware ends the session |

| Post response | Where | Text |
|---|---|---|
| 400 `Validation failed`, path `body` | on the box (focused) | server message |
| 400 `Validation failed`, other paths | `FormErrorAlert` in that box | server message |
| 400 `PARENT_COMMENT_NOT_FOUND` | reply box alert **and** a toast (the refetch can remove the thread and the box with it); threads refetch | "The comment you're replying to no longer exists." |
| 400 `NESTED_REPLY`, `PARENT_TARGET_MISMATCH` | alert | mapped messages (can't happen from this UI: replies have no Reply button) |
| 400 `TOO_MANY_MENTIONS`, `MENTION_NOT_FOUND` | alert | the server's message (mapped to `null`) |
| 404 (program deleted meanwhile) | alert | server message |
| 500 / network | alert | `getErrorMessage` |

Comment edit and delete, and the @-mention picker, are Out of scope.

## Tests (Vitest + MSW + RTL)

| File | Case | Expected |
|---|---|---|
| `features/programs/programKey.test.ts` | each row of the suggestion table | the listed key |
| `features/programs/programs.test.tsx` | 200 with two programs, directory with their teams | key, name, description, status label, owner team name, created date; Programs nav item has `aria-current="page"` |
| | `ownerTeamId: null` / id not in the directory | "No owner team" / "Unknown team" |
| | directory 500 | list still renders; owner cells "Unknown team" |
| | as MEMBER / MANAGER / ADMIN | Create program absent / present / present |
| | `meta.total: 0` as MEMBER / MANAGER | "No programs yet" + "Ask an admin…" / + Create program action |
| | 500 → Retry → 200 | "Couldn't load programs", then the table |
| | `?offset=20` | request `limit=20&offset=20` |
| | type name "Marketing Research" | Key shows `MR`; hint "Tasks will be numbered MR-1, MR-2…" |
| | type own key "mkt", then change the name | Key shows `MKT` and stays `MKT` |
| | clear the key, then change the name | suggestion fills again |
| | signed-in employee in team Research | Owner team preselected "Research" |
| | employee with `teamId: null` | Owner team empty; submit → "Pick the team that owns this program."; no request |
| | directory `data: []` | select disabled; "create a team" link to `/teams` |
| | key "1AB" / "A" | "Use 2–10 letters or digits, starting with a letter."; no request |
| | submit valid form, blank description | `POST /programs` body exactly `{ ownerTeamId, key: 'MR', name: 'Marketing Research', status: 'PLANNED' }`; toast "Program “Marketing Research” created"; list refetched |
| | change status to Active, add description | body has `status: 'ACTIVE'` and `description` |
| | submit from `?offset=20` | after success the URL has no `offset` |
| | 409 `PROGRAM_KEY_EXISTS` | new message under Key; dialog open |
| | 400 `OWNER_TEAM_NOT_FOUND` | Owner team cleared with the message under it; `GET /teams` requested again |
| | 400 `details: [{ path: 'key', … }]` / `details: [{ path: '', … }]` | on the Key field / in the form alert |
| | 403 | "You don't have permission to do that." in the dialog |
| | pending | button "Creating program…" disabled; Escape doesn't close |
| | sidebar | links in order Programs, People, Teams |
| | dates both / neither / only start / only end | `formatRange` text / "Not set" / "From …" / "Until …" |
| | program name | links to `/programs/{id}` |
| | start 2026-10-01, end 2026-12-31 | body has `startDate` and `endDate`; blank dates are left out (the defaults case above) |
| | 400 `INVALID_DATE_RANGE` | "The end date must be on or after the start date." under End date, focused |
| `features/programs/programPage.test.tsx` | 200 | h1 name, key, status, description, owner team, dates, created/updated, "Analytics & reports" + "Coming soon", Comments; Programs nav item still current |
| | null description and dates | "No description."; "Not set" twice |
| | click the name in the list, then the back link | `/programs/{id}`, then `/programs` |
| | 404 / 400 | "Program not found"; no Comments |
| | 500 → Retry → 200 | "Couldn't load the program", then the page |
| `features/comments/commentBody.test.ts` | text + mention / only mentions / not a token / empty | parts in order; ids lowercased; plain `@jane` and bad uuids stay text |
| `features/comments/programComments.test.tsx` | thread with a mention, an edit and a reply | "@Jane Doe" (current name, not the label), "(edited)", the reply; request `order=desc&limit=20&offset=0` |
| | tombstone with a reply | "This comment was deleted.", the reply, no Reply button |
| | empty / 500 → Retry | "No comments yet" / "Couldn't load comments", then the thread |
| | 20 threads of 21 → Show older comments | second request `offset=20`; both pages shown; button gone |
| | post "  Hello team  " | body `{ body: 'Hello team' }`; toast "Comment added"; box cleared; list refetched |
| | Ctrl+Enter | posts |
| | blank | "Write something first."; no request |
| | Reply → type → Post reply | box focused; body `{ body, parentId }`; toast "Reply added"; reply box closed. Cancel closes it too |
| | `PARENT_COMMENT_NOT_FOUND` | message in the reply box and a toast; list refetched |
| | 400 `details` path `body` / `MENTION_NOT_FOUND` | on the box / in the alert; box focused, text kept |
| | pending | "Posting…" disabled; box disabled |

## Contract notes

Checked 2026-10-19 (first pass): `npm run api:types` output matched `src/api/schema.d.ts` (no changes since spec 06). **Re-run later on 2026-10-19:** the backend added `startDate` / `endDate` (`format: date`, nullable) to `Program`, `CreateProgramRequest` and `UpdateProgramRequest`, and `INVALID_DATE_RANGE` to the `POST` and `PATCH /programs` 400s (`PATCH` checks the merged values). `INVALID_DATE_RANGE` was already in `BACKEND_ERROR_CODES` (tasks use it). Nothing blocking:

1. **No team summary on `Program`.** Like `Employee` (CLAUDE.md gap 5), `Program` only has `ownerTeamId`, so the page loads the team directory to show names. An `ownerTeam: { id, name } | null` would remove that.
2. **`CreateProgramRequest.key`'s `pattern` (`^[A-Z][A-Z0-9]{1,9}$`) describes the normalised key, not the accepted input.** The description says the key is trimmed and uppercased first, and the request example sends `"mkt"`. A client validating raw input against the pattern would wrongly reject lowercase. The form uppercases as you type, so it isn't affected. Worth saying "after trimming and uppercasing" in the pattern's description.
3. **No key availability check.** A taken key (including one held by a deleted program, which the list can't show) is only discovered on submit (409). Fine at this scale.
4. **`INVALID_DATE_RANGE` has no `details`** saying which field is wrong. For programs it's always the end date, so the dialog puts it there. Tasks share the code (start vs due date), which is why the shared message says "due date" and the program dialog uses its own text.
5. **`Comment.author` / `CommentReply.author` generate as non-nullable.** The schema is `allOf: [EmployeeSummary, { nullable: true }]`; in OpenAPI 3.0 `nullable` inside an `allOf` branch doesn't make the result nullable, so `openapi-typescript` emits `EmployeeSummary & unknown`. The description (and the `Comment` description) say it's `null` on a tombstone. `CommentItem` checks `isActive` before reading `author`, and the tombstone test fixture needs a cast. Fix on the backend: `author: { nullable: true, allOf: [{ $ref: EmployeeSummary }] }` (or `oneOf` with `null` in 3.1).
6. **Comment bodies are Markdown that "must be rendered sanitised"**, but the frontend has no Markdown renderer. Bodies show as escaped plain text with mentions resolved, which is safe but shows `**bold**` literally.

## Acceptance checklist

- [x] `npm run api:types` re-run; `features/programs/types.ts` and `features/comments/types.ts` only alias generated types
- [ ] Sidebar shows Programs first (above People and Teams) for every role; active state follows the URL, including on a program page
- [ ] `/programs` lists active programs newest first with key, status, owner team name, dates and created date; paging works
- [ ] Create with a start and end date → both shown in the list; end before start → `INVALID_DATE_RANGE` under End date
- [ ] Program name opens `/programs/{id}` with its details, dates, description, Comments and "Analytics & reports · Coming soon"
- [ ] Deleted or unknown program id → "Program not found"
- [ ] Post a comment and a reply as each role; newest thread first; "Show older comments" past 20 threads
- [ ] A comment with a mention token shows "@{current name}"; a deleted comment with replies shows as a tombstone
- [ ] As MEMBER: no Create program (header or empty state). As MANAGER and ADMIN: both
- [ ] Key suggestion follows the name until the user types a key; clearing the key brings it back; the hint previews `{KEY}-1`
- [ ] Owner team defaults to the user's own team; no team → must pick; no teams at all → link to Teams
- [ ] Create → toast, dialog closes, program is the first row on page 1, with the server's uppercased key
- [ ] Lowercase key "mkt" is stored as `MKT`
- [ ] Duplicate key (also one from a soft-deleted program) → `PROGRAM_KEY_EXISTS` message under Key
- [ ] Delete the picked team in another tab, then submit → `OWNER_TEAM_NOT_FOUND` under Owner team, and the team leaves the select
- [ ] 403 handled: demote the signed-in manager in the DB, then create → `FORBIDDEN` alert
- [ ] Keyboard and 375 px checks for the Programs page, the dialog and the program page
- [x] CLAUDE.md updated: gap 5 also covers `Program.ownerTeamId`; program dates and the `Comment.author` type gap added
- [x] `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` pass

## Verified

**Dates, program page and comments (2026-10-19): 196/196 tests pass across the repo**, three full parallel runs in a row. New or changed: `programs.test.tsx` (+5: sidebar order, dates column, name link, dates sent, `INVALID_DATE_RANGE`), `programPage.test.tsx` (6), `commentBody.test.ts` (6), `programComments.test.tsx` (14), each case in the Tests table above. Against the running backend (curl): `GET /programs/{id}`, `GET` and `POST /programs/{id}/comments`, and `POST /programs` with dates return 401 `AUTH_REQUIRED` without a token and `INVALID_AUTH_TOKEN` with `Bearer abc`; the CORS preflight from `http://localhost:5173` for `POST /programs/{id}/comments` returns 204 and allows `authorization, content-type`.

**First pass: 165/165 tests passed across the repo.** New:
- `programKey.test.ts` (9): every row of the suggestion table, plus an empty name and an 11-word name capped at 10 characters.
- `programs.test.tsx` (27):
  - **List:** key, name, description, status label, owner team name and created date, and Programs `aria-current="page"`. "No owner team" for `ownerTeamId: null`, "Unknown team" for an id missing from the directory, and the list still renders when `GET /teams` returns 500. Create program shows per role. Empty state for MEMBER (no action) and MANAGER (header and empty-state buttons). 500 → Retry. `?offset=20` sends exactly `limit=20&offset=20`.
  - **Dialog:** the name suggests `MR` and the hint previews `MR-1, MR-2…`. A typed "mkt" shows as `MKT` and survives name changes, and clearing it resumes suggestions. The user's own team is preselected. With no team, submitting shows "Pick the team that owns this program." and sends nothing. No teams at all disables the select, and its "create a team" link goes to `/teams` and closes the dialog. Keys `1AB`, `A` and `MK-1` are rejected without a request.
  - **Submit:** the body is exactly `{ ownerTeamId, key: 'MR', name: 'Marketing Research', status: 'PLANNED' }` (trimmed name, blank description left out), the toast uses the response, and the list is refetched. A picked owner team, Active status and a description are all sent. Creating from `?offset=20` lands on `/programs`.
  - **Errors:** `PROGRAM_KEY_EXISTS` shows under Key, which gets focus. `OWNER_TEAM_NOT_FOUND` clears and focuses Owner team, `GET /teams` is called again, and the deleted team is gone from the options. 400 `details` go on Key or, for path `''`, into the form alert. 403 shows in the dialog. While pending, the button reads "Creating program…" (disabled), fields are disabled and Escape doesn't close.

**Against the running backend (curl, 2026-10-19):** `npm run api:types` produced no diff. `GET /programs` and `POST /programs` with `Bearer abc` return 401 `INVALID_AUTH_TOKEN`, and without a token 401 `AUTH_REQUIRED` (the session-end path). The CORS preflight from `http://localhost:5173` for `POST /programs` with `authorization, content-type` returns 204 and allows it.

**Still to do by hand** (unticked items above): everything that needs a signed-in session against real data: the real list, creating with a lowercase key and with dates, a duplicate or soft-deleted key, deleting the owner team mid-dialog, 403 after demotion, the program page and posting comments and replies, keyboard and 375 px checks.

## Implementation notes

- **Focus after a server error.** Fields are disabled while the request is pending, and `useMutation`'s `onError` runs before the render that enables them, so `setError(…, { shouldFocus: true })` silently did nothing (the first test run caught it). The dialog now focuses the first invalid field in an effect keyed on `createProgram.error`, which changes once per failed submit. **`CreateTeamDialog` (`TEAM_NAME_EXISTS`) and the invite dialog have the same latent bug**; they weren't changed here.
- **The form resets when the dialog opens**, not when it closes, so the default owner team is the user's team as the directory knows it at that moment.
- **`renderSignedIn`** (`src/test/renderApp.tsx`) takes a `me` option (other fields of the signed-in employee, e.g. `teamId`).
- **Key input** uppercases the DOM value and restores the selection before calling `onChange`, so typing in the middle of the key doesn't jump the caret to the end.
- `PROGRAM_STATUS_VARIANTS` sits next to the labels in `programStatus.ts`. The owner team cell is `OwnerTeamName` (shared by the table and the program page) rather than `EmployeeTable`'s `TeamCell`, because the null case reads differently ("No owner team" vs "No team").
- The comment box uses the same "focus after the error render" effect as the create dialog (keyed on `createComment.error`).
- `initials()` moved from `UserMenu` to `lib/initials.ts` so comment avatars use the same rule.

## Testing notes

- A soft-deleted program's key: create a program, `DELETE /programs/{id}` with an ADMIN token (curl, there's no UI for it), then create another with the same key.
- `OWNER_TEAM_NOT_FOUND`: create an empty team, open the dialog and pick it, delete the team with an ADMIN token, then submit. The team must own no programs, or the delete returns `TEAM_OWNS_PROGRAMS`.
- 403: open the page as a MANAGER, set their role to `MEMBER` in the DB (roles are read on every request), then submit.
- `INVALID_DATE_RANGE`: create with Start date 31 Dec and End date 1 Oct.
- A tombstone: post a comment, reply to it, then `DELETE /programs/{id}/comments/{commentId}` on the top-level one (curl; there's no delete in the UI).
- `PARENT_COMMENT_NOT_FOUND`: open the reply box, delete the parent with curl, then post the reply.
- **Test timeouts.** With 19 files on 8 workers, a few older dialog tests take 3–5 s and intermittently hit vitest's 5 s `testTimeout` or the 3 s `asyncUtilTimeout`. Both were raised (15 s, 5 s); the suite then passed three parallel runs in a row. With `--maxWorkers=2` it passed at the old limits too.

## Out of scope / follow-ups

- The program's tasks and labels on the program page (tasks spec), and `programs/index.ts` when tasks need `programKeys` or `ProgramStatusBadge`.
- Analytics & reports content (no endpoint yet; the section is a "Coming soon" placeholder).
- Comment edit (`PATCH`, author only) and delete (`DELETE`, ADMIN/MANAGER or author), the @-mention picker (`GET /employees?q=`), and Markdown rendering (needs a sanitising renderer, a new package: ask first).
- Edit program (`PATCH /programs/{id}`: name, description, status, dates, move to another owner team). Moving ownership is also what unblocks deleting a team that owns programs (`TEAM_OWNS_PROGRAMS`).
- Delete program (`DELETE`, ADMIN only; the key stays taken, no restore).
- Status and owner team filters and `q` search on the Programs page (`GET /programs` supports all three).
- A team's programs on the Teams page (`GET /programs?ownerTeamId=`).
- Making Programs the home page (`/` redirects to People today).
