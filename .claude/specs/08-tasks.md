# 08 — Tasks (program task list, create task)

**Status:** Implemented (2026-10-19). Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `tasks`
**Depends on:** [01-api-client-and-errors](./01-api-client-and-errors.md) (`apiClient`, `unwrap`, `ApiError`, `ERROR_MESSAGES`), [03-login](./03-login.md) (`useAuth`), [04-app-layout-people](./04-app-layout-people.md) (`applyServerErrors`, `Pagination`, feedback components), [06-teams-and-member-editing](./06-teams-and-member-editing.md) (`EmployeeMultiPicker`, `useEmployeeSearch`, the picker-in-a-dialog Escape rule), [07-programs](./07-programs.md) (`ProgramPage`, `ProgramComments`, calendar-date formatting)

## Goal

Tasks always belong to a program, so you add them after picking one:

1. **Program page tabs.** The program page's main column gets two tabs, **Tasks** (default) and **Comments**. The Details and Analytics & reports cards stay in the side column, and the description stays above the tabs. The tab is in the URL (`?tab=comments`), so it can be linked.
2. **Task list** (Tasks tab): the program's active tasks, newest first, 20 per page. Each row shows the **key** (`MKT-7`), **title** with its labels, **type**, **status**, **priority**, **assignee** and **due date**. A **search** box (title or exact key) and a **status** filter narrow the list. Search, status and page are in the URL.
3. **Create task** (every role): a dialog with every `POST /programs/{programId}/tasks` field except blockers (`dependsOn`): title, type, status, priority, assignee (people search, plus "Assign to me"), start and due dates, estimate in hours, labels and description. Defaults match the contract (Task, Discussion, Medium, unassigned).

The contract has every operation this needs. Nothing is blocked on the backend.

## Flow

```
Browser (any role)                                 FlowDesk API
  │ 1. open /programs/{id} (Tasks tab is the default)   │
  │    GET /programs/{id}                               │
  │    GET /programs/{id}/tasks?limit=20&offset=0       │
  │───────────────────────────────────────────────────>│
  │ 2. 200 { data: Task[], meta }  newest first         │
  │<───────────────────────────────────────────────────│
  │ 3. type "survey" in Search (300 ms debounce)        │
  │    GET …/tasks?q=survey&limit=20&offset=0           │ URL ?q=survey (replaces the history entry)
  │ 4. "Create task" → dialog                           │
  │    Assignee: type "ja" → GET /employees?q=ja&limit=20│
  │ 5. submit                                           │
  │    POST /programs/{id}/tasks { title, type, status, │
  │      priority, assigneeId?, startDate?, dueDate?,   │
  │      estimateMinutes?, labels?, description? }      │
  │───────────────────────────────────────────────────>│ next key (MKT-13), reporter = me
  │ 6. 201 { data: Task }                               │
  │<───────────────────────────────────────────────────│ toast "Task MKT-13 created"; refetch the list;
  │    or 400 ASSIGNEE_NOT_FOUND / INVALID_DATE_RANGE   │ back to page 1
```

The signed-in employee becomes the reporter; the form never sends one. The key's number comes from the server (`MKT-13`), so the dialog can't preview it; the toast shows it.

## Environment variables

None new.

## Packages

| Package | Kind | Purpose |
|---|---|---|
| shadcn `tabs` | **new**, `npx shadcn add tabs` (Radix Tabs, already in `radix-ui`) | Tasks / Comments tabs |
| shadcn `dialog`, `select`, `input`, `textarea`, `field`, `badge`, `table`, `skeleton`, `label` | already in `src/components/ui` | dialog, selects, list |
| `react-hook-form`, `@hookform/resolvers`, `zod`, `sonner`, `lucide-react`, `@tanstack/react-query`, `cmdk` | already installed | forms, toasts, icons, queries, people picker |

## Folder layout (new and changed)

```
src/
  components/ui/tabs.tsx                      NEW      npx shadcn add tabs
  lib/dates.ts                                NEW      formatCalendarDate(YYYY-MM-DD), moved out of programs/programDates.ts
  lib/formErrors.ts                           CHANGED  nested paths (labels.0) go to their top-level field; optional path aliases
  lib/formErrors.test.ts                      NEW
  features/
    employees/components/EmployeeMultiPicker.tsx  CHANGED  + max: hides the search input once max people are picked
    programs/
      programDates.ts                         CHANGED  uses formatCalendarDate
      pages/ProgramPage.tsx                   CHANGED  Tasks | Comments tabs, ?tab=comments
      programPage.test.tsx                    CHANGED  tabs; mocks GET …/tasks
    tasks/
      types.ts                                NEW      Task, TaskStatus, TaskType, TaskPriority, TaskList, TaskListParams, CreateTaskRequest aliases
      api.ts                                  NEW      taskKeys, useProgramTasks, useCreateTask
      taskDisplay.ts                          NEW      statuses, types, priorities: contract order, labels, badge variants, icons
      taskSchema.ts                           NEW      zod schema for the create form, parseLabels(), hoursToMinutes()
      taskSchema.test.ts                      NEW
      searchParams.ts                         NEW      ?q, ?status, ?offset (merged into the page's URL, keeps ?tab)
      searchParams.test.ts                    NEW
      components/TaskStatusBadge.tsx          NEW
      components/TaskPriorityLabel.tsx        NEW      icon + label
      components/TaskTable.tsx                NEW
      components/TaskFilters.tsx              NEW      search + status
      components/CreateTaskDialog.tsx         NEW
      components/ProgramTasks.tsx             NEW      the Tasks tab: filters, create button, table, pagination, states
      index.ts                                NEW      ProgramTasks
      tasks.test.tsx                          NEW
```

Request flow as before: component → feature hook (`features/tasks/api.ts`) → `unwrap(apiClient.…)`.

**Cross-feature imports, only through `index.ts`:** `programs` → `@/features/tasks` (`ProgramTasks`); `tasks` → `@/features/employees` (`EmployeeMultiPicker`, `Employee`). `tasks` must **not** import `@/features/programs` (programs imports tasks, so that would be a cycle): `ProgramTasks` gets `programId` and `programName` as props. Calendar-date formatting moves to `src/lib/dates.ts` for the same reason.

## Types (`features/tasks/types.ts`)

```ts
export type Task = components['schemas']['Task']
export type TaskStatus = components['schemas']['TaskStatus']
export type TaskType = components['schemas']['TaskType']
export type TaskPriority = components['schemas']['TaskPriority']
export type TaskList = components['schemas']['TaskListResponse']
export type TaskListParams = NonNullable<paths['/programs/{programId}/tasks']['get']['parameters']['query']>
export type CreateTaskRequest = components['schemas']['CreateTaskRequest']
// The statuses a client may set on create (DEPENDENT is server-only).
export type CreatableTaskStatus = NonNullable<CreateTaskRequest['status']>
```

## Display (`taskDisplay.ts`, `TaskStatusBadge`, `TaskPriorityLabel`)

Display only; no rules. Every list keeps the contract's enum order, which is also the order in the selects. The label is always shown, so colour or an icon is never the only signal.

| `TaskStatus` | Label | `Badge` variant |
|---|---|---|
| `DISCUSSION` | Discussion | `outline` |
| `ON_HOLD` | On hold | `secondary` |
| `IN_PROGRESS` | In progress | `default` |
| `DONE` | Done | `secondary` |
| `DEPENDENT` | Dependent | `destructive` |

`CREATABLE_TASK_STATUSES` = Discussion, On hold, In progress, Done (the create body's enum). `DEPENDENT` is only ever set by the server, so it's in the filter but not in the dialog.

| `TaskType` | Label | | `TaskPriority` | Label | Icon (lucide) |
|---|---|---|---|---|---|
| `PRE` | Pre | | `LOWEST` | Lowest | `ChevronsDown` |
| `TASK` | Task | | `LOW` | Low | `ChevronDown` |
| `POST` | Post | | `MEDIUM` | Medium | `Equal` |
| `BUG` | Bug | | `HIGH` | High | `ChevronUp` |
| `ISSUE` | Issue | | `HIGHEST` | Highest | `ChevronsUp` |

`TaskPriorityLabel` shows the icon (`aria-hidden`, `text-muted-foreground`, `text-destructive` for High and Highest) and the label.

## Data (`features/tasks/api.ts`)

```ts
export const taskKeys = {
  all: ['tasks'] as const,
  program: (programId: string) => [...taskKeys.all, 'program', programId] as const,
  list: (programId: string, params: TaskListParams) => [...taskKeys.program(programId), 'list', params] as const,
}

useProgramTasks(programId, params)  // GET /programs/{programId}/tasks; placeholderData: keepPreviousData
useCreateTask(programId)            // useMutation<Task, ApiError, CreateTaskRequest>
                                    //   POST /programs/{programId}/tasks → data
                                    //   onSuccess: invalidate taskKeys.program(programId)
```

`GET …/labels` isn't used yet (label autocomplete is Out of scope).

## Program page tabs (`features/programs/pages/ProgramPage.tsx`)

```
← Programs
Marketing Research
[MKT] (Active)
┌ main ───────────────────────────────────────────────────┐ ┌ Details ─────────┐
│ Description                                             │ │ …                │
│ Q4 market research for the new product line             │ ├ Analytics & … ───┤
│                                                         │ │ Coming soon      │
│ [ Tasks ] [ Comments ]                                  │ └──────────────────┘
│ ─────────────────────────────────────────────────────── │
│ (Tasks tab, see below)                                  │
└─────────────────────────────────────────────────────────┘
```

- shadcn `Tabs`, `TabsList` labelled "Program sections", triggers "Tasks" and "Comments". `TabsContent` for Tasks renders `<ProgramTasks programId programName />`, Comments renders `<ProgramComments programId />` (spec 07, unchanged). Radix mounts only the active tab, so comments load when that tab is first opened.
- **URL:** `?tab=comments` selects Comments; anything else (or nothing) is Tasks. Switching tabs updates only `tab` (`setSearchParams(prev => …)`), keeping the Tasks tab's `q`, `status` and `offset`, and pushes a history entry so Back returns to the previous tab.
- The tab triggers show no counts: `meta.total` is the filtered total, which would mislead.

## Tasks tab (`features/tasks/components/ProgramTasks.tsx`)

```
[ 🔍 Search by title or key      ]  Status [ All statuses ▾ ]  [Clear filters]   [ + Create task ]
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Key     Title                        Type   Status         Priority   Assignee     Due        │
│ MKT-13  Draft survey questions       Pre    (Discussion)   ⇈ Highest  Jane Doe     31 Oct 2026│
│         [survey] [q4]                                                                        │
│ MKT-12  Book the venue               Task   (In progress)  = Medium   Unassigned   None       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
Showing 1–20 of 23                                                        [ Previous ] [ Next ]
```

### URL and filters (`searchParams.ts`, `TaskFilters.tsx`)

```ts
export interface TaskSearch { q?: string; status?: TaskStatus; offset: number }
parseTaskSearch(params): TaskSearch          // URL hygiene: unknown status → none, bad offset → 0,
                                             // q trimmed, '' → none, cut to 100 characters
updateTaskSearch(prev, patch): URLSearchParams // copies prev (keeps ?tab and anything else), applies the
                                             // patch, resets offset to 0 unless the patch sets it,
                                             // leaves out defaults
toTaskListParams(search): TaskListParams     // { q?, status?, limit: 20, offset }
hasTaskFilters(search)                       // q or status set
```

- Every URL change is a functional update (`setSearchParams(prev => updateTaskSearch(prev, patch))`), so a debounced search can't undo a status change made in the meantime.
- **Search:** `Input type="search"`, visible `Label` "Search tasks" (`sr-only`), placeholder "Search by title or key", `maxLength={100}` (the contract's `q` limit). It applies 300 ms after the last keystroke, with `{ replace: true }` so typing doesn't fill the history. When the URL's `q` changes by itself (Clear filters, Back), the input shows it. The contract matches a title substring or an exact key, both case-insensitive.
- **Status:** `Select` (label "Status") with "All statuses" and the five statuses. Pushes a history entry, like the People filters.
- **Clear filters** (ghost button), shown only while `hasTaskFilters`: removes `q`, `status` and `offset`.
- **Create task** button on the right of the toolbar. Every role may create tasks (contract), so it's always shown.

### Table (`TaskTable.tsx`)

shadcn `Table` with `aria-label="Tasks"` in an `overflow-x-auto rounded-lg border` wrapper, like `ProgramTable`.

| Column | Content |
|---|---|
| Key | `key` in `font-mono text-sm`, `whitespace-nowrap` |
| Title | title (`font-medium`), `max-w-md`, wraps; labels below as small `outline` badges, the first 3 plus "+N" |
| Type | type label |
| Status | `TaskStatusBadge` |
| Priority | `TaskPriorityLabel`, `whitespace-nowrap` |
| Assignee | `assignee.name`, or "Unassigned" (muted) |
| Due | `formatCalendarDate(dueDate)`, or "None" (muted), `whitespace-nowrap` |

Rows aren't links yet: the task page is the next spec (Out of scope).

### States

| State | What renders |
|---|---|
| first load | toolbar + 5 skeleton rows (7 cells) |
| success | table + `Pagination` |
| next page or new filter loading | current rows stay, dimmed (`aria-busy`), Pagination disabled |
| no tasks at all (`total 0`, no filters) | `EmptyState` "No tasks yet" / "Add the first task to plan the work." + Create task |
| filters match nothing | `EmptyState` "No tasks match these filters" + "Clear filters" |
| page past the end | `EmptyState` "This page is empty" + "Go to first page" |
| 404 (program deleted meanwhile) / 500 / network | `ErrorState` "Couldn't load tasks" + Retry |
| 401 | middleware ends the session |

`GET …/tasks` documents 400 for bad query values; the page only sends sanitised `q`, `status`, `limit=20` and `offset`, so it can't happen. No 403.

## Create task dialog (`features/tasks/components/CreateTaskDialog.tsx`)

```
┌ Create a task ──────────────────────────────────────────────┐
│ Adds a task to Marketing Research. You'll be its reporter.   │
│                                                              │
│ Title                                                        │
│ [ Draft survey questions                                 ]   │
│                                                              │
│ Type            Status             Priority                  │
│ [ Task     ▾ ]  [ Discussion  ▾ ]  [ Medium      ▾ ]         │
│                                                              │
│ Assignee (optional)                          [Assign to me]  │
│ [ Search by name or email                                ]   │
│                                                              │
│ Start date (optional)          Due date (optional)           │
│ [ dd/mm/yyyy ]                 [ dd/mm/yyyy ]                │
│                                                              │
│ Estimate in hours (optional)                                 │
│ [ 1.5    ]  For example 1.5 for 1 h 30 min.                  │
│                                                              │
│ Labels (optional)                                            │
│ [ survey, q4                                             ]   │
│ Separate with commas. Saved in lowercase.  [survey] [q4]     │
│                                                              │
│ Description (optional)                                       │
│ [                                                        ]   │
│                                                              │
│                                  [ Cancel ] [ + Create task ] │
└──────────────────────────────────────────────────────────────┘
```

`DialogContent` is `sm:max-w-xl max-h-[calc(100svh-2rem)] overflow-y-auto` (the form is taller than a phone screen). Type / Status / Priority sit in 3 columns from `sm` up; the dates in 2. Every input has a visible label. Escape doesn't close the dialog while the people list is open (`data-picker-open`, as in `CreateTeamDialog`).

### Form (`taskSchema.ts`)

Mirrors `CreateTaskRequest` for instant feedback only; the server's `details` win.

| Field | Control | Default | zod rule | Messages |
|---|---|---|---|---|
| `title` | `Input`, placeholder "Draft survey questions" | `''` | `trim().min(1).max(255)` | "Enter a title." / "Use at most 255 characters." |
| `type` | `Select`, `TASK_TYPES` | `'TASK'` | `z.enum(TASK_TYPES)` | — |
| `status` | `Select`, `CREATABLE_TASK_STATUSES` | `'DISCUSSION'` | `z.enum(CREATABLE_TASK_STATUSES)` | — |
| `priority` | `Select`, `TASK_PRIORITIES` | `'MEDIUM'` | `z.enum(TASK_PRIORITIES)` | — |
| `assignee` | `EmployeeMultiPicker` with `max={1}`, label "Assignee"; link-style "Assign to me" sets it to the signed-in employee (hidden once someone is picked) | `[]` | `z.array(z.custom<Employee>()).max(1)` | — |
| `startDate` | `Input type="date"` | `''` | `''` or `YYYY-MM-DD` | "Enter a valid date." |
| `dueDate` | `Input type="date"` | `''` | same | "Enter a valid date." |
| `estimateHours` | `Input inputMode="decimal"`, hint "For example 1.5 for 1 h 30 min." | `''` | `''`, or a number with up to 2 decimals, `> 0` and `≤ 8760` | "Enter hours as a number, up to 8,760 (one year)." |
| `labels` | `Input`, placeholder "survey, q4"; hint "Separate with commas. Saved in lowercase." plus a live preview of `parseLabels(value)` as badges | `''` | each parsed label matches `^[a-z0-9][a-z0-9._-]{0,49}$`; at most 20 | "“{label}” can only use letters, digits, '.', '_' and '-', start with a letter or digit, and be up to 50 characters." / "Use at most 20 labels." |
| `description` | `Textarea`, 4 rows, placeholder "Details, links, acceptance criteria" | `''` | `max(20000)` | "Use at most 20,000 characters." |

- `parseLabels(text)`: split on commas and whitespace, trim, lowercase, drop empties, remove duplicates (keeping the first). This is what the contract does server-side too; the client does it to send an array and to preview it.
- `hoursToMinutes(hours)`: `Math.round(Number(hours) * 60)`. The contract stores minutes (1–525,600); hours are friendlier to type. 0.01 h rounds to 1 minute, so anything the schema accepts is ≥ 1 minute.
- **No client-side date-range check** (CLAUDE.md §1): the server answers `INVALID_DATE_RANGE`.

**Body:** `{ title, type, status, priority, labels, dependsOn: [] }` always (what the selects show is what's stored; `labels` may be `[]`), plus `assigneeId` when someone is picked, `startDate` / `dueDate` when set, `estimateMinutes` when an estimate is set, and `description` when it isn't blank. Nothing is sent as `null`: on create, omitted and `null` both mean "not set". `dependsOn` is always the empty list (blockers are the dependencies spec).

> **Why `labels` and `dependsOn` are always sent.** `openapi-typescript` marks every property with a `default` as required (its `defaultNonNullable` behaviour), so the generated `CreateTaskRequest` requires `labels` and `dependsOn`. `[]` is the contract's default for both, so sending it changes nothing on the server and keeps the body typed without casts.

### Submit (`useCreateTask`)

1. **Pending:** button "Creating task…" with a spinner, disabled; fields disabled; the dialog can't be closed (Escape, overlay, Cancel).
2. **Success:** close, reset, toast `success('Task {key} created')` with the title as the description (both from the response). The list refetches (`taskKeys.program`). `onCreated` removes `offset` from the URL, because the list is newest first; filters stay, so a task that doesn't match them won't show, but the toast names it.
3. **Errors.** The dialog stays open and keeps the values. Coded errors are checked with `hasErrorCode` before `applyServerErrors`:

| Response | Where | Text |
|---|---|---|
| 400 `Validation failed` | `details[].path` → the matching field via `applyServerErrors` with aliases `assigneeId → assignee`, `estimateMinutes → estimateHours`; nested paths (`labels.3`) go to their field (`labels`); the rest in a `FormErrorAlert` | server message |
| 400 `ASSIGNEE_NOT_FOUND` (deactivated meanwhile) | clear **Assignee**, error under it | "The assignee doesn't exist or is inactive." |
| 400 `INVALID_DATE_RANGE` | **Due date** (focused) | "The due date must be on or after the start date." (the shared message) |
| 404 (program deleted meanwhile) | `FormErrorAlert` | server message |
| 409 `TASK_BLOCKED` | `FormErrorAlert` | mapped message (can't happen without `dependsOn`) |
| 403 | `FormErrorAlert` | "You don't have permission to do that." (not documented; any active employee may create) |
| 401 | middleware ends the session | — |
| 500 / network | `FormErrorAlert` | `getErrorMessage` |

Focus after a server error uses the effect keyed on the mutation's `error`, as in `CreateProgramDialog` (fields are disabled while pending). The assignee picker can't take focus from react-hook-form, so after `ASSIGNEE_NOT_FOUND` the error shows but focus stays.

## Shared changes

- **`applyServerErrors(error, fields, setError, aliases?)`**: a server path matches a field when it equals it **or starts with `field.`** (`labels.3` → `labels`), and `aliases` maps a top-level server path to a form field (`{ assigneeId: 'assignee' }`). Existing callers pass no aliases and have flat paths, so they behave as before.
- **`EmployeeMultiPicker`** gets `max?: number`. Once `value.length >= max`, the search input and the list are hidden; removing the chip brings the input back (and focuses it). Without `max`, nothing changes.
- **`src/lib/dates.ts`**: `formatCalendarDate(date: string)` (UTC, `dateStyle: 'medium'`) moves here from `programs/programDates.ts`, which keeps `formatProgramDates` and uses it.

## Tests (Vitest + MSW + RTL)

| File | Case | Expected |
|---|---|---|
| `lib/formErrors.test.ts` | path `labels.2`; alias `assigneeId`; unknown path | on `labels`; on `assignee`; returned for the alert |
| `features/tasks/taskSchema.test.ts` | `parseLabels(' Survey, q4  survey,,')` | `['survey', 'q4']` |
| | `hoursToMinutes('1.5')`, `'0.01'` | `90`, `1` |
| | estimate `'0'`, `'abc'`, `'8761'`, `'1.234'` | rejected |
| | labels `'bad label!'`, 21 labels | rejected with the messages above |
| `features/tasks/searchParams.test.ts` | parse `?q=%20x%20&status=NOPE&offset=-1` | `{ q: 'x', offset: 0 }` |
| | `updateTaskSearch('?tab=comments&offset=40', { status: 'DONE' })` | `tab=comments&status=DONE` |
| `features/tasks/tasks.test.tsx` (renders `ProgramTasks`) | 200 with two tasks | key, title, labels, type, status, priority, assignee / "Unassigned", due / "None"; request `limit=20&offset=0` |
| | `total 0`, no filters | "No tasks yet" + Create task |
| | filters match nothing → Clear filters | "No tasks match these filters"; URL loses `q`/`status` |
| | pick status In progress | request `status=IN_PROGRESS&limit=20&offset=0`; URL `?status=IN_PROGRESS`; offset dropped |
| | type "survey" | one request with `q=survey` after the debounce |
| | open `?q=draft&status=DONE&offset=20` | request has all three; search box shows "draft" |
| | 500 → Retry | "Couldn't load tasks", then the table |
| | Next page | request `offset=20` |
| | submit with only a title | body exactly `{ title, type: 'TASK', status: 'DISCUSSION', priority: 'MEDIUM', labels: [], dependsOn: [] }`; toast "Task MKT-13 created"; list refetched |
| | every field (assignee searched and picked, dates, 1.5 h, "Survey, q4", description) | body has `assigneeId`, dates, `estimateMinutes: 90`, `labels: ['survey', 'q4']`, `description` |
| | Assign to me | the signed-in employee is the chip; "Assign to me" hidden; removing it brings the search back |
| | blank title / bad label / bad estimate | the messages; no request |
| | 400 `ASSIGNEE_NOT_FOUND` | Assignee cleared, message under it |
| | 400 `INVALID_DATE_RANGE` | message under Due date, focused |
| | 400 `details` `labels.0` / `estimateMinutes` / `''` | under Labels / under Estimate / in the alert |
| | 404 | server message in the alert |
| | pending | "Creating task…" disabled; Escape doesn't close |
| | create from `?offset=20&status=DONE` | URL keeps `status`, loses `offset` |
| `features/programs/programPage.test.tsx` | default | Tasks tab selected, task list requested; comments not requested |
| | click Comments | URL `?tab=comments`; comments load |
| | open `?tab=comments` | Comments tab selected |

## Contract notes

Checked 2026-10-19: `npm run api:types` produced no diff since spec 07. Nothing blocking:

1. **`Task.assignee` generates as non-nullable**, the same `allOf` + `nullable` problem as `Comment.author` (CLAUDE.md gap 6), but here `null` is the common case (unassigned). The table checks for `null` regardless of the type. Same backend fix: `nullable: true` next to the `allOf`.
2. **The shape of nested validation paths isn't documented** (for example a bad label: `labels.3`? `labels`?). `applyServerErrors` maps both to the Labels field.
3. **`TASK_BLOCKED` on create needs `dependsOn`**, which this form doesn't send, so it can't happen yet.
4. **`q` matches a title substring or an exact key.** A partial key (`MKT-1`) doesn't match `MKT-12`; the placeholder says "title or key" and that's as precise as the contract.
5. **Request fields with a `default` generate as required** (`CreateTaskRequest.labels`, `dependsOn`, and also `type`, `status`, `priority`). Not a contract bug: it's `openapi-typescript`'s `defaultNonNullable`, which is right for responses and wrong for requests. The form sends the defaults explicitly (see Body). Generating with `--default-non-nullable=false` would fix requests but loosen every response type, so it's not changed here.

## Acceptance checklist

- [x] `npm run api:types` re-run; `features/tasks/types.ts` only aliases generated types
- [ ] Program page: Tasks tab by default, Comments tab via click and `?tab=comments`; switching tabs keeps the task filters
- [ ] Task list shows key, title, labels, type, status, priority, assignee and due date, newest first; paging works
- [ ] Search by part of a title and by an exact key; the status filter; Clear filters; all reflected in the URL
- [ ] Every role (MEMBER too) can create a task; a title-only task gets Task / Discussion / Medium and the next key
- [ ] Assignee search and "Assign to me"; dates; estimate 1.5 h is stored as 90 minutes; labels "Survey, q4" stored as `survey`, `q4`
- [ ] Due before start → `INVALID_DATE_RANGE` under Due date; deactivate the picked assignee mid-dialog → `ASSIGNEE_NOT_FOUND`
- [ ] Keyboard and 375 px checks for the Tasks tab and the dialog
- [x] `npm run typecheck`, `npm run build`, `npm run lint`, `npm test` pass

## Verified

**Automated (Vitest + MSW, contract-shaped bodies): 250/250 tests pass across the repo**, two full parallel runs in a row. New: `lib/formErrors.test.ts` (4), `tasks/taskSchema.test.ts` (19), `tasks/searchParams.test.ts` (7), `tasks/tasks.test.tsx` (22), plus 2 new tab cases in `programs/programPage.test.tsx`; each case in the Tests table above. `npm run build` passes. `npm run lint` shows the 5 existing warnings plus one from the generated `components/ui/tabs.tsx` (it exports `tabsListVariants`, the same `only-export-components` warning as `badge.tsx` and `button.tsx`).

**Against the running backend (curl, 2026-10-19):** `npm run api:types` produced no diff. `GET /programs/{id}/tasks` (with `q`, `status`, `limit`, `offset`) and `POST /programs/{id}/tasks` return 401 `AUTH_REQUIRED` without a token and `INVALID_AUTH_TOKEN` with `Bearer abc`; the CORS preflight from `http://localhost:5173` for `POST …/tasks` returns 204 and allows `authorization, content-type`.

**Still to do by hand** (unticked items above): everything that needs a signed-in session against real data, including the real shape of a bad label's validation path (contract note 2).

## Implementation notes

- **`EmployeeMultiPicker` with `max`**: picking the last allowed person moves focus to that chip's remove button (the input is gone); removing it focuses the search input again once it's back. `CreateTeamDialog` passes no `max`, so it's unchanged.
- **The search box** applies 300 ms after the last keystroke via a timer (not `useDebouncedValue`), and every URL change is a functional `setSearchParams` update, so a late search never undoes a status change. When `q` changes in the URL by itself (Clear filters, Back), the box follows it, unless that `q` is what's being typed.
- **Headings:** the Tasks and Comments sections keep an `h2` for screen readers (`sr-only`); the tab is the visible heading. `ProgramComments`' heading became `sr-only` for this.
- `formatCalendarDate` and `calendarDateFormat` moved to `src/lib/dates.ts`; `programs/programDates.ts` keeps only `formatProgramDates`.

## Testing notes

- `ASSIGNEE_NOT_FOUND`: open the dialog, pick someone, deactivate them in another tab (People → Edit, as ADMIN), then submit.
- A `DEPENDENT` task for the status filter needs a blocker: `POST /programs/{id}/tasks/{ref}/dependencies` with curl until the dependencies UI exists.

## Out of scope / follow-ups

- **Task page** (`/programs/{id}/tasks/{taskRef}`): view and edit a task, change status (`TASK_BLOCKED` / `DEPENDENT` rules), delete (ADMIN, MANAGER or the reporter), task comments. Rows become links then.
- **Blockers** (`dependsOn` on create, `POST`/`DELETE …/dependencies`) and the cycle and limit errors.
- Priority, type, assignee ("Assigned to me", unassigned), reporter, label and due-date filters, and sorting (`GET …/tasks` supports all of them).
- Label autocomplete from `GET /programs/{id}/labels`.
- A board view, and a "My tasks" page across programs.
