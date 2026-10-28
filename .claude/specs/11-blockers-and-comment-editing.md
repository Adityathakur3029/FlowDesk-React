# 11 — Blockers on the task page, and editing and deleting comments

**Status:** Implemented (2026-10-20). Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `tasks_ui`
**Depends on:** [07-programs](./07-programs.md) (comments), [08-tasks](./08-tasks.md) (`taskKeys`, task list query), [09-program-page-polish](./09-program-page-polish.md) (@-mentions: `MentionTextarea`, `toMentionTokens`), [10-task-page](./10-task-page.md) (task page, `TaskDependencies`, `ConfirmDeleteDialog`, `CommentSection`)

## Goal

The follow-ups of spec 10, requested as "do the next steps too":

1. **Blockers on the task page, like Jira's "is blocked by" links.** In the Dependencies card, **Add blocker** searches the program's tasks (title or key) and links the picked one; each "Blocked by" row gets a **Remove** button. Every role may do both (contract).
2. **Edit a comment** (its author only) in place, with @-mentions kept as `@Name` in the box.
3. **Delete a comment** (ADMIN, MANAGER, or its author) after a confirmation. A deleted top-level comment with replies stays as "This comment was deleted.".

Both work on program comments and task comments, since they share `CommentSection`. Nothing is blocked on the backend.

## Flow

```
Browser (any role)                                              FlowDesk API
  │ Dependencies → Add blocker → type "sample"                       │
  │   GET /programs/{programId}/tasks?q=sample&limit=20&offset=0     │ (no q: the newest 20)
  │ pick MKT-3                                                       │
  │   POST /programs/{programId}/tasks/MKT-7/dependencies            │
  │        { dependsOnTaskId: <MKT-3 id> }                           │
  │<─────────────────────────────────────────────────────────────────│ 201 TaskDetail (maybe now DEPENDENT)
  │   or 400 SELF_DEPENDENCY / DEPENDENCY_* / 409 DEPENDENCY_EXISTS, │ message under the search box
  │      DEPENDENCY_CYCLE, TASK_DONE                                 │
  │ Remove (×) on MKT-3                                              │
  │   DELETE …/tasks/MKT-7/dependencies/<MKT-3 id>                   │
  │<─────────────────────────────────────────────────────────────────│ 200 TaskDetail (status maybe restored)
  │                                                                  │
  │ Comment → Edit → change text → Save                              │
  │   PATCH /programs/{programId}/comments/{commentId} { body }      │ 200; 403 if not the author
  │ Comment → Delete → confirm                                       │
  │   DELETE /programs/{programId}/comments/{commentId}              │ 204; 403 for another MEMBER
```

Both dependency calls answer with the task, so the page shows the new status and lists right away. Comment edits and deletes answer with no thread data the list can use as is (a delete can leave a tombstone), so the comment list refetches.

## Packages

None new (cmdk, shadcn `command` and `alert-dialog` are installed).

## Folder layout (new and changed)

```
src/
  components/feedback/ConfirmDeleteDialog.tsx       CHANGED  optional `trigger` element (comments use a small ghost "Delete")
  features/
    tasks/
      api.ts                                        CHANGED  useTaskSearch, useAddBlocker, useRemoveBlocker
      components/AddBlocker.tsx                     NEW      task search (cmdk) + link on pick
      components/TaskDependencies.tsx               CHANGED  Add blocker, Remove per "Blocked by" row; takes taskRef
      pages/TaskPage.tsx                            CHANGED  passes taskRef to TaskDependencies
      taskPage.test.tsx                             CHANGED  blocker cases
    comments/
      api.ts                                        CHANGED  useUpdateComment, useDeleteComment
      mentions.ts                                   CHANGED  fromMentionTokens(body, mentions)
      mentions.test.ts                              CHANGED
      components/CommentForm.tsx                    CHANGED  `editing` mode: prefilled, PATCH, Save, Escape cancels
      components/CommentItem.tsx                    CHANGED  Edit / Delete actions; the edit form in place of the body
      components/CommentActionButton.tsx            NEW      the small blue ghost button for Reply, Edit and Delete
      components/DeleteCommentButton.tsx            NEW
      components/CommentThread.tsx                  CHANGED  passes target to CommentItem
      programComments.test.tsx                      CHANGED  edit / delete cases
```

## Blockers

### Data (`features/tasks/api.ts`)

```ts
useTaskSearch(programId, q)          // GET …/tasks { q?, limit: 20, offset: 0 }, newest first; key taskKeys.list(…),
                                     // so it shares the Tasks tab's first page; keepPreviousData while typing
useAddBlocker(programId, taskRef)    // useMutation<TaskDetail, ApiError, TaskSummary>
                                     //   POST …/tasks/{taskRef}/dependencies { dependsOnTaskId: blocker.id }
useRemoveBlocker(programId, taskRef) // useMutation<TaskDetail, ApiError, TaskSummary>
                                     //   DELETE …/tasks/{taskRef}/dependencies/{blocker.id}
```

Both, on success, do what `useUpdateTask` does: replace the cached task, refetch the lists, mark the other tasks' details stale (the blocker's `blocks` changed too). On a 404 or 409 they refetch the task (deleted, or changed meanwhile); on `DEPENDENCY_TASK_NOT_FOUND` they also refetch the lists (the picked task was deleted).

### Add blocker (`AddBlocker`)

```
Blocked by                                         [+ Add blocker]
[ 🔍 Search tasks by title or key                ]       [Cancel]
  MKT-12  Book the venue                  (In progress)
  MKT-11  Pick a survey tool              (Done)
  …
```

- The **Add blocker** button (ghost, `sm`) opens the box in the card and focuses it. With nothing typed, it lists the program's **newest tasks**; typing searches (250 ms debounce, `q` 1–100 characters, title substring or exact key).
- Suggestions leave out **the task itself and its current blockers** (picking them can only fail with `SELF_DEPENDENCY` / `DEPENDENCY_EXISTS`), at most 8, each with key, title and status badge. Everything else (cycles, `TASK_DONE`, the 50 limit) is the server's call.
- ↑/↓ and Enter (cmdk), or a click, picks; picking **links it right away**. Escape or Cancel closes.
- While linking: the input and list are disabled and the status line says "Adding MKT-3…".
- **Success:** the box closes, toast "MKT-7 is blocked by MKT-3". If the task just became `DEPENDENT`, the description says "It's Dependent until its blockers are done."
- **Errors** stay in the box (`role="alert"`), the box stays open: `getErrorMessage`, which shows the server's message for `DEPENDENCY_TASK_NOT_FOUND`, `DEPENDENCY_OTHER_PROGRAM`, `DEPENDENCY_EXISTS`, `DEPENDENCY_LIMIT_REACHED`, `TASK_DONE` (they name the tasks) and the mapped text for `SELF_DEPENDENCY` and `DEPENDENCY_CYCLE`. A 404 (this task deleted) toasts "This task has been deleted." and the page shows "Task not found".
- States: "Searching…", "Couldn't search tasks. Try again.", "No tasks match “x”." / "No other tasks in this program yet."

### Remove blocker

- Each "Blocked by" row gets a ghost icon button **×** ("Remove blocker MKT-3"), a spinner while it runs.
- **Success:** toast "Removed blocker MKT-3"; when the task leaves `DEPENDENT`, the description says "Status is back to In progress.".
- **Error:** toast `getErrorMessage` (404: the link or the task is gone); the task refetches.
- "Blocks" rows stay read-only: removing one means editing the other task, which has its own page.

## Comments

### Who sees what (UX only; the server enforces)

| Action | Shown to | Contract |
|---|---|---|
| Edit | the author (`comment.author.id === employee.id`) | `PATCH`: author only, ADMIN included; others 403 |
| Delete | ADMIN, MANAGER, or the author | `DELETE`: ADMIN or MANAGER, or the author |

Both sit next to Reply under the comment (ghost `sm`, blue, like Reply), on top-level comments and replies. A tombstone has none.

### Data (`features/comments/api.ts`)

```ts
useUpdateComment(target)  // useMutation<Comment, ApiError, { commentId, body }>
                          //   PATCH /programs/{programId}/comments/{commentId} { body }
useDeleteComment(target)  // useMutation<void, ApiError, string /* commentId */>
                          //   DELETE /programs/{programId}/comments/{commentId}
```

Both refetch the target's comments on success and on a 404, and stay pending until that refetch is done, so the form or dialog never shows the old comment after "Saved". The path has no task: comments are addressed by program and id for program and task comments alike.

### Edit (`CommentForm` with `editing`)

- **Edit** swaps the body for the comment form, prefilled and focused: `fromMentionTokens(body, mentions)` turns each `@[Label](mention:<uuid>)` into `@Name` (the **current** name from `mentions`, as shown) and pre-picks those people, so saving keeps them mentioned. New `@` picks work as when posting.
- Buttons: Cancel and **Save** ("Saving…"). Ctrl+Enter saves, Escape cancels (unless the @ list is open, which Escape closes first).
- **Success:** toast "Comment updated" / "Reply updated", the comment shows the new text and "(edited)".
- **Errors:** as when posting (spec 07): 400 `details` under the box, `TOO_MANY_MENTIONS` / `MENTION_NOT_FOUND` / 403 / 5xx in the alert, text kept. 404 (deleted meanwhile): toast "This comment has been deleted."; the list refetches.
- Saving an unchanged body still sends it (the contract sets `editedAt` anyway); not skipped, since the user pressed Save.

### Delete (`DeleteCommentButton`)

- `ConfirmDeleteDialog` with a ghost "Delete" trigger: "Delete this comment?" / "Delete this reply?". Description: a top-level comment with replies — "Its replies stay, under “This comment was deleted.”"; otherwise "This can't be undone." Confirm **Delete comment** / **Delete reply**.
- **Success:** toast "Comment deleted" / "Reply deleted"; the list refetches and the comment disappears (or becomes the tombstone), which closes the dialog.
- **404:** toast "This comment has already been deleted."; the list refetches. **403, 5xx:** alert in the dialog.

### `fromMentionTokens(body, mentions)` (`mentions.ts`)

Returns `{ text, people }`: the body with every token replaced by `@` + `mentionLabel(current name or the token's label)`, and the distinct `{ id, name }` people in order. Round trip: `toMentionTokens(text, people)` gives the same tokens (labels may change to the current name).

## Tests (Vitest + MSW + RTL)

| File | Case | Expect |
|---|---|---|
| `tasks/taskPage.test.tsx` | Add blocker, no text | newest tasks listed without the task itself and MKT-3 (already a blocker) |
| | type "venue", pick MKT-12 | `q=venue`; body `{ dependsOnTaskId }`; toast; MKT-12 under Blocked by; status Dependent |
| | 409 `DEPENDENCY_CYCLE` | message in the box, still open |
| | Remove MKT-3 | DELETE …/dependencies/{id}; toast with "Status is back to In progress." |
| `comments/mentions.test.ts` | `fromMentionTokens` | `@Jane Doe` text, people; round trip |
| `comments/programComments.test.tsx` | author: Edit → Save | PATCH body with the token kept; toast; edit form closes |
| | Escape | edit discarded, no request |
| | another MEMBER | no Edit, no Delete; MANAGER: Delete only |
| | Delete → confirm | DELETE; toast; list refetched |
| | delete 403 | alert in the dialog |

## Acceptance checklist

- [x] `npm run api:types` re-run (no diff); no hand-written API types
- [ ] Browser: add a blocker by search and by key; the task becomes Dependent when the blocker isn't done; remove it and the status comes back
- [ ] Browser: cycle, self, existing, `TASK_DONE` errors show in the box (their real server messages)
- [ ] Browser: edit own comment and reply, with a mention kept and one added; "(edited)" shows
- [ ] Browser: delete own comment as MEMBER; any comment as MANAGER; a top-level comment with replies leaves the tombstone
- [ ] Keyboard and 375 px: the blocker search and the comment edit form work without a mouse
- [x] `npm run typecheck`, `npm run build`, `npm run lint` (no new warnings), `npm test` (319) pass

## Verified

**Automated (Vitest + MSW, contract-shaped bodies): 319/319 tests pass across the repo** (304 before). New: 6 blocker cases in `tasks/taskPage.test.tsx` (newest tasks without self and current blockers, search + link + Dependent, 409 `DEPENDENCY_CYCLE` in the box, Escape, remove with the restored status, remove 404), 7 in `comments/programComments.test.tsx` (author edit keeping a mention, Escape, reply edit 403, who sees Edit / Delete as MEMBER and MANAGER, delete + refetch, replies-stay text + delete 403) and 2 for `fromMentionTokens` in `comments/mentions.test.ts`. Every earlier test passes unchanged, though MANAGER now sees Delete on every comment in them.

**Against the running backend (curl, 2026-10-20):** `npm run api:types` produced no diff. `POST …/tasks/{taskRef}/dependencies`, `DELETE …/dependencies/{id}`, `PATCH` and `DELETE /programs/{id}/comments/{commentId}` answer 401 `AUTH_REQUIRED` without a token and `INVALID_AUTH_TOKEN` with `Bearer abc`; the CORS preflight from `http://localhost:5173` allows `PATCH` and `DELETE` on the comment path.

**Still to do by hand:** everything that needs a signed-in session (the unticked items), including the server's wording for `DEPENDENCY_EXISTS`, `TASK_DONE` and the other codes whose message comes from the server.

## Implementation notes

- **cmdk names its input** with the Command's `label` (`aria-labelledby`), which overrides an `aria-label` on the input, so the search box's name ("Search tasks to add as a blocker") is the Command's `label`, as in `EmployeeMultiPicker`.
- **Deleting a comment uses `mutateAsync`.** The hook stays pending until the list has refetched, and that refetch removes the comment and its dialog; `mutate`'s per-call callbacks don't run once the component is gone, so the toast would be lost.
- **The edit form focuses once, when it opens** (caret after the text). It keys the effect on the parsed initial body, not on the comment, which is a new object after every refetch of the list.
- **`useTaskSaved`** in `tasks/api.ts` is the shared success handler of `PATCH` and both dependency calls (replace the cached task, refetch lists, mark other tasks stale).

## Out of scope / follow-ups

- Blockers in the create-task dialog (`dependsOn` on `POST …/tasks`).
- Adding or removing "blocks" links from this side (they're the other task's blockers).
- Deep links to a comment (`GET /programs/{id}/comments/{commentId}`).
- Rendering comment Markdown (needs a sanitising renderer).
