# 09 — Program page polish (inline editing, status colours, blue comments, @-mentions)

**Status:** Implemented (2026-10-19). Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `enhancements`
**Depends on:** [06-teams-and-member-editing](./06-teams-and-member-editing.md) (`useEmployeeSearch`), [07-programs](./07-programs.md) (`ProgramPage`, `ProgramComments`, `ProgramStatusBadge`), [08-tasks](./08-tasks.md) (`taskDisplay.ts`, `TaskTable`, `CreateTaskDialog`, `TaskFilters`)

## Goal

Requested as a list of program page improvements:

0. **Edit the program on its page, like Jira** (ADMIN, MANAGER): the **name**, **description**, **start date**, **end date** and **status**, each in place, saved on its own.
1. **Comments section in blue.** The program page's Comments tab is a blue panel: blue buttons, focus rings, avatars, mention pills and thread cards.
2. **A more appealing program page.** A header card with a status-coloured strip, the program key as a tile, and the status badge; the description in a card; icons on the details and on the tabs.
3. **@-mentions in comments.** Typing `@` and a name in a comment or reply box lists matching people; picking one inserts `@Name`, and posting sends the contract's mention token.
4. **Colours for program status, task type and task status** (and task priority), everywhere they're shown: badges, the task table, and the options of every select that picks one.

## Flow

**Editing the program** (ADMIN, MANAGER; MEMBERs see the same page read-only):

| Field | Opens with | Editor | Saves | PATCH body |
|---|---|---|---|---|
| Name | click the title, or the pencil next to it ("Edit name") | text input in the h1's place | Enter or Save | `{ name }` (trimmed) |
| Status | click the status badge ("Status: Active. Change status") | menu of the five statuses with their colours | picking one | `{ status }` |
| Description | click the text, or Edit / Add in the card header | textarea | Ctrl+Enter or Save | `{ description }`; blank → `null` |
| Start / End date | click the date in Details ("Edit start date, 1 Oct 2026") | date input across the row, plus Clear date | Enter, Save, or Clear date | `{ startDate }` / `{ endDate }`; cleared → `null` |

Escape or Cancel discards. Saving an unchanged value closes without a request. On success: toast ("Name updated", "Status changed to On hold"), the editor closes, focus goes back to the button that opened it, the program's cached detail is replaced by the response and the Programs list refetches. The status badge shows the picked status while it saves and falls back if the save fails.

**Mentioning someone.** Type `@` at the start of the text or after a space or `(` → "Type a name to mention someone." → type `ja` → up to 6 active employees matching `GET /employees?q=ja&limit=20` (name or email, best match first) → ↑/↓ move, **Enter** or **Tab** picks, **Escape** closes, a click picks → the box now reads `@Jane Doe ` and a "Mentioning @Jane Doe" line appears under it → **Post comment** sends `@[Jane Doe](mention:<uuid>)` in place of `@Jane Doe`. Editing the name in the box (or deleting it) turns it back into plain text, which is how a mention is removed before posting. A name typed by hand without picking stays text (`@Ravi Kumar`), as does an email address.

## Environment variables

None.

## Packages

None. The list is hand-rolled (`role="listbox"`), because cmdk's root swallows Enter, which a textarea needs for new lines.

## Folder layout (new and changed)

```
src/
  index.css                                    CHANGED  .theme-comments: primary/ring are blue inside the comments panel
  lib/tones.ts                                 NEW      Tone + badge/dot/solid/text classes per tone
  components/data/ToneBadge.tsx                NEW      ToneBadge (pill with a dot), ToneDot (select options)
  components/layout/PageHeader.tsx             CHANGED  optional `heading` replaces the default h1 (the name editor)
  features/
    comments/
      mentions.ts                              NEW      findMentionQuery, insertMention, toMentionTokens, mentionedIn
      mentions.test.ts                         NEW
      types.ts                                 CHANGED  MentionedPerson = Pick<EmployeeSummary, 'id' | 'name'>
      index.ts                                 CHANGED  comment: comments now imports @/features/employees
      components/MentionTextarea.tsx           NEW      textarea + @ suggestion list
      components/CommentForm.tsx               CHANGED  MentionTextarea, tokens on submit, "Mentioning" line, avatar, hint
      components/ProgramComments.tsx           CHANGED  blue panel, header with thread count, carded composer/empty state
      components/CommentThread.tsx             CHANGED  each thread is a card; blue reply rail and Reply button
      components/CommentItem.tsx               CHANGED  blue avatar
      components/CommentBody.tsx               CHANGED  mentions as blue pills
      programComments.test.tsx                 CHANGED  two @-mention tests
    employees/index.ts                         CHANGED  exports useEmployeeSearch
    programs/
      api.ts                                   CHANGED  useUpdateProgram (PATCH)
      types.ts                                 CHANGED  UpdateProgramRequest
      useInlineEdit.ts                         NEW      editor open/closed + focus back to its trigger
      components/ProgramFieldEditor.tsx        NEW      one-field form: name, description, start date, end date
      components/ProgramStatusMenu.tsx         NEW      status badge as a menu
      programPage.test.tsx                     CHANGED  nine editing tests
      programStatus.ts                         CHANGED  PROGRAM_STATUS_TONES replaces PROGRAM_STATUS_VARIANTS
      components/ProgramStatusBadge.tsx        CHANGED  ToneBadge
      components/CreateProgramDialog.tsx       CHANGED  status options with a dot
      pages/ProgramPage.tsx                    CHANGED  header card, description card, detail and tab icons
    tasks/
      taskDisplay.ts                           CHANGED  TASK_STATUS_TONES, TASK_TYPE_TONES, TASK_TYPE_ICONS, TASK_PRIORITY_TONES
      components/TaskTypeLabel.tsx             NEW      coloured icon square + label
      components/TaskStatusBadge.tsx           CHANGED  ToneBadge
      components/TaskPriorityLabel.tsx         CHANGED  icon colour per priority
      components/TaskTable.tsx                 CHANGED  Type column uses TaskTypeLabel
      components/CreateTaskDialog.tsx          CHANGED  type, status and priority options coloured
      components/TaskFilters.tsx               CHANGED  status options with a dot
```

## Editing (`useUpdateProgram`, `ProgramFieldEditor`, `ProgramStatusMenu`)

- **API:** `PATCH /programs/{programId}` with **only the edited field**, so two people editing different fields don't overwrite each other. ADMIN or MANAGER (`EDIT_PROGRAM_ROLES` on the page, UX only). `key` is immutable and isn't offered; `ownerTeamId` isn't offered yet (Out of scope).
- **Validation (instant feedback only):** `programSchema`'s rules: name trimmed 1-150, description ≤ 10,000, dates `YYYY-MM-DD` or blank. The date range is left to the server, which checks the **merged** values.
- **Errors:**

  | Response | Shown |
  |---|---|
  | 400 `details` (`path` = the field) | under the input |
  | 400 `INVALID_DATE_RANGE` | under the date: "The end date must be on or after the start date." / "The start date must be on or before the end date." (the shared message talks about due dates) |
  | 403 `FORBIDDEN`, 5xx, network | alert in the editor, text kept, input refocused; status menu: toast |
  | 404 (deleted meanwhile) | toast "This program has been deleted."; the detail refetches and the page shows "Program not found" |
  | 401 | client middleware (session cleared, login) |

## Colours (`lib/tones.ts`)

Display only. The label is always shown, so colour is never the only signal (WCAG 1.4.1). Badge text is the 800/900 shade on the 100 tint (above 4.5:1); the type icon squares are 600 fills behind a white icon (above 3:1).

One meaning across programs and tasks: not started = violet, in progress = blue, on hold = amber, done = green, stopped or blocked = red.

| Program status | Tone | Task status | Tone | Task type | Tone, icon | Priority | Tone |
|---|---|---|---|---|---|---|---|
| Planned | violet | Discussion | violet | Pre | sky, `ClipboardList` | Lowest | sky |
| Active | blue | In progress | blue | Task | blue, `SquareCheck` | Low | blue |
| On hold | amber | On hold | amber | Post | violet, `Flag` | Medium | amber |
| Completed | green | Done | green | Bug | red, `Bug` | High | orange |
| Cancelled | red | Dependent | red | Issue | orange, `CircleAlert` | Highest | red |

The header strip on the program page uses the program status's tone.

## Blue comments section

`ProgramComments` is a `theme-comments` panel (`border-blue-200 bg-blue-50/70`). `.theme-comments` redefines `--primary` (blue 700, white text 6.7:1) and `--ring` (blue 600), so shadcn buttons and focus rings inside it turn blue with no per-component overrides; tinted surfaces use Tailwind's blue palette. The rest of the app keeps the Saajha amber.

## @-mentions (`mentions.ts`, `MentionTextarea`)

- **API:** `GET /employees?q=<query>&limit=20` via `useEmployeeSearch` (same query keys as the people pickers), debounced 200 ms. It returns active employees only, so `MENTION_NOT_FOUND` only happens if someone is deactivated between picking and posting.
- **Trigger** (`findMentionQuery`): the `@` before the caret starts the text or follows whitespace or `(`; the query has no line break, `@`, `[`, `]`, `(`, `)`, no leading or double space, at most 2 spaces and 50 characters.
- **Token** (`toMentionTokens`): on submit, each picked person's `@Name` (whole word, longest name first) becomes `@[Name](mention:<uuid>)`. Brackets are stripped from the label. If two picked people have exactly the same name, the first one picked wins.
- **Accessibility:** the textarea has `aria-autocomplete="list"`, `aria-controls` and `aria-activedescendant` pointing at the `role="listbox"` options; the hint "Type @ to mention someone. Ctrl+Enter posts." is in its `aria-describedby`. Clicking an option keeps focus in the textarea.
- **Errors:** unchanged from spec 07. `TOO_MANY_MENTIONS` (more than 20 people) and `MENTION_NOT_FOUND` land in the form's alert; the body's length limit is checked by the server on the tokenised body, and a 400 `details` path `body` lands on the box.

## Tests (Vitest + MSW + RTL)

| File | Case | Expect |
|---|---|---|
| `features/programs/programPage.test.tsx` | rename (Enter) | body `{ name: 'Market Study' }` (trimmed); new h1; toast; focus back on "Edit name" |
| | Save unchanged; Escape | no request; old name |
| | status menu → On hold | `{ status: 'ON_HOLD' }`; toast; badge says On hold |
| | description Ctrl+Enter, then cleared | `{ description: 'New scope' }`, `{ description: null }`; "No description."; "Add description" |
| | start date changed; end date Clear date | `{ startDate: '2026-10-15' }`, `{ endDate: null }`; Details updated |
| | 400 `INVALID_DATE_RANGE` | message under End date, `aria-invalid`, focused |
| | 403; 400 `details` path `name` | alert, text kept; message under the name |
| | MEMBER | no Edit name, status menu, description or date buttons |
| `features/comments/mentions.test.ts` | query at caret; emails, double spaces, line breaks; insert; tokens; mentionedIn | as in the Mentions section |
| `features/comments/programComments.test.tsx` | type `Thanks @ja`, Enter, type `please review`, post | Jane listed and active, Ravi not; box `Thanks @Jane Doe `; "Mentioning @Jane Doe"; body has the token |
| | `@zz` + Escape; `@Ravi Kumar` typed, not picked | "No one matches" closes; body posted as typed |

Existing program page, programs and tasks tests pass unchanged (labels, roles and accessible names didn't change).

## Acceptance checklist

- [x] `npm run api:types` re-run: no contract change
- [x] `npm run build`, `npm run lint` (no new warnings) and `npm test` (279) pass
- [ ] Browser, as MANAGER: rename, change status, edit and clear the description, change and clear both dates; an end date before the start date shows the range error; the Programs list shows the new name and status
- [ ] Browser, as MEMBER: nothing is editable; as a MANAGER demoted to MEMBER in another tab, a save shows the 403 alert
- [ ] Browser: program page header, details icons, tabs; Comments tab is blue; badges coloured on the Programs page and the Tasks tab
- [ ] Browser: `@` in a comment and in a reply lists people; keyboard and mouse picks; the posted comment shows the blue `@Name` pill
- [ ] Browser: create-task and create-program selects show the coloured options

## Contract notes

None new. The contract already describes the `@`-autocomplete ("the frontend inserts it from an @-autocomplete backed by `GET /employees`").

## Out of scope / follow-ups

- Changing the owner team on the program page (`PATCH { ownerTeamId }`, 400 `OWNER_TEAM_NOT_FOUND`), and deleting a program (`DELETE`, ADMIN only).
- Highlighting mentions inside the textarea while typing (needs an overlay or a rich-text editor).
- Placing the suggestion list at the caret instead of under the box.
- Dark mode: the tones and blue panel have `dark:` styles, but the app has no theme switch yet.
