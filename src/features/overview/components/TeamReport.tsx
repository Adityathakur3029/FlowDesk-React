import { TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TONE_CHART_CLASSES } from '@/lib/tones'
import { plural } from '../format'
import type { TeamReportRow } from '../types'
import { HBar } from './HBar'

// Rows in the server's order: by name, the no-team row last.
export function TeamReport({ teams }: { teams: readonly TeamReportRow[] }) {
  const most = Math.max(0, ...teams.map((team) => team.tasksCompleted))

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>By team</h2>
        </CardTitle>
        <CardDescription>Tasks completed in the period, by the team that owns the program.</CardDescription>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team owns a program that ran in this period.</p>
        ) : (
          <ul aria-label="By team" className="flex flex-col gap-4">
            {teams.map((team) => (
              <li key={team.teamId ?? 'no-team'} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className={team.name ? 'truncate font-medium' : 'text-muted-foreground'}>
                    {team.name ?? 'No owner team'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {plural(team.programs, 'program')} · {team.openTasks} open ·{' '}
                    {team.overdueTasks > 0 && (
                      <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    )}
                    {team.overdueTasks} overdue
                  </span>
                </div>
                <HBar value={team.tasksCompleted} max={most} className={TONE_CHART_CLASSES.green} unit="tasks completed" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
