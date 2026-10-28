# 14 — Overview (organisation report for a period)

**Status:** Implemented (2026-10-20). Automated checks pass; signed-in browser checks pending (need a real Google sign-in)
**Branch:** `overview`
**Depends on:** [12-layout-and-density](./12-layout-and-density.md) (sidebar), [13-program-status-filter](./13-program-status-filter.md) (same branch), [07-programs](./07-programs.md) / [08-tasks](./08-tasks.md) (status, priority and tone tables)

## Goal

A page for leadership: "how has the organisation done over this period?" It sits in the sidebar **below Programs**.

1. **Period filter**, one row above everything: **Last 12 months** (default), **Last 3 months**, **Last month**, **Custom range** (from / to dates + Apply). Every number on the page is for that period.
2. **Headline numbers**: programs running, programs completed, tasks created and completed (vs the previous period), on-time delivery, overdue work right now.
3. **Programs by status** and **tasks by status** as part-to-whole bars with counts and percents.
4. **Throughput trend**: tasks created vs completed per week or month, as a chart with a table view.
5. **By team**: tasks each owner team completed, with open and overdue work.
6. **Open tasks by priority**.
7. **Program report**: one row per program, with progress, completions in the period, open and overdue tasks, and the at-risk flag.

## History

The contract first had no reporting endpoint (CLAUDE.md gap 7), so this spec started as a design plus a proposal for the backend. The backend shipped `GET /reports/overview` on 2026-10-20 (backend commit `e7a3fb1`, which also added `Program.completedAt` / `cancelledAt`). `npm run api:types` picked it up, and this spec now follows the shipped contract.

## Contract (`GET /reports/overview?from&to`)

- **Auth:** bearer. **Roles:** any active employee (no 403), so the nav item has no `roles`.
- **Params:** `from`, `to`: UTC calendar dates, both inclusive, both required. `to` may be in the future.
- **200** `{ data: OverviewReport }`: `period { from, to, days, granularity }`, `previousPeriod { from, to, days }`, `asOf` (today, UTC), `totals`, `programsByStatus`, `tasksByStatus`, `openTasksByPriority`, `trend[]`, `teams[]` (by name, no-team row last), `programs[]` (at risk first, then overdue tasks desc, then name; unpaginated).
- **400:** validation (`details[].path` `from`/`to`), `INVALID_DATE_RANGE` (from after to), `DATE_RANGE_TOO_LONG` (over 1096 days). **401**, **500**.
- **Definitions** (in the operation description): in-scope programs are those not finished before the period. Event counts (`tasksCreated*`, `tasksCompleted*`, `trend`) cover every live task. Snapshot and breakdown counts cover in-scope programs only. Statuses are **current** (there's no history). Open and overdue numbers are as of `asOf`. The trend is weekly (ISO weeks) up to 92 days, otherwise monthly.

Differences from the proposal: `period.days` and `asOf` were added; `teams` are ordered by name; there's no role restriction; there's a range cap with its own code. Nothing was missing or ambiguous, so there are no gaps to report.

## Packages

| Package | Kind | Purpose |
|---|---|---|
| shadcn `chart` → `src/components/ui/chart.tsx`, `recharts@^3.8.0` | NEW (approved 2026-10-20) | the trend line chart (axes, crosshair tooltip) |

The status, team and priority bars are plain HTML/Tailwind. They need no axes, render in jsdom tests, and keep their labels as real text. The route is **lazy-loaded**, so Recharts (108 KB gzipped) only downloads when someone opens Overview. The main bundle stays at 247 KB gzipped.

## Folder layout (new and changed)

```
src/
  api/errors.ts                          CHANGED  DATE_RANGE_TOO_LONG code + message
  api/schema.d.ts                        REGENERATED  /reports/overview, Program.completedAt/cancelledAt
  components/ui/chart.tsx                NEW (shadcn add chart)
  components/layout/navItems.ts          CHANGED  Overview below Programs (ChartColumn icon)
  lib/tones.ts                           CHANGED  TONE_CHART_CLASSES (validated chart fills)
  routes/paths.ts, routes/router.tsx     CHANGED  /overview, lazy + Suspense (PageLoader)
  features/programs/index.ts             CHANGED  exports ProgramStatusBadge, PROGRAM_STATUS_LABELS/TONES (leaves, no cycle)
  features/tasks/index.ts                CHANGED  exports task status and priority tables (leaves)
  features/overview/                     NEW      (no index.ts: no other feature imports it)
    api.ts                               overviewKeys, fetchOverview, useOverview (keepPreviousData)
    types.ts                             aliases of the generated report schemas
    period.ts / period.test.ts           presets, URL parse/serialize, preset → { from, to }, END_BEFORE_START
    format.ts                            plural, percent, formatRange, trend tick formats
    statusBreakdowns.ts                  status → breakdown items in the validated colour order
    components/PeriodFilter.tsx          preset select + custom From/To + Apply
    components/StatTiles.tsx             the six headline tiles
    components/StatusBreakdown.tsx       part-to-whole bar + legend
    components/TrendChart.tsx            created vs completed lines, or a table
    components/HBar.tsx                  single-series bar with the value at the tip
    components/TeamReport.tsx, PriorityBars.tsx, ProgramReportTable.tsx
    pages/OverviewPage.tsx
    overview.test.tsx
  test fixtures (programs, programPage, taskPage)  CHANGED  completedAt / cancelledAt: null on Program
```

## Period (`period.ts`)

| URL | Range sent |
|---|---|
| `/overview` (default) | `from` = the day after the same date 12 months ago, `to` = today |
| `?period=3m` / `?period=1m` | same, 3 / 1 months |
| `?period=custom&from=2026-01-01&to=2026-03-31` | as given |

- "Same date" is clamped to the shorter month: one month back from 31 Mar starts 1 Mar. "Today" is the browser's local calendar date. The server's `asOf` is UTC, so near midnight the two can differ by a day.
- Unknown presets and malformed or impossible dates (`2026-02-30`) fall back to the default. A reversed or too-long custom range is sent, and the server's 400 is shown.
- **Custom** opens From/To inputs prefilled with the current range. **Apply** sends them, so a half-edited range never fires a request. Before sending, the form checks that both dates are set and that start ≤ end (instant feedback only, mirroring `INVALID_DATE_RANGE`).
- The filter remounts whenever the URL's period changes (preset, Apply, Back), which resets its draft.

## Sections

- **Stat tiles** (`grid-cols-2 md:grid-cols-3 xl:grid-cols-6`):
  - Programs running: "N active now".
  - Programs completed: "In this period".
  - Tasks created: change vs the previous period, uncoloured, because up isn't simply good.
  - Tasks completed: change vs the previous period, green for up and red for down, always with an arrow icon and words ("Up 23% vs the previous period"). "None in the previous period" when the previous count is 0.
  - On-time delivery: `onTime / withDueDate` as a whole percent with "22 of 29 with a due date", or "—" with "No completed task had a due date".
  - Overdue now: a warning icon when above 0, then "N programs at risk · N open".
- **Status breakdowns:**
  - One 12 px bar with 2 px gaps and 4 px rounded ends. Zero segments are left out of the bar but stay in the legend.
  - The legend always shows dot + label + count + percent, so no value needs a hover. The bar is `aria-hidden` and the legend list (named after the card) carries the values.
  - Each segment has a hover tooltip. The description says the statuses are current ones.
- **Trend:**
  - Recharts `LineChart`: Completed in emerald-600 (the point) and Created in slate (context). 2 px straight lines (a single bucket gets dots), one y-axis, a crosshair tooltip with line keys, and a line-key legend.
  - End values are labelled unless the two last values are within 10% of the largest value, where the labels would collide. The legend and tooltip carry them instead.
  - **Show table** swaps the chart for a Week/Month, Created, Completed table with a Total row (`aria-pressed`).
- **By team:** server order. Name ("No owner team" for the null row), "N programs · N open · N overdue" (warning icon when overdue), and an emerald bar for tasks completed with the value at its tip.
- **Open tasks by priority:** Highest → Lowest, each with its existing priority icon and label, and blue bars with counts.
- **Programs:** server order. Columns:
  - key + name (links to the program)
  - owner team ("No owner team")
  - `ProgramStatusBadge`
  - progress meter (emerald on a lighter emerald track) with "22/40" (screen readers hear "22 of 40 tasks done"; "No tasks" when there are none)
  - done in period, open, overdue (warning icon when above 0)
  - end date (UTC, "Not set"), plus an **At risk** badge (icon + text) from the server's `atRisk`

  The first 10 rows show, then "Show all N". The table scrolls sideways on phones.

## Colour (dataviz checker, 2026-10-20)

| Slot | Programs | Tasks | Light (white card) | Dark (`#171717` card) |
|---|---|---|---|---|
| 1 | Planned | Discussion | violet-500 | violet-500 |
| 2 | On hold | On hold | amber-500 | amber-600 |
| 3 | Active | In progress | blue-500 | blue-500 |
| 4 | Completed | Done | emerald-500 | emerald-600 |
| 5 | Cancelled | Dependent | red-500 | red-500 |

- **Light:** CVD worst ΔE 8.1 (red↔green, deutan), normal-vision worst 26.5. **PASS.** Amber and emerald are below 3:1 against the card, so the legend always shows labels and counts.
- **Dark:** with the 500s, amber and emerald were too light for the band, so they step to 600. Then every check passes (CVD worst 9.6, contrast all ≥ 3:1).
- **Trend (emphasis):** Completed emerald-600 against Created slate-400 (light) or slate-600 (dark). CVD ΔE 12.0 light and 16.7 dark; normal vision 17.7 and 20.2. The slate fails the chroma floor and, in dark, the lightness band. That's intended: it's the de-emphasis gray, not a categorical slot. Its sub-3:1 contrast is covered by the legend, end labels and table view.
- The contract's enum order (violet next to blue) failed at ΔE 1.3, which is why the segments use the order above. The tones are `TONE_CHART_CLASSES` in `lib/tones.ts`.
- The app has no theme toggle yet, so dark mode can't be reached today. The dark steps are ready for when it can.

## States

| State | Handling |
|---|---|
| first load | skeleton tiles and cards (`role="status"`); the filter row is usable |
| period change | previous report stays, dimmed to 60% (`aria-busy`), no skeleton flash |
| empty (no programs, nothing created or completed) | `EmptyState` "Nothing to report for this period" + Go to Programs |
| 400 (custom range) | message under the inputs (`role="alert"`, inputs `aria-invalid`); report area says "No report for these dates" |
| 401 | client middleware (session cleared, login) |
| 5xx | `ErrorState` "Couldn't load the overview" with Retry (queries retry 5xx twice first) |

## Tests

- `overview/period.test.ts` (18):
  - presets → ranges, including month-end and leap-day clamping
  - custom ranges sent as given
  - URL hygiene, including impossible dates
  - a reversed range kept for the server
  - round trip
  - calendar-date checks and local today
- `overview/overview.test.tsx` (11), with the contract's example report and Date faked to 20 Oct 2026:
  - the nav order and `aria-current`
  - the default 12-month request and subtitle
  - all six tiles
  - legend rows in the validated order (programs, tasks, priorities)
  - the trend table with totals
  - team rows and program rows (link, "22 of 40 tasks done", At risk, No owner team, Not set)
  - switching to 3 months keeps the old report with `aria-busy` until the new one lands
  - custom range: prefilled inputs, nothing sent before Apply, URL and request after
  - the client order check (nothing sent)
  - `DATE_RANGE_TOO_LONG` under the inputs
  - the empty state
  - 500 → Retry
- `programs/programs.test.tsx`: the sidebar order now includes Overview.

## Acceptance checklist

- [x] Backend shipped the endpoint; `npm run api:types` re-run; spec reconciled with the real contract; no hand-written API types
- [ ] Browser: every section renders from the real endpoint for each preset and a custom range
- [ ] Browser: 375 px layout (tiles 2-up, table scrolls sideways), keyboard through the filter, Show table and Show all
- [x] Dark-mode palette validated (not reachable in the UI yet)
- [x] States above covered by tests; no 403 exists for this endpoint
- [x] `npm run build`, `npm run lint` (no new warnings), `npm test` pass

## Verified

**Automated: 362/362 tests pass across 28 files** (333 before; 29 new). `npx tsc -b` is clean. `npm run lint` shows the same 6 existing warnings, none in new files. `npm run build` passes: main bundle 247 KB gzipped, Overview chunk 108 KB gzipped (lazy). No Recharts or React warnings in the test output.

**Against the running backend (curl, 2026-10-20):** `GET /reports/overview?from=2025-10-21&to=2026-10-20` answers 401 `AUTH_REQUIRED` without a token and `INVALID_AUTH_TOKEN` with `Bearer abc`. The CORS preflight from `http://localhost:5173` allows `GET` with an `authorization` header. The signed-in report needs a Google sign-in, so it's still the unticked browser items.

## Implementation notes

- **Today is local, `asOf` is UTC.** Presets end on the browser's date, while the server measures overdue and at-risk against UTC today. They differ by at most a day around midnight.
- **On-time rate and deltas are computed in the page** from the server's counts (presentation only). The rules behind the counts (on time, in scope, at risk) are all the server's.
- **The bar segments' tooltips are hover-only.** The legend next to them holds every value for keyboard and screen-reader users, so the segments aren't extra tab stops.
- **shadcn's `ChartLegendContent` isn't used.** It draws square swatches, and a line chart's legend should use line keys. `TrendLegend` renders inside the chart, where the `--color-*` variables are in scope.
- `chart.tsx` injects a `<style>` with `dangerouslySetInnerHTML`. It only contains the constant colours from `TrendChart`'s config, never API or user content.

## Out of scope / follow-ups

- Export (PDF/CSV) and scheduled emails of the report.
- Per-employee performance (sensitive; needs a product decision).
- Making Overview the landing page after sign-in.
- Historical status ("how many were active on 1 March") needs status history in the backend.
- A theme toggle, so the validated dark palette can be used.
