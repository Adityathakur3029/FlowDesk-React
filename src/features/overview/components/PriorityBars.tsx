import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TASK_PRIORITIES, TASK_PRIORITY_ICONS, TASK_PRIORITY_LABELS, TASK_PRIORITY_TONES } from '@/features/tasks'
import { TONE_CHART_CLASSES, TONE_TEXT_CLASSES } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { plural } from '../format'
import type { OverviewReport } from '../types'
import { HBar } from './HBar'

// Highest first: the top rows are the ones leadership asks about.
const PRIORITIES = [...TASK_PRIORITIES].reverse()

interface PriorityBarsProps {
  counts: OverviewReport['openTasksByPriority']
  openTasks: number
  // Where the open tasks are, e.g. "in the programs that ran in the period".
  where: string
}

export function PriorityBars({ counts, openTasks, where }: PriorityBarsProps) {
  const most = Math.max(0, ...PRIORITIES.map((priority) => counts[priority]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Open tasks by priority</h2>
        </CardTitle>
        <CardDescription>
          {plural(openTasks, 'open task')} right now, {where}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul aria-label="Open tasks by priority" className="flex flex-col gap-3">
          {PRIORITIES.map((priority) => {
            const Icon = TASK_PRIORITY_ICONS[priority]
            return (
              <li key={priority} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Icon className={cn('size-4 shrink-0', TONE_TEXT_CLASSES[TASK_PRIORITY_TONES[priority]])} aria-hidden="true" />
                  {TASK_PRIORITY_LABELS[priority]}
                </span>
                <HBar value={counts[priority]} max={most} className={TONE_CHART_CLASSES.blue} unit="open tasks" />
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
