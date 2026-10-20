import { Link, useSearchParams } from 'react-router'
import { getErrorMessage, isApiError } from '@/api/errors'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useOverview } from '../api'
import { PeriodFilter } from '../components/PeriodFilter'
import { PriorityBars } from '../components/PriorityBars'
import { ProgramReportTable } from '../components/ProgramReportTable'
import { StatTiles } from '../components/StatTiles'
import { StatusBreakdown } from '../components/StatusBreakdown'
import { TeamReport } from '../components/TeamReport'
import { TrendChart } from '../components/TrendChart'
import { formatRange, plural } from '../format'
import { END_BEFORE_START, localToday, parsePeriod, resolvePeriod, toPeriodSearchParams } from '../period'
import { programStatusItems, taskStatusItems } from '../statusBreakdowns'

// A 400 is about the dates (only a custom range can produce one): its message goes under the range inputs.
function rangeErrorMessage(error: unknown): string | null {
  if (!isApiError(error) || error.status !== 400) return null
  if (error.code === 'INVALID_DATE_RANGE') return END_BEFORE_START
  return error.fieldErrors.from ?? error.fieldErrors.to ?? getErrorMessage(error)
}

export function OverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = parsePeriod(searchParams)
  const range = resolvePeriod(period, localToday())
  const report = useOverview(range)
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
        onChange={(next) => setSearchParams(toPeriodSearchParams(next))}
      />
      <OverviewContent query={report} badRange={rangeError !== null} />
    </>
  )
}

function OverviewContent({ query, badRange }: { query: ReturnType<typeof useOverview>; badRange: boolean }) {
  if (query.isPending) return <OverviewSkeleton />

  if (query.isError) {
    if (badRange) return <EmptyState title="No report for these dates" description="Fix the custom range above to see the report." />
    return (
      <ErrorState error={query.error} title="Couldn't load the overview" onRetry={() => query.refetch()} retrying={query.isFetching} />
    )
  }

  const report = query.data
  const { totals } = report
  if (totals.programs === 0 && totals.tasksCreated === 0 && totals.tasksCompleted === 0) {
    return (
      <EmptyState
        title="Nothing to report for this period"
        description="No program ran, and no task was created or completed, in these dates."
        action={
          <Button asChild variant="outline">
            <Link to={paths.programs}>Go to Programs</Link>
          </Button>
        }
      />
    )
  }

  // While the next period loads, the last report stays in place, dimmed: no skeleton flash, no layout jump.
  const busy = query.isPlaceholderData
  return (
    <div aria-busy={busy} className={cn('flex flex-col gap-6 transition-opacity', busy && 'opacity-60')}>
      <StatTiles report={report} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <StatusBreakdown
          title="Programs by status"
          description={`Current status of the ${plural(totals.programs, 'program')} that ran in the period.`}
          items={programStatusItems(report.programsByStatus)}
          emptyText="No program ran in this period."
        />
        <StatusBreakdown
          title="Tasks by status"
          description="Current status of the tasks that were live in the period."
          items={taskStatusItems(report.tasksByStatus)}
          emptyText="No task was live in this period."
        />
      </div>
      <TrendChart trend={report.trend} granularity={report.period.granularity} totals={totals} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <TeamReport teams={report.teams} />
        <PriorityBars counts={report.openTasksByPriority} openTasks={totals.openTasks} />
      </div>
      <ProgramReportTable programs={report.programs} />
    </div>
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
