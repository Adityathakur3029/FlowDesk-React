# 13 — Status filter on the Programs page

**Status:** Implemented (2026-10-20). Automated checks pass; signed-in browser check pending (needs a real Google sign-in)
**Branch:** `overview`
**Depends on:** [07-programs](./07-programs.md) (`ProgramsPage`, `usePrograms`, `searchParams.ts`, `CreateProgramDialog`), [09-program-page-polish](./09-program-page-polish.md) (status tones, `ToneDot`)

## Goal

Filter the Programs list by status (Planned, Active, On hold, Completed, Cancelled), so you can see, for example, only the active programs. It's requested together with the Overview page ([14-overview](./14-overview.md)), which is blocked on the backend. This part isn't blocked.

## Flow

```
Browser                                                     FlowDesk API
  │ /programs → Status: Active                                  │
  │   URL becomes /programs?status=ACTIVE (offset dropped)      │
  │   GET /programs?status=ACTIVE&limit=20&offset=0             │
  │<────────────────────────────────────────────────────────────│ 200 { data, meta }
  │ Next page → /programs?status=ACTIVE&offset=20               │
  │ Status: All statuses / Clear filter → /programs             │
```

The contract's `GET /programs` takes **one** `status` (an enum, not a list), so the filter is a single select, not a multi-select.

## Packages

None new.

## Folder layout (new and changed)

```
src/features/programs/
  searchParams.ts                    CHANGED  ProgramSearch { status?, offset }: parse / toSearchParams / toListParams
  searchParams.test.ts               NEW      URL hygiene cases
  components/ProgramFilters.tsx      NEW      Status select (with tone dots) + Clear filter
  components/CreateProgramDialog.tsx CHANGED  onCreated(program) passes the created program
  pages/ProgramsPage.tsx             CHANGED  filter row; filtered empty state; show a new program even when filtered
  programs.test.tsx                  CHANGED  filter cases
```

It follows the People page's pattern (`features/employees/searchParams.ts`, `EmployeeFilters`): URL search params are the state, each change pushes a history entry (Back undoes it), and every filter change goes back to the first page.

## URL state (`searchParams.ts`)

```ts
interface ProgramSearch { status?: ProgramStatus; offset: number }
DEFAULT_PROGRAM_SEARCH = { offset: 0 }
parseProgramSearch(params)      // status must be one of PROGRAM_STATUSES, else ignored; offset as today
toProgramSearchParams(search)   // defaults left out: /programs, /programs?status=ACTIVE&offset=20
toProgramListParams(search)     // { status?, limit: 20, offset }
hasProgramFilters(search)       // status !== undefined
```

An invalid or hand-edited `status` (for example `?status=done`) is ignored instead of producing a 400, like the People filters.

## Filter row (`ProgramFilters`)

```
Status [● Active        ▾]   [Clear filter]
```

- Sits between `PageHeader` and the table. `Label` "Status" + `Select` (`w-44`): **All statuses**, then the five statuses in contract order, each with its `ToneDot` (as in the create dialog's Status select).
- **Clear filter** (ghost `sm`) shows only while a status is picked.
- Picking a status sets it and drops the offset.

## Programs page changes

- **Empty, filtered:** `EmptyState` "No {label} programs" (for example "No active programs") with a **Clear filter** button. The unfiltered empty states ("No programs yet", with or without Create) are unchanged.
- **"This page is empty"** (past the end) is unchanged: Go to first page keeps the filter.
- **Creating while filtered:** the dialog's `onCreated` now passes the created program. The page goes to page 1, as today. If the new program's status isn't the filtered one, the filter is cleared too, so the new program is in view.
- Pending, error and retry states are unchanged. The table keeps its previous rows dimmed while the filtered page loads (`keepPreviousData`, `busy`).

## Tests (Vitest + MSW + RTL)

| File | Case | Expect |
|---|---|---|
| `programs/searchParams.test.ts` | `?status=ACTIVE&offset=20` | parsed; round trip; list params `{ status: 'ACTIVE', limit: 20, offset: 20 }` |
| | `?status=done`, `?offset=-1` | ignored → defaults |
| `programs/programs.test.tsx` | pick Active | URL `?status=ACTIVE`; request `status=ACTIVE&limit=20&offset=0` |
| | `/programs?status=COMPLETED&offset=20` | request keeps both; select shows Completed |
| | filtered and empty | "No completed programs" + Clear filter → `/programs`, request without status |
| | create a Planned program while filtered to Active | filter cleared, first page requested |

## Acceptance checklist

- [x] `npm run api:types` re-run (no diff); `ProgramListParams` already has `status`
- [ ] Filter by each status in the browser; paging keeps the filter; Back undoes a change
- [x] Filtered empty state with Clear filter; unfiltered empty states unchanged (automated)
- [x] `npm run build`, `npm run lint` (no new warnings), `npm test` pass

## Verified

**Automated (Vitest + MSW): 333/333 tests pass across 26 files** (321 before). New: `programs/searchParams.test.ts` (7: valid params, four invalid inputs → defaults, round trip, defaults left out) and 5 cases in `programs/programs.test.tsx` (pick Active → `?status=ACTIVE` with `status=ACTIVE&limit=20&offset=0` from page 1; status and offset from the URL; "No completed programs" + Clear filter; creating a Planned program while filtered to Active clears the filter; creating an Active one keeps it). Existing program tests pass unchanged.

**Against the running backend (curl):** `GET /programs?status=ACTIVE` answers 401 `AUTH_REQUIRED` without a token and `INVALID_AUTH_TOKEN` with `Bearer abc`. The signed-in list needs a Google sign-in, so it's still the unticked browser item.

## Implementation notes

- `CreateProgramDialog`'s `onCreated` now receives the created `Program`. Its only caller is `ProgramsPage`.
- With a filter and no results, the page shows two "Clear filter" buttons (the filter row's and the empty state's), like People's "Clear filters".

## Out of scope / follow-ups

- Owner team filter (`ownerTeamId`) and name/key search (`q`). The contract supports both, and each would be one more field in `ProgramSearch`.
- Several statuses at once: the contract's `status` takes one value.
