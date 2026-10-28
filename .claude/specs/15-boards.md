# 15 — Boards (task boards, one URL per task, report scope)

**Status:** Blocked on backend. The contract has no boards, and every task operation sits under `/programs/{programId}`. The proposal below went to the backend on 2026-10-28 and was revised the same day.
**Branch:** `boards`
**Depends on:** [07-programs](./07-programs.md) (Programs page, dialog and page patterns, key suggestion), [08-tasks](./08-tasks.md) (task list, `CreateTaskDialog`, `searchParams.ts`), [10-task-page](./10-task-page.md) / [11-blockers-and-comment-editing](./11-blockers-and-comment-editing.md) (task page, blockers, task comments), [13-program-status-filter](./13-program-status-filter.md) (filter row pattern), [14-overview](./14-overview.md) (Overview page, `localToday`, `isCalendarDate`)

## Goal

A **board** is a lightweight place to collect tasks. It works like a program but has less: a **key**, a **name** (the topic), an optional **description** and its tasks. It has no status, no start or end dates, no owner team and **no board-level comments**.

1. **Boards in the sidebar**, below Programs, for every role.
2. **Boards page (`/boards`)**: every active board, newest first, paginated. **Create board** for ADMIN and MANAGER.
3. **Board page (`/boards/:boardId`)**:
   - Name and description, both editable in place by ADMIN and MANAGER.
   - A Details card.
   - **Delete board** for ADMIN.
   - The board's **task list**: search, status, the new **Created** filter (All time / Last 7 days / Last 30 days), 20 per page with Previous/Next, and **Create task** for every role.
4. **Every task has exactly one parent**, a program or a board. Tasks with no parent are left out for now.
5. **One URL per task.** `/tasks/:taskRef` (a key such as `PRO-50`, or the id) opens any task, whichever program or board it's in. Old `/programs/:programId/tasks/:taskRef` links redirect there.
6. **Overview "Show" filter**: **All** (default), **Programs** or **Boards**.
   - All combines every task.
   - Boards hides the program-only sections and shows a **Board report** in place of the Program report.

**Decisions (asked 2026-10-28):**

| Question | Choice |
|---|---|
| Who manages boards | Same as programs: ADMIN and MANAGER create and edit, ADMIN deletes. Every role works with the tasks on a board |
| "Last 7 days" means | When the task was **created**. Presets: All time (default), Last 7 days, Last 30 days |
| Board keys | A board has its own immutable key, like a program. A board **may use the same key as a program** (`PRO` for both) |
| Task numbers | **One global counter across all tasks**, so every new task takes the next number wherever it is. Numbers jump within a key (`MKT-1`, `PRO-2`, `MKT-3`), and a full key such as `PRO-50` is unique across FlowDesk even when a program and a board share `PRO` |
| Comments | Only board-level comments go. Board tasks keep task comments and @mentions |
| Tasks with no parent | Not now. Every task is in a program or a board |
| Task URL | `/tasks/:taskRef` for every task. Old program task URLs redirect. The frontend makes every single-task call through `/tasks/{taskRef}` |
| Blockers | Same parent only: blockers come from the same program, or the same board |
| Overview with Boards | Program-only sections hide and a Board report table appears |
| Board key uniqueness | **Unique among boards**, as program keys are among programs. A program and a board may share one (confirmed) |
| Existing tasks | **Keep their keys.** The global counter starts at the highest existing number + 1, so new keys can't collide with old ones. New tasks in an existing program skip numbers (MKT-7, then perhaps MKT-213) (confirmed) |
| Task types | **Generalised** so they read for programs and boards alike (see "Task changes") (confirmed) |

Default I picked (not asked): **All** on the Overview shows both the Program report and the Board report.

## History

This spec starts like [14-overview](./14-overview.md) did: a frontend design plus a contract proposal. Once the backend ships:

1. Run `npm run api:types`.
2. Update the "Contract proposal" section to match **the shipped contract**, with a "Differences from the proposal" note.
3. Only then implement.

Until then nothing here is built, and nothing works around the missing API: no client-side "board" grouping, and no hidden program used to hold board tasks.

## Flow

```
Browser (ADMIN / MANAGER)                                 FlowDesk API
  │ 1. /boards → Create board: name "Ops weekly", key PRO       │
  │    POST /boards { name, key, description }                  │
  │<────────────────────────────────────────────────────────────│ 201 { data: Board }  (409 BOARD_KEY_EXISTS:
  │                                                              │   another *board* has PRO)
  │ 2. open /boards/{boardId}                                   │
  │    GET /boards/{boardId}                                    │
  │    GET /boards/{boardId}/tasks?limit=20&offset=0            │
  │<────────────────────────────────────────────────────────────│ 200 Board, 200 { data: Task[], meta }

Browser (any role)
  │ 3. Created: Last 7 days → URL ?created=7d (offset dropped)  │
  │    GET /boards/{boardId}/tasks?createdFrom=2026-10-22&limit=20&offset=0
  │ 4. Next → ?created=7d&offset=20 (same createdFrom)           │
  │ 5. Create task → POST /boards/{boardId}/tasks { …fields }   │
  │<────────────────────────────────────────────────────────────│ 201 { data: TaskDetail }  key PRO-50
  │ 6. open PRO-50 → /tasks/PRO-50                              │
  │    GET /tasks/PRO-50, GET /tasks/{id}/comments               │
  │ 7. old link /programs/{id}/tasks/MKT-7 → redirect /tasks/MKT-7
  │ 8. /overview?scope=boards                                   │
  │    GET /reports/overview?from&to&scope=boards               │
  │<────────────────────────────────────────────────────────────│ 200 report (boards[] filled, programs[] empty)
```

**Lists and create** stay nested by parent: `/programs/{programId}/tasks` as today, and the new `/boards/{boardId}/tasks`. **One task** is addressed only by `taskRef`, through `/tasks/{taskRef}…`. This works because the global counter makes every key unique without its parent. The program-nested single-task routes can stay in the backend for compatibility, but the frontend stops using them.

## Packages

None new.

## Contract proposal (pending the backend)

> Proposed names. The backend decides the final shape. Anything that differs gets recorded here before implementation starts.

### `Board`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `createdAt`, `updatedAt` | date-time | |
| `isActive` | boolean | false once soft-deleted |
| `key` | string | Prefix of the board's task keys. Same rules as a program key: trimmed and uppercased, then 2–10 letters or digits starting with a letter. **Unique among boards**, soft-deleted ones included. **May equal a program's key**. Immutable |
| `name` | string | Trimmed, 1–150 characters |
| `description` | string \| null | At most 10,000 characters |

### Board operations

| Operation | Roles | Responses |
|---|---|---|
| `GET /boards?limit&offset` | any active employee | 200 `{ data: Board[], meta }` newest first; 400 validation; 401 |
| `POST /boards` `{ name, key, description? }` | ADMIN, MANAGER | 201 `{ data: Board }`; 400 validation (`details[].path`: `name`, `key`, `description`); 401; 403 `FORBIDDEN`; 409 `BOARD_KEY_EXISTS` (another board has the key) |
| `GET /boards/{boardId}` | any active employee | 200; 400 non-UUID; 401; 404 unknown or deleted |
| `PATCH /boards/{boardId}` `{ name?, description? }` | ADMIN, MANAGER | 200 `{ data: Board }`; 400 validation (`key` can't be changed); 401; 403; 404 |
| `DELETE /boards/{boardId}` | ADMIN | 204; 401; 403; 404. A soft delete: the board, its tasks and their comments answer 404 afterwards. Its key stays taken among boards, and its task numbers are never reused |
| `GET /boards/{boardId}/tasks` | any active employee | The same filters, sort, paging and responses as `GET /programs/{programId}/tasks`, plus `createdFrom` / `createdTo`. 404 for an unknown or deleted board |
| `POST /boards/{boardId}/tasks` | any active employee | `CreateTaskRequest`, with the same rules and codes as the program route. 404 for an unknown or deleted board |

### Task changes

- `Task` / `TaskDetail`: `programId` becomes `uuid | null`, and `boardId: uuid | null` is added. **Exactly one is set.** The parent is set at creation and **can't change**.
- **`number` comes from one global counter**: every new task, in any program or board, takes the next value. `key` is `<parent key>-<number>`. Existing tasks keep their numbers, and the counter starts above the highest existing one, so keys stay unique across FlowDesk even when a program and a board share a key. Numbers are never reused. Sorting by `number` still means newest first.
- **Dependencies stay within one parent**: same program or same board. Otherwise the response is 400 `DEPENDENCY_OTHER_PARENT` (or `DEPENDENCY_OTHER_PROGRAM` generalised; the backend picks).
- **`TaskType` description generalised.** Today it says PRE is "prerequisite work before the program starts" and POST is "work after the program ends", which doesn't fit a board, since boards have no dates. Proposed wording:
  - PRE: prerequisite work before the main work starts.
  - TASK: the main work (default).
  - POST: follow-up work after the main work is done.
  - BUG: something broken to fix.
  - ISSUE: a problem, risk or question to resolve.

  The rest is unchanged: the type is informational, doesn't affect status, dependencies or the parent, and sorts PRE < TASK < POST < BUG < ISSUE. The enum doesn't change. The frontend shows only the labels (`Pre`, `Task`, `Post`, `Bug`, `Issue` in `taskDisplay.ts`), which have no program wording, so no UI change is needed. If a type hint is added to the type select later, it uses the backend's wording.

### Single-task operations by `taskRef` (every task)

`taskRef` is the task's UUID or its key, case-insensitive. These routes behave like the program-nested ones (same bodies, rules, roles and codes) for **any** task, in a program or a board.

| Operation | Notes |
|---|---|
| `GET /tasks/{taskRef}` | `TaskDetail`. 404 when unknown, deleted, or its program or board is deleted |
| `PATCH /tasks/{taskRef}` | `UpdateTaskRequest`. No `programId` / `boardId`, because the parent is fixed |
| `DELETE /tasks/{taskRef}` | ADMIN, MANAGER or the reporter; 403 otherwise |
| `POST /tasks/{taskRef}/dependencies`, `DELETE /tasks/{taskRef}/dependencies/{dependsOnTaskId}` | Plus the same-parent rule |
| `GET` / `POST /tasks/{taskRef}/comments` | Same threading, replies and mentions as today's task comments |
| `PATCH` / `DELETE /tasks/{taskRef}/comments/{commentId}` | Edit: author only. Delete: ADMIN, MANAGER, author. Today's task comments are edited through `/programs/{programId}/comments/{commentId}`, which can't serve board tasks |

Program-level comments stay at `/programs/{programId}/comments…`. Boards have none.

### Created-date filter

`createdFrom` / `createdTo`: `YYYY-MM-DD`, compared with the UTC calendar date of `createdAt`, both inclusive. `createdFrom` must be on or before `createdTo` (400 otherwise). Added to **both** `GET /programs/{programId}/tasks` and `GET /boards/{boardId}/tasks`.

### Overview report (`GET /reports/overview`)

- New query param **`scope`**: `all` (default), `programs` or `boards`.
- Every task count (`tasksCreated*`, `tasksCompleted*`, `trend`, `tasksByStatus`, `openTasksByPriority`, on-time, overdue) covers tasks **in that scope**. `all` covers program tasks and board tasks combined.
- Board tasks are always in scope, since boards have no status or end date. Program tasks follow today's in-scope rule.
- Program-only numbers (`programsByStatus`, programs running and completed, at-risk, `teams[]`, `programs[]`) cover programs only. `teams[]` stays per owner team, so board tasks aren't in it. Under `scope=boards` these can be zero or empty, or omitted; the backend picks and documents it.
- New **`boards[]`**: one row per board with tasks in scope, for example `{ boardId, key, name, tasksTotal, tasksDone, tasksCompletedInPeriod, openTasks, overdueTasks }`, ordered by overdue tasks (desc) then name. It's empty under `scope=programs`.

## Folder layout (new and changed)

```
src/
  api/schema.d.ts                       REGENERATED  Board, /boards…, /tasks/{taskRef}…, Task.boardId, createdFrom/To, report scope + boards[]
  api/errors.ts                         CHANGED  BOARD_KEY_EXISTS, DEPENDENCY_OTHER_PARENT
  lib/dates.ts                          CHANGED  + localToday, isCalendarDate (moved from overview/period.ts), shiftCalendarDate(date, days)
  lib/keys.ts                           NEW      suggestKey(name) (moved from programs/programKey.ts, same behaviour) + keys.test.ts
  components/layout/navItems.ts         CHANGED  Boards (SquareKanban) below Programs
  routes/paths.ts                       CHANGED  boards, board, task → '/tasks/:taskRef', legacyProgramTask; boardPath(), taskPath(taskRef)
  routes/router.tsx                     CHANGED  /boards, /boards/:boardId, /tasks/:taskRef; legacy route → LegacyTaskRedirect
  routes/LegacyTaskRedirect.tsx         NEW      /programs/:programId/tasks/:taskRef → /tasks/:taskRef (replace, keeps ?search and #hash)
  features/programs/programKey.ts       REMOVED  (→ lib/keys.ts)
  features/programs/components/CreateProgramDialog.tsx  CHANGED  suggestKey; key hint no longer promises MR-1, MR-2…
  features/programs/pages/ProgramPage.tsx  CHANGED  <TaskListSection parent={{ kind: 'program', programId }} … />
  features/boards/                      NEW
    index.ts                            exports useBoard only (a leaf: no cycle with tasks)
    types.ts                            Board, BoardList, BoardListParams, CreateBoardRequest, UpdateBoardRequest aliases
    api.ts                              boardKeys, useBoards, useBoard, useCreateBoard, useUpdateBoard, useDeleteBoard
    boardSchema.ts                      zod: name 1–150, key 2–10 /^[A-Z][A-Z0-9]*$/, description ≤ 10,000
    searchParams.ts                     BoardSearch { offset }: parse / toSearchParams / toListParams
    components/CreateBoardDialog.tsx    name, key (suggested, prefix preview, can't-change hint), description
    components/BoardTable.tsx           key badge, name link + description, created; skeleton rows
    components/BoardFieldEditor.tsx     inline name / description (useInlineEdit, like ProgramFieldEditor)
    components/DeleteBoardButton.tsx    ConfirmDeleteDialog; ADMIN only
    pages/BoardsPage.tsx, pages/BoardPage.tsx
    boards.test.tsx, boardPage.test.tsx, searchParams.test.ts
  features/tasks/
    taskParent.ts                       NEW      TaskParent, taskParentOf(task)
    api.ts                              CHANGED  lists/create take a TaskParent; one-task hooks take only taskRef (/tasks/{taskRef}…)
    searchParams.ts                     CHANGED  TaskSearch.created; toTaskListParams(search, today)
    components/TaskListSection.tsx      RENAMED from ProgramTasks.tsx; takes { parent, parentName }
    components/TaskFilters.tsx          CHANGED  Created select
    components/CreateTaskDialog.tsx     CHANGED  takes parent + parentName
    components/TaskTable.tsx, TaskDependencies.tsx  CHANGED  links with taskPath(task.key)
    components/AddBlocker.tsx           CHANGED  searches taskParentOf(task)
    components/TaskOptionMenu.tsx, TaskStatusMenu.tsx, TaskAssigneeEditor.tsx, TaskFieldEditor.tsx  CHANGED  useUpdateTask(taskRef)
    components/DeleteTaskButton.tsx     CHANGED  navigates back to the task's program or board
    pages/TaskPage.tsx                  CHANGED  /tasks/:taskRef; back link and a Program/Board detail row by parent
    index.ts                            CHANGED  exports TaskListSection (was ProgramTasks)
  features/comments/
    api.ts                              CHANGED  CommentTarget = { programId } | { taskId }; task comments via /tasks/{taskRef}/comments…
    components/TaskComments.tsx         CHANGED  takes taskId only
  features/overview/
    period.ts                           CHANGED  imports localToday / isCalendarDate from lib/dates
    scope.ts                            NEW      REPORT_SCOPES, parseScope / URL ?scope=programs|boards (all left out)
    components/PeriodFilter.tsx         CHANGED  "Show" select (All / Programs / Boards) beside the period
    components/BoardReportTable.tsx     NEW      per-board rows
    pages/OverviewPage.tsx              CHANGED  sends scope; shows sections by scope
  test fixtures                         CHANGED  boardId: null on tasks; task routes move to /tasks/{taskRef}
```

Request flow and layering are unchanged: page → feature hook → `apiClient`. Imports between features:

- `boards` imports `@/features/tasks` for `TaskListSection`.
- `tasks` imports `@/features/boards` for `useBoard` (the task page's back link) and `@/features/programs` (as today).
- `boards/index.ts` exports only `useBoard`, which imports nothing from `tasks`, so there's no cycle. That's the same rule `programs/index.ts` follows. The router imports `BoardsPage` and `BoardPage` by path.

## Tasks by parent (`features/tasks`)

```ts
type TaskParent = { kind: 'program'; programId: string } | { kind: 'board'; boardId: string }
taskParentOf(task)   // from task.programId / task.boardId (exactly one is set)
```

| Call | Program parent | Board parent |
|---|---|---|
| list (`useParentTasks(parent, params)`, `useTaskSearch(parent, q)`) | `GET /programs/{programId}/tasks` | `GET /boards/{boardId}/tasks` |
| create (`useCreateTask(parent)`) | `POST /programs/{programId}/tasks` | `POST /boards/{boardId}/tasks` |
| one task: `useTask`, `useUpdateTask`, `useAddBlocker`, `useRemoveBlocker`, `useDeleteTask` (taskRef only) | `/tasks/{taskRef}…` | `/tasks/{taskRef}…` |

Query keys:

```ts
taskKeys.parent(parent)              // ['tasks', 'program', id] | ['tasks', 'board', id]
taskKeys.lists(parent), taskKeys.list(parent, params)
taskKeys.details()                   // ['tasks', 'detail']
taskKeys.detail(taskRef)             // taskRef as in the URL (key or id)
```

- After a save, `useTaskSaved` sets the detail, invalidates `taskKeys.lists(taskParentOf(savedTask))`, and marks other details stale. That's today's behaviour, scoped by the saved task's own parent.
- `useDeleteTask(task)` removes the lists of `taskParentOf(task)`.
- The blocker picker searches `taskParentOf(task)`, the only parent the server accepts for blockers.

## URL state

| Page | Params | Notes |
|---|---|---|
| `/boards` | `offset` | Like `/programs` before its status filter |
| `/boards/:boardId` | `q`, `status`, `created`, `offset` | `TaskSearch`; no `tab` |
| program page | `tab`, `q`, `status`, `created`, `offset` | `created` is new |
| `/tasks/:taskRef` | none | |
| `/overview` | `period`, `from`, `to`, `scope` | `scope` is new; `all` is left out |

`TaskSearch` gains `created?: '7d' | '30d'`. As with the other filters, an invalid value (`?created=yesterday`) is ignored and leaving it out means All time. `toTaskListParams(search, today)` sends:

| `created` | Sent |
|---|---|
| (none) | nothing |
| `7d` | `createdFrom = shiftCalendarDate(today, -6)` (today and the 6 days before) |
| `30d` | `createdFrom = shiftCalendarDate(today, -29)` |

There's no `createdTo`, so tasks created later today still show up. `today` is `localToday()`, the browser's calendar date, as on the Overview. The server compares UTC dates, so near midnight the window can be off by a day, the same caveat as spec 14. Changing the filter drops `offset`, and paging keeps the filter.

## Boards page (`/boards`)

- `PageHeader` "Boards", description "Lightweight lists of tasks, without dates or status." Actions: **Create board** for ADMIN and MANAGER (hidden for MEMBER via `useHasRole`).
- `BoardTable` with columns Key (`KeyBadge`), Name (link to the board, description in muted text below, two lines at most) and Created. Pagination is 20 per page.
- States:
  - pending: skeleton rows.
  - error: `ErrorState` with retry.
  - empty: "No boards yet", plus Create board when the role allows it.
  - past the end: "This page is empty" with Go to first page.
  - Paging keeps previous rows dimmed (`keepPreviousData`, `busy`).
- After creating a board, the page navigates to the new board's page.

## Create board dialog

- **Name** (required) and **Key** (required), with the `CreateProgramDialog` key field rules:
  - The key is suggested from the name with `suggestKey` until the user edits it, and uppercased as you type.
  - Hint: "Task keys will start with PRO-. The key can't be changed later." Numbers are global now, so the hint doesn't promise `PRO-1`. `CreateProgramDialog` gets the same wording.
- **Description** (optional).
- The form is inside `DialogBody`. zod gives instant feedback, and `applyServerErrors` maps server `details` onto fields.
- Errors:
  - 409 `BOARD_KEY_EXISTS`: shown on the Key field.
  - 403: `FormErrorAlert` "You don't have permission to create boards."
  - 5xx: form-level error, with the dialog left open.
- Submit is disabled while the request is pending. A success toast reads "Board PRO created".

## Board page (`/boards/:boardId`)

```
← Boards
[PRO] Ops weekly                                   (name editable in place)
Description (editable in place, "Add a description")
┌ Tasks ─────────────────────────────────┐  ┌ Details ─────────┐
│ [Search] Status [▾] Created [Last 7 ▾] │  │ Key     PRO      │
│                         [Create task]  │  │ Created 28 Oct…  │
│ table …                                │  │ Updated …        │
│ ‹ Previous   1–20 of 43   Next ›       │  │ [Delete board]   │
└────────────────────────────────────────┘  └──────────────────┘
```

- Same two-column grid as the program page. The main column is `<TaskListSection parent={{ kind: 'board', boardId }} parentName={board.name} />`, and the side column is the Details card.
- Inline edit of name and description: ADMIN and MANAGER only. `PATCH` sends just the edited field. On 403 the edit is closed and a toast says "You don't have permission to edit boards". On 404 the board is refetched and the page shows Not found.
- **Delete board** (ADMIN): `ConfirmDeleteDialog` "Delete Ops weekly? Its tasks and their comments will be deleted too." On success the page navigates to `/boards` with a toast. 403 gives a toast and 404 refetches.
- States: skeleton while loading, `NotFoundState` "Board not found" on 404 or a non-UUID id (400), and `ErrorState` with retry on 5xx.

## Task list (`TaskListSection`)

It's the current `ProgramTasks` with three changes:

- It takes a `parent` and `parentName`.
- `TaskFilters` shows a **Created** select (`w-40`) with All time, Last 7 days and Last 30 days. It appears on the program Tasks tab too.
- The filtered empty state counts `created` as a filter, so "No tasks match these filters" comes with Clear filters, which clears `q`, `status` and `created`.

The empty-state copy is "Add the first task to plan the work." for a program (unchanged) and "Add the first task to this board." for a board.

## Task page (`/tasks/:taskRef`)

- It loads `GET /tasks/{taskRef}` for any task. The back link goes to the parent: the program (name from `useProgram`) or the board (name from `useBoard`).
- The Details card gains a **Program** or **Board** row that links to the parent.
- Inline edits, status, assignee, blockers, delete and comments all go through `/tasks/{taskRef}…`. Delete goes back to the parent.
- The skeleton shows a generic back-link placeholder, because the parent is only known once the task loads.
- **Old links:** `/programs/:programId/tasks/:taskRef` renders `LegacyTaskRedirect`, which does `<Navigate to={taskPath(taskRef)} replace />`. `taskRef` wins even if `programId` is wrong, and the page then shows the real parent.
- `DEPENDENCY_OTHER_PARENT` can't normally happen, because the picker only lists tasks with the same parent. If it does, the server's message is shown, the same treatment `DEPENDENCY_OTHER_PROGRAM` gets today.

## Overview (`?scope=`)

The filter row gets a **Show** select (`w-36`): All, Programs, Boards. Changing it keeps the period. It's sent as `scope`, and `all` is left out of the URL.

| Section | All | Programs | Boards |
|---|---|---|---|
| Programs running / Programs completed tiles | ✓ | ✓ | hidden |
| Tasks created / completed, On-time, Overdue now tiles | ✓ all tasks | ✓ | ✓ |
| Overdue tile's "N programs at risk" | ✓ | ✓ | hidden ("N open" only) |
| Programs by status | ✓ | ✓ | hidden |
| Tasks by status, Trend, Open tasks by priority | ✓ | ✓ | ✓ |
| By team (owner teams, program tasks only) | ✓ | ✓ | hidden |
| Program report | ✓ | ✓ | hidden |
| **Board report** | ✓ | hidden | ✓ |

- The stat tile grid drops to `xl:grid-cols-4` when only four tiles show.
- Under All, the By team card's description says it counts program tasks only.
- **Board report** (`BoardReportTable`) has these columns: key + name (links to the board), progress meter with "done/total" (same meter as the Program report), done in period, open, and overdue (warning icon when above 0). Rows come in server order. It shows the first 10 rows with Show all, like the Program report. Empty: "No board tasks in this period".
- The numbers are rendered as returned and never recomputed.

## Errors (`src/api/errors.ts`)

| Code | Status | Message |
|---|---|---|
| `BOARD_KEY_EXISTS` | 409 | "Another board already uses this key. Keys of deleted boards stay taken too, so pick a different one." |
| `DEPENDENCY_OTHER_PARENT` | 400 | `null` (server message), like `DEPENDENCY_OTHER_PROGRAM` |

The final codes follow the shipped contract.

## Tests (Vitest + MSW + RTL)

| File | Case | Expect |
|---|---|---|
| `lib/keys.test.ts` | the existing `programKey` cases | same results from `suggestKey` |
| `boards/searchParams.test.ts` | `?offset=20`, `?offset=-1` | parsed / ignored |
| `boards/boards.test.tsx` | list, paging, empty (ADMIN vs MEMBER) | rows; Create board only for ADMIN/MANAGER |
| | create: suggested key, 409 `BOARD_KEY_EXISTS`, 400 details, 403 | field / form errors; success navigates to the board |
| `boards/boardPage.test.tsx` | board + tasks | `GET /boards/{id}/tasks?limit=20&offset=0` |
| | Created: Last 7 days (today mocked 2026-10-28) | URL `?created=7d`; request `createdFrom=2026-10-22`; Next keeps it |
| | `?created=bogus` | ignored, no `createdFrom` |
| | create a board task | `POST /boards/{id}/tasks`; list refetches |
| | edit name (MANAGER), 403 on a forced edit, delete (ADMIN), 404 | toasts / Not found |
| `tasks/taskPage.test.tsx` | `/tasks/PRO-50` (board task), `/tasks/MKT-7` (program task) | `GET /tasks/{ref}`; back link and detail row to board / program |
| | `/programs/{id}/tasks/MKT-7` | replaced by `/tasks/MKT-7` |
| | add blocker on a board task | picker searches `GET /boards/{id}/tasks?q=` |
| | comment edit on a board task | `PATCH /tasks/{id}/comments/{commentId}` |
| `tasks/tasks.test.tsx` | program Tasks tab, Created filter | `createdFrom` on the program route |
| `overview/overview.test.tsx` | Show: Boards | `scope=boards`; program sections hidden; Board report shown |
| | Show: Programs; default All | no Board report / both reports |
| existing program, task and comment tests | same behaviour, new routes | pass after fixtures move to `/tasks/{taskRef}` and gain `boardId: null` |

## Acceptance checklist

- [ ] Backend shipped boards, `/boards/{id}/tasks`, `/tasks/{taskRef}…`, `Task.boardId`, the global task counter, `createdFrom`/`createdTo`, and report `scope` + `boards[]`. `npm run api:types` re-run, and this spec updated to the shipped contract
- [ ] Boards page: list, paging, empty states, Create board hidden for MEMBER; 403 handled when forced
- [ ] Create board: key suggestion, prefix hint, 400 details on fields, 409 `BOARD_KEY_EXISTS` on Key; a key equal to a program's key is accepted
- [ ] Board page: inline name and description (ADMIN/MANAGER), delete (ADMIN), 404 → Not found, 5xx → retry
- [ ] Board tasks: list, search, status, **Created (Last 7 / Last 30 days)**, Previous/Next keep filters, Back undoes a change
- [ ] Program `PRO` and board `PRO` both create tasks; keys never collide (for example PRO-49 in the program, PRO-50 on the board)
- [ ] `/tasks/<key>` and `/tasks/<uuid>` open any task; old program task links redirect
- [ ] Task page for a board task: edits, blockers (same board only), delete (reporter / ADMIN / MANAGER; 403 for others), comments and @mentions
- [ ] Overview: All / Programs / Boards show the sections in the table above; numbers come from the server
- [ ] CLAUDE.md updated: role matrix rows (create/update board ADMIN+MANAGER, delete board ADMIN), Known contract facts (boards, global task numbers, `/tasks/{taskRef}`, `createdFrom`, report `scope`), folder layout (`features/boards`)
- [ ] `npm run build`, `npm run lint`, `npm test` pass

## Testing notes

- With the backend running: create program `PRO` and board `PRO`, then add tasks to each in turn and check the keys. Sign in as a MEMBER and check that Create board, edit and delete are hidden. Force a `PATCH` from the console to see the 403 handling.
- To check "Last 7 days" without waiting a week, backdate a task's `createdAt` in the backend DB, or mock today in the tests (`vi.setSystemTime`).

## Out of scope / follow-ups

- **Tasks with no parent** (dropped 2026-10-28). They'd need a list route, a page and a create path.
- **Moving a task** between a program and a board. The key prefix would change. The global number would stay unique, but links to the old key would break.
- Blockers across programs and boards.
- Board-level comments (decided against).
- An "all tasks" or "My tasks" view across every parent.
- Board search (`q`) and a board picker, which are useful once tasks can move.
- Board labels endpoint (programs have `GET /programs/{programId}/labels`, which the UI doesn't use yet either).
- Owner team, status or dates on boards, which would let boards appear in By team and at-risk.
