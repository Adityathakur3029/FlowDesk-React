# 12 — Sidebar user menu, compact dependencies, scrollable dialogs (UI polish)

**Status:** Implemented (2026-10-20). Automated checks pass; browser checks pending (layout, scroll and truncation are CSS, which jsdom doesn't apply)
**Branch:** `ui_changes`
**Depends on:** [04-app-layout-people](./04-app-layout-people.md) (`AppShell`, `AppSidebar`, `Header`, `UserMenu`), [07-programs](./07-programs.md) (`CreateProgramDialog`), [10-task-page](./10-task-page.md) and [11-blockers-and-comment-editing](./11-blockers-and-comment-editing.md) (`TaskDependencies`, `AddBlocker`)

## Goal

Three UI changes, requested together. No API calls change.

1. **No header bar.** The top header goes away. Its user menu (avatar, name, role, Sign out) moves to the **bottom of the sidebar**, and the sidebar toggle moves there too. Phones keep a thin top bar with only the toggle, because the mobile sidebar is a slide-out sheet and needs a button to open it.
2. **Compact dependencies.** The task page's Dependencies card takes up too much room: two headings and two "None" lines when it's empty, and wrapping rows when it isn't. It becomes one card with **Add blocker** in its header, one "No dependencies." line when empty, and single-line rows.
3. **Scrollable dialogs.** Create program runs past the top and bottom of short windows and can't be scrolled. Dialogs get a maximum height and a scrolling body, with the title and buttons kept in view. The fix goes into the shared `DialogContent`, so it covers every form dialog.

Decisions (accepted by the user):
- Phones keep a top bar, `md:hidden`, with only the toggle and the logo. Desktop has no bar.
- Dependency groups show **5 rows**, then "Show N more".

## Packages

None new. `SidebarFooter`, `CardAction` and the `xs` button size are already in `src/components/ui`.

## Folder layout (new and changed)

```
src/
  components/
    ui/dialog.tsx                         CHANGED  DialogContent capped at the viewport (flex column); new DialogBody slot
    layout/
      AppShell.tsx                        CHANGED  MobileTopBar instead of Header
      AppSidebar.tsx                      CHANGED  SidebarFooter: collapse button (desktop) + SidebarUserMenu
      SidebarUserMenu.tsx                 NEW      replaces UserMenu: sidebar button with avatar, name, role → dropdown
      MobileTopBar.tsx                    NEW      replaces Header: md:hidden bar with SidebarTrigger + logo
      Header.tsx                          DELETED
      UserMenu.tsx                        DELETED
      layout.test.tsx                     CHANGED  footer user menu, collapse button
  features/
    tasks/components/TaskDependencies.tsx CHANGED  compact layout (below)
    tasks/taskPage.test.tsx               CHANGED  empty line, show more
    programs/components/CreateProgramDialog.tsx   CHANGED  form inside DialogBody
    tasks/components/CreateTaskDialog.tsx         CHANGED  form inside DialogBody; its one-off max-h/overflow classes go
    employees/components/EditEmployeeDialog.tsx   CHANGED  form inside DialogBody
    invites/components/InviteMemberDialog.tsx     CHANGED  form inside DialogBody
.claude/CLAUDE.md                         CHANGED  layout/ folder line, AppShell convention
.claude/specs/04-app-layout-people.md     CHANGED  note that spec 12 replaced the header
```

## 1. Sidebar user menu (no header)

```
Desktop, expanded                 Desktop, collapsed       Phone
┌────────────────────┐            ┌──┐                     ┌──────────────────────────┐
│ [logo] FlowDesk    │            │▣ │                     │ [≡] [logo] FlowDesk      │  MobileTopBar
│ Workspace          │            │  │                     ├──────────────────────────┤
│  ▤ Programs        │            │▤ │                     │ page content             │
│  ☺ People          │            │☺ │                     │                          │
│  ☺ Teams           │            │☺ │                     └──────────────────────────┘
│                    │            │  │                     [≡] opens the sidebar sheet;
│  ◧ Collapse sidebar│            │◨ │  tooltip "Expand"   its footer has the user menu
│ (JD) Jane Doe    ⇕ │            │JD│                     (no collapse button there)
│      Manager       │            └──┘
└────────────────────┘
```

**`SidebarFooter`** (in `AppSidebar`) holds one `SidebarMenu` with:
- **Collapse button, desktop only** (not rendered when `useSidebar().isMobile`): a `SidebarMenuButton` that calls `toggleSidebar()`. Icon and text follow the state: `PanelLeftClose` + "Collapse sidebar" when expanded, `PanelLeftOpen` + "Expand sidebar" when collapsed (the text is the accessible name, and the tooltip when collapsed). The rail and Ctrl/⌘+B still work.
- **`SidebarUserMenu`**.

**`SidebarUserMenu`** (replaces `UserMenu`):
- The trigger is a `SidebarMenuButton size="lg"` inside `DropdownMenuTrigger asChild`: `Avatar` with `initials(name)`, then name (`font-medium`, truncated) over the role label (`ROLE_LABELS`, `text-xs`, muted), then a `ChevronsUpDown` icon. When collapsed, the button shrinks to the avatar (built into `size="lg"`).
- Accessible name stays **"Account menu for {name}"**, so the existing auth and layout tests find it.
- No tooltip on it. `SidebarMenuButton`'s tooltip wraps the button in `Tooltip`, which would swallow the props `DropdownMenuTrigger asChild` passes. The name is in the aria-label.
- The menu opens to the right of the sidebar (`side="right" align="end"`), or above the button on phones (`side="top"`). Same contents as today: name, email, role badge, separator, **Sign out** → `signOut()`.
- Renders nothing without an `employee`, as now.

**`MobileTopBar`** (replaces `Header`): `md:hidden`, sticky, `h-12`, bottom border. It holds `SidebarTrigger` (aria-label "Toggle sidebar") and a link to `paths.home` with `SaajhaLogo` (24 px) and "FlowDesk". It's hidden with CSS rather than `isMobile`, because `useIsMobile` is `false` on the first render and the bar would flash in on phones. The `md` breakpoint (768 px) is the same one `useIsMobile` uses.

**`AppShell`** renders `MobileTopBar` where `Header` was. Nothing depends on the old header's height.

## 2. Compact dependencies (`TaskDependencies`)

```
┌ Dependencies ─────────────────────────────── [+ Add blocker] ┐
│ This task waits for its blockers. …          (when DEPENDENT) │
│ [ 🔍 Search tasks by title or key ]  [Cancel]   (when adding) │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ BLOCKED BY                                               │ │
│ │ MKT-3   Finalise sample for the survey…   (Done)      ×  │ │
│ │ MKT-5   Book the venue                    (To do)     ×  │ │
│ │ Show 2 more                                              │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ BLOCKS                                                   │ │
│ │ MKT-9   Launch survey                     (Dependent)    │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
Empty:  Dependencies                              [+ Add blocker]
        No dependencies.
```

- **Add blocker** moves into `CardAction` in the card header. It's hidden while the search box is open, and focus goes back to it when the box closes, as now.
- **Empty** (no blockers, blocks nothing): one muted line, "No dependencies.". It's hidden while the search box is open.
- **A side with no tasks isn't rendered.** "Blocks" is read-only here, so an empty one offers nothing, and an empty "Blocked by" has its action in the header.
- **One bordered box** (`rounded-lg border divide-y`) holds the non-empty groups. Each group has a small label (`h3`, `text-xs` uppercase, muted) and a `<ul aria-labelledby>`, so "Blocked by" and "Blocks" are still named lists.
- **Rows are one line:** `px-3 py-1.5`, key (`font-mono text-xs`, no shrink), title truncated with the full title in `title`, status badge, and for "Blocked by" the remove button. The link's accessible name is still "MKT-3 Finalise sample".
- **Long groups:** the first 5 rows, then an `xs` ghost button "Show N more" / "Show less" (per group, local state). A blocker added while the group is collapsed may sit behind "Show more". The toast still confirms it.
- The DEPENDENT description and all add/remove behaviour from spec 11 are unchanged.

## 3. Scrollable dialogs (`dialog.tsx`)

> Why the change goes into the shared component and not one dialog: `DialogContent` is centred (`top-1/2 -translate-y-1/2`) with no maximum height, so any tall dialog spills off both edges. `CreateTaskDialog` already had a one-off fix. One shared slot keeps the next dialog from needing its own.

- **`DialogContent`**: `grid` → `flex flex-col` (same vertical stacking with `gap-4`, but a child can shrink), plus `max-h-[calc(100svh-2rem)]`. A comment marks the local change, since `npx shadcn add dialog --overwrite` would drop it.
- **New `DialogBody`**: `-mx-4 -my-1 min-h-0 overflow-y-auto px-4 py-1`. The negative margins plus padding let it span the full width while keeping the 3 px focus rings of edge inputs unclipped. The header and footer keep their natural height, so only the body scrolls and Cancel/Create stay visible.
- Each form dialog wraps its `<form>` in `<DialogBody>`. The submit button already sits outside the form (`form="…-form"`), so nothing else moves:
  - `CreateProgramDialog` (the request)
  - `CreateTaskDialog`: replaces its `max-h-[calc(100svh-2rem)] overflow-y-auto` on `DialogContent`. The title and buttons now stay in place instead of scrolling away.
  - `EditEmployeeDialog`, `InviteMemberDialog`: short today, so no scrollbar appears. Wrapped so they behave the same once they grow.
- **`CreateTeamDialog` is left as is.** Its last field is `EmployeeMultiPicker`, whose suggestion list is `absolute` and currently floats over the footer. A scrolling body would clip it. The dialog's height is already capped, because selected people scroll inside the picker (`max-h-32`).
- `ConfirmDeleteDialog` uses `AlertDialog`, a separate component, and is unchanged.

## Tests (Vitest + MSW + RTL)

| File | Case | Expect |
|---|---|---|
| `layout/layout.test.tsx` | signed in | the sidebar shows "Jane Doe" and "Manager" in the account button; no "Toggle sidebar" header is needed on desktop |
| | Collapse sidebar | the button becomes "Expand sidebar"; clicking it again restores "Collapse sidebar" |
| | user menu (existing) | opens from the sidebar button, signs out to `/login` (unchanged assertions) |
| `tasks/taskPage.test.tsx` | no links (existing) | Labels "None" + "No dependencies."; no "Blocked by"/"Blocks" lists |
| | 7 blockers | 5 rows, "Show 2 more" → 7 rows, "Show less" → 5 |
| | existing blocker cases | unchanged (named lists, Add blocker, remove) |

## Acceptance checklist

- [ ] Desktop: no top bar; the sidebar footer shows the avatar, name and role; the menu opens to the right with name, email, role and Sign out
- [ ] Desktop: Collapse/Expand button works; collapsed shows only the avatar; the state survives a reload (cookie)
- [ ] 375 px: the top bar's toggle opens the sidebar sheet; the user menu works from its footer; no collapse button in the sheet
- [ ] Task with no links: one "No dependencies." line; Add blocker in the card header
- [ ] Task with links: single-line rows, long titles truncated (full title on hover), "Show N more" past 5
- [ ] ~600 px tall window: Create program's fields scroll, title and Cancel/Create stay visible; focus rings aren't cut off
- [ ] Create task: same; the assignee picker's list scrolls inside the body
- [ ] Keyboard: tab reaches the collapse button and account menu; Escape closes the menu; dialog focus trap unchanged
- [x] `npm run build`, `npm run lint` (no new warnings), `npm test` pass

## Verified

**Automated (Vitest + MSW + RTL): 321/321 tests pass across 25 files** (319 before). New: the sidebar footer case in `layout/layout.test.tsx` (the account button shows name and role; Collapse → Expand → Collapse; the cookie ends `sidebar_state=true`) and "Show 2 more" / "Show less" in `tasks/taskPage.test.tsx`. Changed: the empty-links case now expects "No dependencies." and no lists. The existing user-menu, sign-out and blocker tests pass unchanged, because the accessible names were kept.

`npx tsc -b` and `npm run build` pass. `npm run lint` shows only the 6 existing warnings, all in files this spec doesn't touch.

**Not verified:** every browser item above. jsdom doesn't apply Tailwind, so `max-h`, `overflow`, `truncate`, `md:hidden` and the collapsed avatar need a real browser, and the signed-in pages need a Google sign-in.

## Implementation notes

- `DialogBody` doesn't use `flex-1`. A shrinkable `min-h-0` child of the capped flex column is enough, and a `0%` basis inside an auto-height column is easy to get wrong.
- The flex `<form>` wrap was scripted, so the four dialogs changed only by the wrapper lines and the import (`git diff -w`).
- One full-suite run failed `auth.test.tsx › ends the session on a 401 from /auth/me` (`currentUrl()` was still `/`). It passed 3/3 alone and in the next two full runs. The test reads the location spy right after the message renders, so it can lag one tick under load. That race existed before this spec, and the path doesn't render the shell.

## Out of scope / follow-ups

- Rendering `EmployeeMultiPicker`'s suggestion list in a portal (Radix Popover), so it can float over a scrolling dialog body. After that, `CreateTeamDialog` can use `DialogBody` too.
- Expanding a collapsed "Blocked by" group automatically when a newly added blocker would be hidden.
- A light/dark theme toggle in the user menu (spec 04's follow-up).
