# 10 — Task page (view and edit a task, status, comments, delete) and program delete

**Status:** Implemented (2026-10-20). Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `tasks_ui`
**Depends on:** [07-programs](./07-programs.md) (`ProgramPage`, `useProgram`, comments), [08-tasks](./08-tasks.md) (`taskKeys`, `taskDisplay.ts`, `taskSchema.ts`, `TaskTable`), [09-program-page-polish](./09-program-page-polish.md) (inline editing, `useInlineEdit`, status menu, tones, blue comments, @-mentions)

## Goal

Requested as "a task page made the same way as the program page, with comments, and the status changeable like Jira; program and task delete for managers or admins only".

1. **Task page (`/programs/:programId/tasks/:taskRef`)**, laid out like the program page: a back link to the program, a header card (status strip, key tile, title, status), the description, the task's dependencies, its comments, and a Details card.
2. **Edit everything in place, like Jira** (every role: `PATCH …/tasks/{taskRef}` allows any active employee): title, description, status, type, priority, assignee, start date, due date, estimate and labels. Each field saves on its own.
3. **Status like Jira:** the status badge opens a menu (Discussion, On hold, In progress, Done) and picking one saves it. `DEPENDENT` is shown but never offered (the server sets it).
4. **Task comments:** the same blue comment panel as the program page (threads, replies, @-mentions), on the task's own comments.
5. **Delete a task** (ADMIN, MANAGER, or the task's reporter) after a confirmation.
6. **Delete a program** (ADMIN) from the program page, after a confirmation.
7. **Task rows link to the task page:** the title in the Tasks tab is a link.

> **Delete roles follow the contract** (decided with the user on 2026-10-20). The request said "managers or admins only"; the contract says program delete is **ADMIN only** (a MANAGER gets 403) and task delete is **ADMIN, MANAGER or the reporter**. The user chose to keep the contract's rules, so no backend change.

Nothing is blocked on the backend.

## Flow

```
Browser (any role)                                          FlowDesk API
  │ 1. Tasks tab → click "Draft survey questions"               │
  │    /programs/{programId}/tasks/MKT-7                        │
  │    GET /programs/{programId}/tasks/MKT-7                    │ TaskDetail (dependsOn, blocks)
  │    GET /programs/{programId}            (cached; back link) │
  │    GET /programs/{programId}/tasks/{taskId}/comments?order=desc&limit=20&offset=0
  │───────────────────────────────────────────────────────────>│
  │ 2. status badge → In progress                               │
  │    PATCH …/tasks/MKT-7 { status: 'IN_PROGRESS' }            │
  │<───────────────────────────────────────────────────────────│ 200 TaskDetail → replaces the cached task;
  │                                                             │ task lists refetch; toast
  │    or 409 TASK_BLOCKED { details: { blockers } }            │ toast naming the blockers; task refetched
  │ 3. Delete (ADMIN / MANAGER / reporter) → confirm            │
  │    DELETE …/tasks/MKT-7                                     │
  │<───────────────────────────────────────────────────────────│ 204 → toast "MKT-7 deleted", back to the program
```

The URL uses the task's **key** (`MKT-7`, readable and what Jira does); the contract accepts a key or a UUID, case-insensitive. Comments use the task's **id** once the task has loaded.

## Environment variables

None.

## Packages

| Package | Kind | Purpose |
|---|---|---|
| shadcn `alert-dialog` | **new**, `npx shadcn add alert-dialog` (Radix AlertDialog, already in `radix-ui`) | delete confirmations |
| shadcn `dropdown-menu`, `card`, `badge`, `input`, `textarea`, `field`, `skeleton` | already in `src/components/ui` | menus, cards, editors |

## Folder layout (new and changed)

```
src/
  components/ui/alert-dialog.tsx                     NEW      npx shadcn add alert-dialog
  components/feedback/ConfirmDeleteDialog.tsx        NEW      "Delete" trigger + AlertDialog: pending, error alert, can't close while pending
  components/data/DetailRow.tsx                      NEW      Detail, EditableDetail, NotSet (moved out of ProgramPage; both pages use them)
  hooks/useInlineEdit.ts                             MOVED    from features/programs/useInlineEdit.ts (tasks use it too)
  routes/paths.ts                                    CHANGED  paths.task, taskPath(programId, taskRef)
  routes/router.tsx                                  CHANGED  task route
  features/
    employees/components/EmployeeMultiPicker.tsx     CHANGED  generic value: anything with id, name, emailId
                                                              (a task's assignee is an EmployeeSummary)
    comments/
      types.ts                                       CHANGED  CommentTarget = { programId, taskId? }
      api.ts                                         CHANGED  commentKeys.task; useComments(target), useCreateComment(target)
      components/CommentSection.tsx                  NEW      the blue panel, for any target (was ProgramComments' body)
      components/ProgramComments.tsx                 CHANGED  <CommentSection target={{ programId }} />
      components/TaskComments.tsx                    NEW      <CommentSection target={{ programId, taskId }} />
      components/CommentForm.tsx, CommentThread.tsx  CHANGED  target instead of programId
      index.ts                                       CHANGED  + TaskComments
    programs/
      index.ts                                       NEW      useProgram (for the task page's back link)
      api.ts                                         CHANGED  useDeleteProgram
      components/DeleteProgramButton.tsx             NEW      ADMIN; confirm dialog
      pages/ProgramPage.tsx                          CHANGED  Delete button in the header card; useInlineEdit from hooks/
      programPage.test.tsx                           CHANGED  delete cases
    tasks/
      types.ts                                       CHANGED  TaskDetail, TaskSummary, UpdateTaskRequest
      api.ts                                         CHANGED  taskKeys.lists/details/detail, useTask, useUpdateTask, useDeleteTask
      taskDisplay.ts                                 CHANGED  formatEstimate(minutes), minutesToHours(minutes)
      taskErrors.ts                                  NEW      blockersOf(error), toastTaskUpdateError(error)
      components/TaskTable.tsx                       CHANGED  title links to the task page
      components/TaskStatusMenu.tsx                  NEW      status badge as a menu
      components/TaskOptionMenu.tsx                  NEW      type / priority as a menu
      components/TaskFieldEditor.tsx                 NEW      one-field form: title, description, dates, estimate, labels
      components/TaskAssigneeEditor.tsx              NEW      people picker + Assign to me / Unassigned
      components/TaskDependencies.tsx                NEW      Blocked by / Blocks, read-only links
      components/DeleteTaskButton.tsx                NEW      confirm dialog
      pages/TaskPage.tsx                             NEW
      index.ts                                       CHANGED  comment: pages may import @/features/programs
      taskPage.test.tsx                              NEW
```

Request flow as before: component → feature hook (`features/*/api.ts`) → `unwrap(apiClient.…)`.

**Cross-feature imports.** `programs/pages/ProgramPage` imports `@/features/tasks` (`ProgramTasks`), so `tasks/index.ts` and everything it exports must never import `@/features/programs`. `tasks/pages/TaskPage` isn't exported from `tasks/index.ts` (the router imports it by path), so it may import `@/features/programs`, whose new `index.ts` exports only `useProgram` and imports nothing from tasks. Same rule as employees ↔ teams.

## Types (`features/tasks/types.ts`, aliases only)

```ts
export type TaskDetail = components['schemas']['TaskDetail']
export type TaskSummary = components['schemas']['TaskSummary']
export type UpdateTaskRequest = components['schemas']['UpdateTaskRequest']
export type SettableTaskStatus = NonNullable<UpdateTaskRequest['status']>   // DEPENDENT excluded
```

## Data (`features/tasks/api.ts`)

```ts
export const taskKeys = {
  all: ['tasks'] as const,
  program: (programId) => [...taskKeys.all, 'program', programId] as const,
  lists: (programId) => [...taskKeys.program(programId), 'list'] as const,
  list: (programId, params) => [...taskKeys.lists(programId), params] as const,      // same key as before
  details: (programId) => [...taskKeys.program(programId), 'detail'] as const,
  detail: (programId, taskRef) => [...taskKeys.details(programId), taskRef] as const,
}

useTask(programId, taskRef)        // GET …/tasks/{taskRef} → data
useUpdateTask(programId, taskRef)  // PATCH, only the edited field
  // onSuccess: setQueryData(detail), invalidate lists, mark the other tasks' details stale without
  //   refetching (a status change into or out of DONE re-evaluates the tasks it blocks)
  // onError 404 or 409 TASK_BLOCKED: invalidate the detail (deleted, or its blockers changed)
useDeleteTask(programId, taskRef)  // DELETE → 204
  // onSuccess: remove the cached lists (the Tasks tab loads fresh, without the deleted row flashing),
  //   mark details stale without refetching
```

`programs/api.ts`: `useDeleteProgram(programId)`, `DELETE /programs/{programId}` → 204; onSuccess removes the cached program lists and marks the detail stale without refetching.

## Task page (`features/tasks/pages/TaskPage.tsx`)

```
← Marketing Research
┌──────────────────────────────────────────────────────────────────────┐ ← strip in the status colour
│ [MKT-7]  Draft survey questions ✎                         [🗑 Delete] │
│          (In progress ▾)                                              │
└──────────────────────────────────────────────────────────────────────┘
┌ main ──────────────────────────────────────────┐ ┌ Details ─────────────────┐
│ Description                          [✎ Edit]  │ │ Assignee   Jane Doe      │
│ Cover pricing, channels and brand recall.      │ │ Reporter   Ravi Kumar    │
├ Dependencies ──────────────────────────────────┤ │ Type       ■ Pre ▾       │
│ Blocked by  MKT-3 Finalise sample (In progress)│ │ Priority   ⌃ High ▾      │
│ Blocks      MKT-9 Run survey      (Dependent)  │ │ Start date 20 Oct 2026   │
├ Comments (blue panel) ─────────────────────────┤ │ Due date   31 Oct 2026   │
│ …                                              │ │ Estimate   8 h           │
└────────────────────────────────────────────────┘ │ Labels     [survey] [q4] │
                                                   │ Created / Updated        │
                                                   │ Completed (when set)     │
                                                   └──────────────────────────┘
```

- **Back link:** "← {program name}" to the program page (Tasks tab). The name comes from `useProgram` (usually cached); while it loads or if it fails, the link says "Program".
- **Header card:** status strip (`TASK_STATUS_TONES`), key tile (`font-mono`), the title as the `h1` (click or "Edit title" pencil), the status menu, and Delete on the right when allowed. `PageHeader` sets the document title to `MKT-7 Draft survey questions`.
- **Layout:** the same grid as the program page; Details first in the DOM (on top on narrow screens), on the right from `lg` up, `aside aria-label="Task details"`.
- **Every role can edit** (contract). Nothing on the page is role-gated except Delete.

### States

| State | What renders |
|---|---|
| loading | back link + skeletons |
| 404, or 400 (bad `taskRef` / `programId`) | `NotFoundState` "Task not found" / "This task doesn't exist, has been deleted, or belongs to another program." |
| 500 / network | `ErrorState` "Couldn't load the task" + Retry |
| 401 | middleware ends the session |

### Inline editors

Same behaviour as the program page (spec 09): Enter (Ctrl+Enter in the description) or Save saves, Escape or Cancel discards, an unchanged value closes without a request, focus goes back to the trigger, toast "{Field} updated".

| Field | Opens with | Editor | PATCH body |
|---|---|---|---|
| Title | click the h1, or the "Edit title" pencil | text input in the h1's place | `{ title }` (trimmed by zod) |
| Description | click the text, or Edit / Add | textarea | `{ description }`; blank → `null` |
| Status | status badge ("Status: In progress. Change status") | menu: Discussion, On hold, In progress, Done | `{ status }` |
| Type, Priority | the value in Details ("Type: Pre. Change type") | menu of the five, with their colours / icons | `{ type }` / `{ priority }` |
| Assignee | the name in Details ("Edit assignee, Jane Doe") | people picker (`max={1}`), "Assign to me", Save / Cancel; removing the chip and saving unassigns | `{ assigneeId }`; none → `null` |
| Start / Due date | the date in Details | date input + Clear date | `{ startDate }` / `{ dueDate }`; cleared → `null` |
| Estimate | the estimate in Details | hours input, "For example 1.5 for 1 h 30 min." + Clear | `{ estimateMinutes }` (`hoursToMinutes`); blank → `null` |
| Labels | the labels in Details | text input "survey, q4" with the badge preview | `{ labels: parseLabels(text) }` (replaces the list; blank → `[]`) |

Validation (instant feedback only) reuses `taskSchema`'s rules. The date range is left to the server, which checks the **merged** values.

`formatEstimate(minutes)`: `45 min`, `8 h`, `1 h 30 min`. `minutesToHours(minutes)`: the editor's text, at most 2 decimals (`90` → `1.5`); `hoursToMinutes` brings it back to the same minutes, so an untouched estimate saves nothing.

### Status (`TaskStatusMenu`)

- Items: the four settable statuses with their tone dots; the current one is checked. A `DEPENDENT` task's badge says Dependent and the menu adds a note: "Waiting for its blockers. The status comes back by itself once they're done." The items stay enabled; the server answers 409 (CLAUDE.md §1: don't re-implement dependency rules).
- While saving: the badge shows the picked status with a spinner, disabled.
- Success: toast "Status changed to {label}". If the server saved `DEPENDENT` instead (reopening a DONE task with open blockers, per the contract), the toast says "Status changed to Dependent" with "It has unfinished blockers. It moves to {requested} once they're done."
- **409 `TASK_BLOCKED`:** toast "This task is blocked by unfinished dependencies." with the blockers from `details.blockers` as the description ("Waiting for MKT-3 Finalise sample (In progress)."); the task refetches.

### Errors (every editor and menu)

| Response | Editors (title, description, dates, estimate, labels, assignee) | Menus (status, type, priority) |
|---|---|---|
| 400 `details` | under the input (`labels.3` → the labels input, `estimateMinutes` → the estimate) | toast |
| 400 `ASSIGNEE_NOT_FOUND` | assignee picker cleared, message under it | — |
| 400 `INVALID_DATE_RANGE` | under the date: "The start date must be on or before the due date." / "The due date must be on or after the start date." | — |
| 404 (deleted meanwhile) | toast "This task has been deleted."; the page refetches and shows "Task not found" | same |
| 409 `TASK_BLOCKED` | — | toast with the blockers (above) |
| 403, 5xx, network | alert in the editor, text kept | toast `getErrorMessage` |
| 401 | middleware | middleware |

### Dependencies (`TaskDependencies`)

A card with two lists, **Blocked by** (`dependsOn`) and **Blocks** (`blocks`): each item is the key and title as a link to that task's page, plus its status badge. An empty list says "None". Read-only here: adding and removing blockers is the next spec.

### Comments (`TaskComments`)

`CommentSection` is `ProgramComments`' panel with a target: `GET`/`POST /programs/{programId}/tasks/{taskId}/comments` instead of the program's, same order (`desc`), paging, replies and @-mentions. Query key `commentKeys.task(programId, taskId)`. The empty state says "Everyone in FlowDesk can comment on a task." Errors as in spec 07.

### Delete task (`DeleteTaskButton`)

- **Shown to** ADMIN, MANAGER, or the reporter (`employee.id === task.reporter.id`), per the contract. UX only; a 403 is still handled.
- Outline button "Delete" (trash icon) in the header card → `AlertDialog`: "Delete MKT-7?" / "“Draft survey questions” and its dependency links will be removed. Tasks it blocks are re-evaluated, and its key isn't reused. This can't be undone." / Cancel, **Delete task** (destructive).
- **Pending:** "Deleting…" with a spinner; the dialog can't be closed.
- **204:** toast "MKT-7 deleted", go to the program page.
- **404:** toast "This task has already been deleted.", go to the program page.
- **403, 5xx, network:** alert inside the dialog (`getErrorMessage`); it stays open.

### Delete program (`DeleteProgramButton`)

- **Shown to** ADMIN only (`DELETE_PROGRAM_ROLES`), per the contract.
- Same button in the program page's header card → "Delete Marketing Research?" / "The program, its tasks and its comments will be hidden. Its key MKT stays taken, and there's no way to restore it yet." / Cancel, **Delete program**.
- **204:** toast "Marketing Research deleted", go to `/programs`. **404:** toast "This program has already been deleted.", go to `/programs`. **403, 5xx, network:** alert inside the dialog.

## Shared changes

- **`useInlineEdit`** moves to `src/hooks/useInlineEdit.ts` (tasks can't import programs' internals). Unchanged.
- **`EmployeeMultiPicker`** becomes generic: `value: readonly T[]` with `T` anything that has `id`, `name` and `emailId`; `onChange` gets `(T | Employee)[]`. Existing callers pass `Employee[]` and don't change.
- **Task table:** the title is a link to `taskPath(task.programId, task.key)`.

## Tests (Vitest + MSW + RTL)

| File | Case | Expect |
|---|---|---|
| `features/tasks/taskPage.test.tsx` | load | h1, key, status, description, details (assignee, reporter, type, priority, dates, estimate "8 h", labels), dependencies links, back link with the program name |
| | 404 | "Task not found" |
| | status → In progress | `{ status: 'IN_PROGRESS' }`; toast; badge |
| | status on a DEPENDENT task → 409 `TASK_BLOCKED` | toast names MKT-3 |
| | rename | `{ title }`; new h1 |
| | type / priority menus | `{ type: 'BUG' }`, `{ priority: 'LOW' }` |
| | assignee: unassign; Assign to me | `{ assigneeId: null }`, `{ assigneeId: me }` |
| | estimate 1.5; unchanged estimate | `{ estimateMinutes: 90 }`; no request |
| | labels "Survey, q4"; due before start → `INVALID_DATE_RANGE` | `{ labels: ['survey','q4'] }`; message under Due date |
| | delete as MANAGER | DELETE sent; toast; URL is the program page |
| | MEMBER reporter / MEMBER not reporter | Delete shown / hidden |
| | delete 403 | alert in the dialog |
| | comments list and post | requests go to `…/tasks/{taskId}/comments` |
| | open from the Tasks tab | title link → `/programs/{id}/tasks/MKT-7` |
| `features/programs/programPage.test.tsx` | ADMIN delete | DELETE; toast; `/programs` |
| | Cancel; 403 | no request; alert in the dialog |
| | MANAGER, MEMBER | no Delete button |

## Acceptance checklist

- [x] `npm run api:types` re-run (no diff); only aliases of generated types
- [ ] Browser: task page opens from the Tasks tab, shows every field, dependencies and comments; back link returns to the program
- [ ] Browser: every field edits in place for every role; status menu works; a DEPENDENT task's status change shows the blockers
- [ ] Browser: delete task as ADMIN, MANAGER and the reporter; hidden for another MEMBER; 403 handled
- [ ] Browser: delete program as ADMIN; hidden for MANAGER and MEMBER
- [ ] Keyboard and 375 px checks for the task page, the menus and the delete dialogs
- [x] `npm run typecheck`, `npm run build`, `npm run lint` (no new warnings), `npm test` (304) pass

## Verified

**Automated (Vitest + MSW, contract-shaped bodies): 304/304 tests pass across the repo** (279 before). New: `tasks/taskPage.test.tsx` (20: load, Tasks-tab link, 404, empty fields, status, 409 `TASK_BLOCKED` with blockers, reopen → Dependent, title, type and priority menus, unassign / Assign to me, `ASSIGNEE_NOT_FOUND`, estimate in hours and the unchanged-save skip, labels, `INVALID_DATE_RANGE`, PATCH 404 → "Task not found", delete as MANAGER, reporter / other MEMBER, delete 403, posting a task comment) and 5 delete cases in `programs/programPage.test.tsx`. Every existing program, comments and tasks test passes unchanged.

**Against the running backend (curl, 2026-10-20):** `npm run api:types` produced no diff. `GET`/`PATCH`/`DELETE …/tasks/{taskRef}`, `DELETE /programs/{id}` and `GET`/`POST …/tasks/{taskRef}/comments` answer 401 `AUTH_REQUIRED` without a token and `INVALID_AUTH_TOKEN` with `Bearer abc`; the CORS preflight from `http://localhost:5173` for `PATCH` and `DELETE` returns 204 and allows `authorization, content-type`.

**Still to do by hand:** everything that needs a signed-in session against real data (the unticked items).

## Implementation notes

- **Shared pieces** not in the first plan: `ConfirmDeleteDialog` (both delete buttons) and `DetailRow` (`Detail`, `EditableDetail`, `NotSet`, moved out of `ProgramPage`, whose date rows now use `EditableDetail`; same markup, so its tests didn't change).
- **The confirm button isn't `AlertDialogAction`**, which closes on click; a plain destructive `Button` keeps the dialog open until the request answers.
- **Dependency links** put a space between the key and the title, so the link's accessible name is "MKT-3 Finalise sample", not "MKT-3Finalise sample".
- **Task comments' test** lives in `taskPage.test.tsx` (posting from the page) instead of a separate file; `programComments.test.tsx` still covers the shared section in depth.

## Out of scope / follow-ups

- ~~Adding and removing blockers~~ and ~~editing and deleting comments~~: done in [11-blockers-and-comment-editing](./11-blockers-and-comment-editing.md).
- Label autocomplete from `GET /programs/{id}/labels`; moving a task to another program (not in the contract).
- A restore for deleted programs or tasks (no endpoint).
