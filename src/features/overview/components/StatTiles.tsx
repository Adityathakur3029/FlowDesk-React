import type { ReactNode } from 'react'
import { Minus, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { plural } from '../format'
import type { OverviewReport } from '../types'

// The headline numbers. Values use proportional figures (no tabular-nums) at this size.
export function StatTiles({ report }: { report: OverviewReport }) {
  const { totals, programsByStatus } = report
  const onTimeRate =
    totals.tasksCompletedWithDueDate > 0
      ? Math.round((totals.tasksCompletedOnTime / totals.tasksCompletedWithDueDate) * 100)
      : null

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Programs running" value={totals.programs}>
        {programsByStatus.ACTIVE} active now
      </StatTile>
      <StatTile label="Programs completed" value={totals.programsCompleted}>
        In this period
      </StatTile>
      <StatTile label="Tasks created" value={totals.tasksCreated}>
        <Delta current={totals.tasksCreated} previous={totals.tasksCreatedPrevious} />
      </StatTile>
      <StatTile label="Tasks completed" value={totals.tasksCompleted}>
        <Delta current={totals.tasksCompleted} previous={totals.tasksCompletedPrevious} upIsGood />
      </StatTile>
      <StatTile label="On-time delivery" value={onTimeRate === null ? '—' : `${onTimeRate}%`}>
        {onTimeRate === null
          ? 'No completed task had a due date'
          : `${totals.tasksCompletedOnTime} of ${totals.tasksCompletedWithDueDate} with a due date`}
      </StatTile>
      <StatTile
        label="Overdue now"
        value={totals.overdueTasks}
        // Never colour alone: the icon and the "at risk" line say it too.
        icon={totals.overdueTasks > 0 && <TriangleAlert className="size-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
      >
        {`${plural(totals.programsAtRisk, 'program')} at risk · ${totals.openTasks} open`}
      </StatTile>
    </dl>
  )
}

interface StatTileProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  children: ReactNode
}

function StatTile({ label, value, icon, children }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        {value}
        {icon}
      </dd>
      <dd className="text-xs text-muted-foreground">{children}</dd>
    </div>
  )
}

// Change vs the previous period of the same length. Coloured only when the direction is good or bad.
function Delta({ current, previous, upIsGood = false }: { current: number; previous: number; upIsGood?: boolean }) {
  if (previous === 0) return <>None in the previous period</>
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1">
        <Minus className="size-3.5" aria-hidden="true" />
        Same as the previous period
      </span>
    )
  }
  const up = change > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        upIsGood && (up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'),
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {`${up ? 'Up' : 'Down'} ${Math.abs(change)}% vs the previous period`}
    </span>
  )
}
