# 15 — Boards (task boards, one URL per task, report scope)

**Status:** Implemented 2026-10-28 against backend commit `640f27a` ("Add boards, global task numbers and /tasks/{taskRef} routes"). The backend server wasn't running, so `schema.d.ts` was generated from the same OpenAPI document built from the backend source (`buildOpenApiDocument()`), and every case below is checked with MSW tests against that contract. **Not yet checked against the running backend** (see Testing notes).
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

This spec started like [14-overview](./14-overview.md) did: a frontend design plus a contract proposal, sent to the backend on 2026-10-28. The backend shipped it the same day; the "Contract" section below is the **shipped** contract, with the differences from the proposal listed first. The sections after it describe what was built.

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

## Contract (shipped 2026-10-28)

### Differences from the proposal

1. **`Task.parent`** (on `Task` and `TaskDetail`): `{ type: 'PROGRAM' | 'BOARD', id, key, name, isActive }`, next to `programId` / `boardId`. The task page takes its back link and its Program/Board row from it, so it calls neither `useProgram` nor `useBoard`, `tasks` imports neither feature, and **`boards` has no `index.ts`** (nothing outside it needs one).
2. **Deleting a board hides only the board.** Its page, task list, labels and task creation answer 404, but its tasks **stay live** at `/tasks/{taskRef}` (fetch, edit, link, comment, delete), with `parent.isActive: false`, and keep counting in the report (without a `boards[]` row). The proposal had them 404. A deleted **program**'s tasks are still 404.
3. **`DEPENDENCY_OTHER_PARENT`** replaces `DEPENDENCY_OTHER_PROGRAM`, which is gone from the contract.
4. `GET /boards` also takes `q` (name or key substring, 1–100). Not used yet.
5. `GET /boards/{boardId}/labels` exists, like the program one. Not used yet.
6. `BoardReportRow` is `{ id, key, name, tasksTotal, tasksDone, tasksCompletedInPeriod, openTasks, overdueTasks }` (`id`, not `boardId`). `boards[]` lists **every active board with at least one live task, whatever the period** (boards never close), ordered by `overdueTasks` desc, then name, then id.
7. Under `scope=boards` the program-only numbers are **0 / empty**; the response shape never changes.
8. `Comment` / `CommentReply` gain `boardId`; `programId` is null on a board task's comment.
9. `PATCH /boards/{boardId}` rejects `key` and any unknown field (400), and needs at least one field.
10. The program-nested single-task and task-comment routes stay; the frontend no longer calls them.

The `TaskType` wording was generalised as proposed.

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
| `GET /boards?q&limit&offset` | any active employee | 200 `{ data: Board[], meta }` newest first; 400 validation; 401 |
| `POST /boards` `{ name, key, description? }` | ADMIN, MANAGER | 201 `{ data: Board }`; 400 validation (`details[].path`: `name`, `key`, `description`); 401; 403 `FORBIDDEN`; 409 `BOARD_KEY_EXISTS` (another board has the key) |
| `GET /boards/{boardId}` | any active employee | 200; 400 non-UUID; 401; 404 unknown or deleted |
| `PATCH /boards/{boardId}` `{ name?, description? }` | ADMIN, MANAGER | 200 `{ data: Board }`; 400 validation (`key` can't be changed); 401; 403; 404 |
| `DELETE /boards/{boardId}` | ADMIN | 204; 400 non-UUID; 401; 403; 404. A soft delete of the board only: its page, task list, labels and task creation answer 404 afterwards, but its tasks stay live through `/tasks/{taskRef}` (`parent.isActive: false`) and still count in the report. Its key stays taken among boards. No restore endpoint |
| `GET /boards/{boardId}/labels` | any active employee | 200 `{ data: { label, taskCount }[] }`; 400; 401; 404 |
| `GET /boards/{boardId}/tasks` | any active employee | The same filters, sort, paging and responses as `GET /programs/{programId}/tasks`, plus `createdFrom` / `createdTo`. 404 for an unknown or deleted board |
| `POST /boards/{boardId}/tasks` | any active employee | `CreateTaskRequest`, with the same rules and codes as the program route. 404 for an unknown or deleted board |

### Task changes

- `Task` / `TaskDetail`: `programId` becomes `uuid | null`, and `boardId: uuid | null` is added. **Exactly one is set.** The parent is set at creation and **can't change**. Both also carry `parent: { type, id, key, name, isActive }`.
- **`number` comes from one global counter**: every new task, in any program or board, takes the next value. `key` is `<parent key>-<number>`. Existing tasks keep their numbers, and the counter starts above the highest existing one, so keys stay unique across FlowDesk even when a program and a board share a key. Numbers are never reused. Sorting by `number` still means newest first.
- **Dependencies stay within one parent**: same program or same board. Otherwise the response is 400 `DEPENDENCY_OTHER_PARENT`.
- **`TaskType` description generalised** (shipped as proposed). It used to say PRE is "prerequisite work before the program starts" and POST is "work after the program ends", which doesn't fit a board, since boards have no dates. The wording:
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
| `GET /tasks/{taskRef}` | `TaskDetail`. 404 when unknown, deleted, or its program is deleted. A task on a deleted board is still found (`parent.isActive: false`) |
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
- Program-only numbers (`programsByStatus`, programs running and completed, at-risk, `teams[]`, `programs[]`) cover programs only. `teams[]` stays per owner team, so board tasks aren't in it. Under `scope=boards` they're **0 / empty** (the shape never changes).
- Board tasks count even on a soft-deleted board; only that board's row is missing.
- New **`boards[]`**: `{ id, key, name, tasksTotal, tasksDone, tasksCompletedInPeriod, openTasks, overdueTasks }`, one row per active board with at least one live task, whatever the period. Ordered by overdue tasks (desc), then name, then id. It's empty under `scope=programs`.

## Folder layout (new and changed)

```
src/
  api/schema.d.ts                       REGENERATED  Board, /boards…, /tasks/{taskRef}…, Task.boardId + parent, createdFrom/To, report scope + boards[]
  api/errors.ts                         CHANGED  + BOARD_KEY_EXISTS; DEPENDENCY_OTHER_PROGRAM → DEPENDENCY_OTHER_PARENT
  lib/dates.ts                          CHANGED  + toIsoDate, isCalendarDate, localToday (moved from overview/period.ts), shiftCalendarDate(date, days) + dates.test.ts
  lib/keys.ts                           NEW      KEY_PATTERN, keySchema (zod), suggestKey(name) (was programs/programKey.ts), keyHint(key) + keys.test.ts
  components/data/KeyBadge.tsx          CHANGED  kind="board" (violet-700, white text)
  components/layout/navItems.ts         CHANGED  Boards (SquareKanban) below Programs
  routes/paths.ts                       CHANGED  boards, board, task → '/tasks/:taskRef', legacyProgramTask; boardPath(), taskPath(taskRef)
  routes/router.tsx                     CHANGED  /boards, /boards/:boardId, /tasks/:taskRef; legacy route → LegacyTaskRedirect
  routes/LegacyTaskRedirect.tsx         NEW      /programs/:programId/tasks/:taskRef → /tasks/:taskRef (replace, keeps ?search and #hash)
  features/programs/programKey.ts       REMOVED  (→ lib/keys.ts)
  features/programs/programSchema.ts    CHANGED  key: keySchema
  features/programs/index.ts            CHANGED  no longer exports useProgram (its only outside user was the task page)
  features/programs/components/CreateProgramDialog.tsx  CHANGED  suggestKey, keyHint; hint and toast no longer promise MR-1, MR-2…
  features/programs/pages/ProgramPage.tsx  CHANGED  <TaskListSection parent={{ type: 'PROGRAM', id }} parentName headingHidden />
  features/boards/                      NEW      (no index.ts: nothing outside the feature imports it; the router imports the pages by path)
    types.ts                            Board, BoardList, BoardListParams, CreateBoardRequest, UpdateBoardRequest aliases
    api.ts                              boardKeys, useBoards, useBoard, useCreateBoard, useUpdateBoard, useDeleteBoard
    boardSchema.ts                      zod: name 1–150, key (keySchema), description ≤ 10,000
    searchParams.ts                     BoardSearch { offset }: parse / toSearchParams / toListParams
    components/CreateBoardDialog.tsx    name, key (suggested, uppercased, prefix hint), description; opens the new board
    components/BoardGrid.tsx            board cards (key, name link, description, created): 1 column, 2 from lg; skeleton cards
    components/BoardFieldEditor.tsx     inline name / description (useInlineEdit, like ProgramFieldEditor)
    components/DeleteBoardButton.tsx    ConfirmDeleteDialog; ADMIN only
    pages/BoardsPage.tsx, pages/BoardPage.tsx
    boards.test.tsx, boardPage.test.tsx, searchParams.test.ts
  features/tasks/
    types.ts                            CHANGED  + TaskParent (contract), TaskParentRef = Pick<TaskParent, 'type' | 'id'>
    taskParent.ts                       NEW      parentNoun(parent), parentPath(parent) (a deleted board → /boards)
    api.ts                              CHANGED  lists/create take a TaskParentRef; one-task hooks take only taskRef (/tasks/{taskRef}…)
    searchParams.ts                     CHANGED  TaskSearch.created, CREATED_FILTERS; toTaskListParams(search, today)
    components/TaskListSection.tsx      RENAMED from ProgramTasks.tsx; takes { parent, parentName, headingHidden? }
    components/TaskFilters.tsx          CHANGED  Created select
    components/CreateTaskDialog.tsx     CHANGED  takes parent + parentName
    components/TaskTable.tsx, TaskDependencies.tsx  CHANGED  links with taskPath(task.key)
    components/AddBlocker.tsx           CHANGED  searches task.parent; "No other tasks in this board yet."
    components/TaskOptionMenu.tsx, TaskStatusMenu.tsx, TaskAssigneeEditor.tsx, TaskFieldEditor.tsx  CHANGED  useUpdateTask(taskRef)
    components/DeleteTaskButton.tsx     CHANGED  navigates back to parentPath(task.parent)
    pages/TaskPage.tsx                  CHANGED  /tasks/:taskRef; back link and a Program/Board detail row from task.parent
    index.ts                            CHANGED  exports TaskListSection (was ProgramTasks) and taskKeys
  features/comments/
    types.ts, api.ts                    CHANGED  CommentTarget = { programId } | { taskId }; task comments via /tasks/{taskRef}/comments…
    components/TaskComments.tsx         CHANGED  takes taskId only
  features/overview/
    types.ts                            CHANGED  + BoardReportRow, ReportScope
    period.ts                           CHANGED  imports isCalendarDate / toIsoDate from lib/dates
    scope.ts                            NEW      REPORT_SCOPES, parseScope, withScope (all left out), SCOPE_TASKS_WHERE + scope.test.ts
    components/PeriodFilter.tsx         CHANGED  "Show" select (All / Programs / Boards) before the period
    components/ProgressMeter.tsx        NEW      the done/total meter, moved out of ProgramReportTable
    components/BoardReportTable.tsx     NEW      per-board rows
    components/StatTiles.tsx            CHANGED  showPrograms: program tiles and "at risk" only when programs are shown
    components/TrendChart.tsx, PriorityBars.tsx, TeamReport.tsx  CHANGED  descriptions say where the tasks are
    pages/OverviewPage.tsx              CHANGED  sends scope (not when All); shows sections by scope
  test fixtures                         CHANGED  boardId: null + parent on tasks, boardId on comments; task routes move to /tasks/{taskRef}
```

Request flow and layering are unchanged: page → feature hook → `apiClient`. Imports between features:

- `programs` and `boards` import `@/features/tasks` for `TaskListSection` (and `boards` for `taskKeys`, to mark cached task pages stale after a board is deleted).
- `tasks` imports neither: a task names its own parent (`task.parent`), so the task page needs no program or board query.
- The router imports `BoardsPage` and `BoardPage` by path.

## Tasks by parent (`features/tasks`)

```ts
type TaskParent = components['schemas']['TaskParent']        // { type: 'PROGRAM' | 'BOARD', id, key, name, isActive }
type TaskParentRef = Pick<TaskParent, 'type' | 'id'>         // what the program and board pages pass
```

| Call | Program parent | Board parent |
|---|---|---|
| list (`useParentTasks(parent, params)`, `useTaskSearch(parent, q)`) | `GET /programs/{programId}/tasks` | `GET /boards/{boardId}/tasks` |
| create (`useCreateTask(parent)`) | `POST /programs/{programId}/tasks` | `POST /boards/{boardId}/tasks` |
| one task: `useTask(taskRef)`, `useUpdateTask(taskRef)`, `useAddBlocker(task, taskRef)`, `useRemoveBlocker(task, taskRef)`, `useDeleteTask(task, taskRef)` | `/tasks/{taskRef}…` | `/tasks/{taskRef}…` |

Query keys:

```ts
taskKeys.parent(parent)              // ['tasks', 'PROGRAM', id] | ['tasks', 'BOARD', id]
taskKeys.lists(parent), taskKeys.list(parent, params)
taskKeys.details()                   // ['tasks', 'detail']
taskKeys.detail(taskRef)             // taskRef as in the URL (key or id)
```

- After a save, `useTaskSaved` sets the detail, invalidates `taskKeys.lists(savedTask.parent)`, and marks other details stale. That's the old behaviour, scoped by the saved task's own parent.
- `useDeleteTask(task, taskRef)` removes the lists of `task.parent`.
- The blocker picker searches `task.parent`, the only parent the server accepts for blockers.
- Deleting a board marks every cached task detail stale, since cached board tasks still say `parent.isActive: true`.

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
- `BoardGrid`: one card per board. Phones and tablets get one column; from `lg` (laptops) up there are two.
  - Each card shows the key in a soft violet square and the name as an `h2`. The name's link stretches over the whole card. Below are the description (two lines at most, or "No description") and a footer with the created date and an arrow.
  - The cards have a faint violet wash and lift slightly on hover, but not with reduced motion. Keyboard focus on the link rings the whole card.
  - Pagination is 20 per page.
- States:
  - pending: skeleton cards.
  - error: `ErrorState` with retry.
  - empty: "No boards yet", plus Create board when the role allows it.
  - past the end: "This page is empty" with Go to first page.
  - Paging keeps the previous cards dimmed (`keepPreviousData`, `busy`).
- After creating a board, the dialog navigates to the new board's page (the board is put in the cache, so it shows at once).

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
- Submit is disabled while the request is pending. A success toast reads "Board PRO created", with the name below.
- The key is checked before sending with the shared `keySchema` (`lib/keys.ts`), which the program dialog uses too.

## Board page (`/boards/:boardId`)

```
← Boards
┌──────────────────────────────────────────────────────────────────┐
│ [PRO]  Ops weekly                 (editable in place) [Delete]   │
└──────────────────────────────────────────────────────────────────┘
┌ Description ───────────────────────────┐  ┌ Details ─────────┐
│ (editable in place, Add / Edit)        │  │ Key     PRO      │
└────────────────────────────────────────┘  │ Created 28 Oct…  │
Tasks                                       │ Updated …        │
[Search] Status [▾] Created [Last 7 ▾]  [Create task]           └──────────────────┘
table …
‹ Previous   1–20 of 43   Next ›
```

- Same header card and two-column grid as the program page, with the key square in the board colour (violet) and no status strip. **Delete board** sits in the header card, where Delete program is, rather than in Details.
- The main column is the Description card, then `<TaskListSection parent={{ type: 'BOARD', id }} parentName={board.name} />` with a visible "Tasks" heading (the program page has tabs instead).
- Inline edit of name and description: ADMIN and MANAGER only. `PATCH` sends just the edited field; an unchanged save sends nothing; a blank description is sent as `null`. On 403 the editor stays open, keeps the text and shows "You don't have permission to edit boards." in its alert, as the program editor does. On 404 a toast says "This board has been deleted." and the refetch shows Not found.
- **Delete board** (ADMIN): `ConfirmDeleteDialog` "Delete Ops weekly?" says the board is hidden, its tasks stay open at their own links with their comments and still count in the Overview, its key stays taken, and there's no restore yet (the shipped contract, not the proposal). On success: toast and `/boards`. 403 shows in the dialog; 404 means someone else deleted it, so an info toast and `/boards`, as Delete program does.
- States: skeleton while loading, `NotFoundState` "Board not found" on 404 or a non-UUID id (400), and `ErrorState` with retry on 5xx.

## Task list (`TaskListSection`)

It's the current `ProgramTasks` with three changes:

- It takes a `parent` and `parentName`, and `headingHidden` on the program page, whose tab is the visible heading.
- `TaskFilters` shows a **Created** select (`w-40`) with All time, Last 7 days and Last 30 days. It appears on the program Tasks tab too.
- The filtered empty state counts `created` as a filter, so "No tasks match these filters" comes with Clear filters, which clears `q`, `status` and `created`.

The empty-state copy is "Add the first task to plan the work." for a program (unchanged) and "Add the first task to this board." for a board.

## Task page (`/tasks/:taskRef`)

- It loads `GET /tasks/{taskRef}` for any task. The back link goes to the parent and is named by `task.parent.name`, with no extra request.
- The Details card gains a **Program** (FolderKanban) or **Board** (SquareKanban) row first: the parent's key badge and name, linking to it.
- **A task on a deleted board** (`parent.isActive: false`): the back link says "Boards" and goes to `/boards`, and the Board row shows "PRO Product feedback (deleted)" without a link. Everything else works, as the contract allows.
- Inline edits, status, assignee, blockers, delete and comments all go through `/tasks/{taskRef}…`. Delete goes back to the parent (`parentPath`).
- Not found reads "This task doesn't exist or has been deleted." (no more "belongs to another program": the key alone finds any task).
- The skeleton shows a generic back-link placeholder, because the parent is only known once the task loads.
- **Old links:** `/programs/:programId/tasks/:taskRef` renders `LegacyTaskRedirect`, which does `<Navigate to={taskPath(taskRef)} replace />`. `taskRef` wins even if `programId` is wrong, and the page then shows the real parent.
- `DEPENDENCY_OTHER_PARENT` can't normally happen, because the picker only lists tasks with the same parent. If it does, the server's message is shown (`null` in the code map).

## Overview (`?scope=`)

The filter row gets a **Show** select (`w-36`): All, Programs, Boards, before Period. Changing it keeps the period (and a custom range being edited). It's sent as `scope`; `all` is left out of both the URL and the request. An unknown `?scope` means All.

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
- Under Boards, Tasks by status and Open tasks by priority share a row, then the trend, then the Board report.
- Under All, the By team card's description adds "Program tasks only: boards have no owner team."
- The trend and priority descriptions say where the tasks are: "across programs and boards" / "across all programs" / "across all boards", and "in the programs that ran in the period and on boards" / "… in the period" / "on boards".
- **Board report** (`BoardReportTable`) has these columns: key + name (links to the board), progress meter with "done/total" (`ProgressMeter`, shared with the Program report), done in period, open, and overdue (warning icon when above 0). Rows come in server order. It shows the first 10 rows with Show all, like the Program report. Empty: "No board has tasks yet." (rows don't depend on the period).
- **Nothing to report** when no program ran, no board has tasks (`boards[]` empty) and no task was created or completed. Under Boards it links to Boards instead of Programs.
- The numbers are rendered as returned and never recomputed.

## Errors (`src/api/errors.ts`)

| Code | Status | Message |
|---|---|---|
| `BOARD_KEY_EXISTS` | 409 | "Another board already uses this key. Keys of deleted boards stay taken too, so pick a different one." |
| `DEPENDENCY_OTHER_PARENT` | 400 | `null` (server message). Replaces `DEPENDENCY_OTHER_PROGRAM`, which the contract no longer has |

Forms add their own copy for a 403: "You don't have permission to create boards." (Create board) and "You don't have permission to edit boards." (inline editor).

## Tests (Vitest + MSW + RTL)

| File | Case | Expect |
|---|---|---|
| `lib/keys.test.ts` | the old `programKey` cases; `keyHint` | same results from `suggestKey`; prefix hint vs the rule |
| `lib/dates.test.ts` | `isCalendarDate`, `localToday` (moved), `shiftCalendarDate` | −6 / −29 days, month and year edges |
| `tasks/searchParams.test.ts` | `?created=7d|30d|yesterday`, paging keeps it, Clear removes it | parsed / ignored; `createdFrom` 2026-10-22 / 2026-09-29 for today 2026-10-28 |
| `boards/searchParams.test.ts` | `?offset=20`, `-1`, `abc` | parsed / ignored; first page left out of the URL |
| `overview/scope.test.ts` | `?scope=programs|boards|all|tasks` | parsed, unknown → all; `withScope` keeps the period and leaves All out |
| `boards/boards.test.tsx` | list, sidebar, paging, bad offset, empty (MANAGER vs MEMBER), past the end, 500 | rows; Create board only for ADMIN/MANAGER |
| | create: suggested key + prefix hint, uppercased key, blank description left out, description sent, 409 `BOARD_KEY_EXISTS`, 400 details, bad key not sent, 403 | field / form errors; success toast and navigation to the board |
| `boards/boardPage.test.tsx` | board + tasks | `GET /boards/{id}/tasks?limit=20&offset=0`; task links to `/tasks/PRO-50` |
| | Created: Last 7 days (today mocked 2026-10-28) | URL `?created=7d`; request `createdFrom=2026-10-22`; Next keeps it |
| | `?created=bogus`; empty board as MEMBER | ignored; "Add the first task to this board." with Create task |
| | create a board task | `POST /boards/{id}/tasks`; list refetches |
| | rename (MANAGER), clear description (`null`), unchanged save, 403 in the editor, 404 meanwhile, MEMBER / MANAGER can't delete | toasts / alert / Not found |
| | delete (ADMIN), 403, 404 | `/boards`; error in the dialog; info toast |
| | 404, 400, 500 | Not found / Not found / retry |
| `tasks/taskPage.test.tsx` | `/tasks/PRO-50` (board task), `/tasks/MKT-7` (program task) | `GET /tasks/{ref}`; back link and Details row to the board / program |
| | task on a deleted board | back link "Boards", "(deleted)" without a link |
| | `/programs/{id}/tasks/MKT-7` | replaced by `/tasks/MKT-7` |
| | add blocker on a board task | picker searches `GET /boards/{id}/tasks` |
| | comment edit on a board task | `PATCH /tasks/{taskId}/comments/{commentId}` |
| | delete a board task | `DELETE /tasks/PRO-50`, back to the board |
| `tasks/tasks.test.tsx` | program Tasks tab: Created filter, paging, `?created=30d`, `?created=bogus`, Clear filters | `createdFrom` on the program route |
| `overview/overview.test.tsx` | Show: Boards | `scope=boards`; program tiles, at-risk, Programs by status, By team and Program report hidden; Board report rows |
| | `?scope=programs`; default All; unknown scope; nothing to report on boards | no Board report / both reports + By team note / no `scope` sent / Go to Boards |
| existing program, task and comment tests | same behaviour, new routes | pass with fixtures on `/tasks/{taskRef}`, `boardId: null` and `parent` |

## Acceptance checklist

- [x] Backend shipped boards, `/boards/{id}/tasks`, `/tasks/{taskRef}…`, `Task.boardId` + `parent`, the global task counter, `createdFrom`/`createdTo`, and report `scope` + `boards[]` (backend `640f27a`). Types regenerated from that OpenAPI document (the server wasn't running, so not through `npm run api:types`), and this spec updated to the shipped contract
- [x] Boards page: list, paging, empty states, Create board hidden for MEMBER; 403 handled when forced (tests)
- [x] Create board: key suggestion, prefix hint, 400 details on fields, 409 `BOARD_KEY_EXISTS` on Key (tests)
- [ ] A board key equal to a program's key is accepted (backend rule; needs the running backend)
- [x] Board page: inline name and description (ADMIN/MANAGER), delete (ADMIN), 404 → Not found, 5xx → retry (tests)
- [x] Board tasks: list, search, status, **Created (Last 7 / Last 30 days)**, Previous/Next keep filters (tests). Each change pushes a history entry, as on the program page, so Back undoes it (not tested)
- [ ] Program `PRO` and board `PRO` both create tasks and keys never collide (backend rule; needs the running backend)
- [x] `/tasks/<key>` opens program and board tasks; old program task links redirect (tests). `/tasks/<uuid>` goes through the same route, untested
- [x] Task page for a board task: blockers search the same board, delete goes back to the board, comment edit through `/tasks/{taskId}/comments/{commentId}` (tests); edits, status and @mentions share the program-task code paths
- [x] Overview: All / Programs / Boards show the sections in the table above; numbers come from the server (tests)
- [x] CLAUDE.md updated: role matrix rows, Known contract facts (boards, global task numbers, `/tasks/{taskRef}`, `createdFrom`, report `scope`), folder layout (`features/boards`, `lib/keys.ts`, `lib/dates.ts`), new gap 8
- [x] `npm run build` and `npm run lint` pass. `npm test`: every file passes when run alone. Full parallel runs show 1–2 timing failures in `auth.test.tsx` (and once `overview.test.tsx`), which fail the same way on the commit before this spec (see Testing notes)

## Testing notes

- **Not yet checked against the running backend**: it wasn't up when this was built. Still to do with it running:
  - Run `npm run api:types` and check `schema.d.ts` doesn't change.
  - Create program `PRO` and board `PRO`, add tasks to each in turn, and check the keys.
  - Sign in as a MEMBER and check that Create board, edit and delete are hidden. Force a `PATCH /boards/{id}` from the console to see the 403 handling.
  - Delete a board, then open one of its tasks by key: it should load with "(deleted)".
- To check "Last 7 days" without waiting a week, backdate a task's `createdAt` in the backend DB, or mock today in the tests (`vi.setSystemTime`).
- **Flaky tests on a loaded machine (pre-existing).** In a full `npm test` run (about 2 minutes here), these fail now and then:
  - `auth.test.tsx` "ends the session when the token expires": a 1-second token races the first render of People. Failed in all four full runs with this spec and in the one run on the commit before it.
  - `auth.test.tsx` "ends the session on a 401 from /auth/me": failed once in the four runs with this spec.
  - `overview.test.tsx` "is in the sidebar, below Programs": the first lazy load of the Overview chunk. Failed once in the four runs with this spec, and in the run on the commit before it.

  All of them pass when their file runs alone. Worth fixing separately, for example by giving the expiry test fake timers.

## Out of scope / follow-ups

- **Tasks with no parent** (dropped 2026-10-28). They'd need a list route, a page and a create path.
- **Moving a task** between a program and a board. The key prefix would change. The global number would stay unique, but links to the old key would break.
- Blockers across programs and boards.
- Board-level comments (decided against).
- An "all tasks" or "My tasks" view across every parent.
- A board search box and picker. `GET /boards?q` exists now; they're useful once tasks can move.
- Board labels (`GET /boards/{boardId}/labels` exists; the UI doesn't use the program one yet either).
- Owner team, status or dates on boards, which would let boards appear in By team and at-risk.
- Restoring a deleted board, and listing its tasks. **Contract gap**: a deleted board's tasks stay live, but nothing lists them (its task list is 404 and there's no cross-parent task list or search), so they're reachable only by key or link. Reported in CLAUDE.md (gap 8).
