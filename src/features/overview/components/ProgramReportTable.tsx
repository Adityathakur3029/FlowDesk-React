import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { KeyBadge } from '@/components/data/KeyBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProgramStatusBadge } from '@/features/programs'
import { formatCalendarDate } from '@/lib/dates'
import { TONE_BADGE_CLASSES } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { programPath } from '@/routes/paths'
import type { ProgramReportRow } from '../types'
import { ProgressMeter } from './ProgressMeter'

const INITIAL_ROWS = 10

// Rows in the server's order: at risk first, then the most overdue tasks, then by name.
export function ProgramReportTable({ programs }: { programs: readonly ProgramReportRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? programs : programs.slice(0, INITIAL_ROWS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Programs</h2>
        </CardTitle>
        <CardDescription>Every program that ran in the period. At-risk programs come first, then the most overdue.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No program ran in this period.</p>
        ) : (
          <Table>
            <caption className="sr-only">Programs that ran in the period</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Owner team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Done in period</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead>Ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((program) => (
                <TableRow key={program.id}>
                  <TableCell className="max-w-72">
                    <Link
                      to={programPath(program.id)}
                      className="flex min-w-0 items-center gap-2 font-medium underline-offset-4 hover:underline"
                    >
                      <KeyBadge kind="program">{program.key}</KeyBadge>{' '}
                      <span className="truncate">{program.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell>{program.ownerTeam?.name ?? <span className="text-muted-foreground">No owner team</span>}</TableCell>
                  <TableCell>
                    <ProgramStatusBadge status={program.status} />
                  </TableCell>
                  <TableCell>
                    <ProgressMeter done={program.tasksDone} total={program.tasksTotal} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{program.tasksCompletedInPeriod}</TableCell>
                  <TableCell className="text-right tabular-nums">{program.openTasks}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {program.overdueTasks > 0 && (
                        <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      )}
                      {program.overdueTasks}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {program.endDate ? formatCalendarDate(program.endDate) : <span className="text-muted-foreground">Not set</span>}
                      {program.atRisk && (
                        // The server's flag: end date passed, not completed or cancelled.
                        <Badge variant="outline" className={cn('border-transparent', TONE_BADGE_CLASSES.red)}>
                          <TriangleAlert aria-hidden="true" />
                          At risk
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {programs.length > INITIAL_ROWS && (
          <Button type="button" variant="ghost" size="sm" className="self-start" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show fewer' : `Show all ${programs.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
