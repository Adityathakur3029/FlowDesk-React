import { Link, useSearchParams } from 'react-router'
import { getErrorMessage, isApiError } from '@/api/errors'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { localToday } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useOverview } from '../api'
import { BoardReportTable } from '../components/BoardReportTable'
import { PeriodFilter } from '../components/PeriodFilter'
import { PriorityBars } from '../components/PriorityBars'
import { ProgramReportTable } from '../components/ProgramReportTable'
import { StatTiles } from '../components/StatTiles'
import { StatusBreakdown } from '../components/StatusBreakdown'
import { TeamReport } from '../components/TeamReport'
import { TrendChart } from '../components/TrendChart'
import { formatRange, plural } from '../format'
import { END_BEFORE_START, parsePeriod, resolvePeriod, toPeriodSearchParams } from '../period'
import { DEFAULT_SCOPE, parseScope, SCOPE_TASKS_WHERE, withScope } from '../scope'
import { programStatusItems, taskStatusItems } from '../statusBreakdowns'
import type { ReportScope } from '../types'

// A 400 is about the dates (only a custom range can produce one): its message goes under the range inputs.
function rangeErrorMessage(error: unknown): string | null {
  if (!isApiError(error) || error.status !== 400) return null
  if (error.code === 'INVALID_DATE_RANGE') return END_BEFORE_START
  return error.fieldErrors.from ?? error.fieldErrors.to ?? getErrorMessage(error)
}

// Where the open tasks behind "Open tasks by priority" are, per scope (snapshot counts, see the contract).
const OPEN_TASKS_WHERE: Record<ReportScope, string> = {
  all: 'in the programs that ran in the period and on boards',
  programs: 'in the programs that ran in the period',
  boards: 'on boards',
}

export function OverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = parsePeriod(searchParams)
  const scope = parseScope(searchParams)
  const range = resolvePeriod(period, localToday())
  // All is the server's default, so it isn't sent.
  const report = useOverview(scope === DEFAULT_SCOPE ? range : { ...range, scope })
  const rangeError = report.isError ? rangeErrorMessage(report.error) : null

  return (
    <>
      <PageHeader title="Overview" description={`How the organisation is doing, ${formatRange(range.from, range.to)}.`} />
      <PeriodFilter
        // A new period in the URL (a preset, Apply, Back) resets the filter's draft state.
        key={toPeriodSearchParams(period).toString()}
        period={period}
        range={range}
        error={rangeError}
        onChange={(next) => setSearchParams(withScope(toPeriodSearchParams(next), scope))}
        scope={scope}
        onScopeChange={(next) => setSearchParams(withScope(toPeriodSearchParams(period), next))}
      />
      <OverviewContent query={report} scope={scope} badRange={rangeError !== null} />
    </>
  )
}

interface OverviewContentProps {
  query: ReturnType<typeof useOverview>
  scope: ReportScope
  badRange: boolean
}

function OverviewContent({ query, scope, badRange }: OverviewContentProps) {
  if (query.isPending) return <OverviewSkeleton />

  if (query.isError) {
    if (badRange) return <EmptyState title="No report for these dates" description="Fix the custom range above to see the report." />
    return (
      <ErrorState error={query.error} title="Couldn't load the overview" onRetry={() => query.refetch()} retrying={query.isFetching} />
    )
  }

  const report = query.data
  const { totals } = report
  // Program-only sections are 0 / empty under Show: Boards (contract), so they're left out; the Board report is
  // empty under Show: Programs.
  const showPrograms = scope !== 'boards'
  const showBoards = scope !== 'programs'

  // Boards never close, so a board with tasks is in every period, as a running program is.
  if (totals.programs === 0 && report.boards.length === 0 && totals.tasksCreated === 0 && totals.tasksCompleted === 0) {
    return <NothingToReport scope={scope} />
  }

  const taskStatus = (
    <StatusBreakdown
      title="Tasks by status"
      description="Current status of the tasks that were live in the period."
      items={taskStatusItems(report.tasksByStatus)}
      emptyText="No task was live in this period."
    />
  )
  const priorities = <PriorityBars counts={report.openTasksByPriority} openTasks={totals.openTasks} where={OPEN_TASKS_WHERE[scope]} />
  const trend = <TrendChart trend={report.trend} granularity={report.period.granularity} totals={totals} where={SCOPE_TASKS_WHERE[scope]} />

  // While the next period loads, the last report stays in place, dimmed: no skeleton flash, no layout jump.
  const busy = query.isPlaceholderData
  return (
    <div aria-busy={busy} className={cn('flex flex-col gap-6 transition-opacity', busy && 'opacity-60')}>
      <StatTiles report={report} showPrograms={showPrograms} />
      {showPrograms ? (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <StatusBreakdown
              title="Programs by status"
              description={`Current status of the ${plural(totals.programs, 'program')} that ran in the period.`}
              items={programStatusItems(report.programsByStatus)}
              emptyText="No program ran in this period."
            />
            {taskStatus}
          </div>
          {trend}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <TeamReport teams={report.teams} programTasksOnly={showBoards} />
            {priorities}
          </div>
          <ProgramReportTable programs={report.programs} />
        </>
      ) : (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {taskStatus}
            {priorities}
          </div>
          {trend}
        </>
      )}
      {showBoards && <BoardReportTable boards={report.boards} />}
    </div>
  )
}

function NothingToReport({ scope }: { scope: ReportScope }) {
  if (scope === 'boards') {
    return (
      <EmptyState
        title="Nothing to report for this period"
        description="No board has tasks, and no board task was created or completed, in these dates."
        action={
          <Button asChild variant="outline">
            <Link to={paths.boards}>Go to Boards</Link>
          </Button>
        }
      />
    )
  }
  return (
    <EmptyState
      title="Nothing to report for this period"
      description={
        scope === 'programs'
          ? 'No program ran, and no task was created or completed, in these dates.'
          : 'No program ran, no board has tasks, and no task was created or completed, in these dates.'
      }
      action={
        <Button asChild variant="outline">
          <Link to={paths.programs}>Go to Programs</Link>
        </Button>
      }
    />
  )
}

function OverviewSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading the overview…</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}
