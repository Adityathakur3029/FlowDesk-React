import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { KeyBadge } from '@/components/data/KeyBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { boardPath } from '@/routes/paths'
import type { BoardReportRow } from '../types'
import { ProgressMeter } from './ProgressMeter'

const INITIAL_ROWS = 10

// Rows in the server's order: the most overdue tasks first, then by name. Boards never close, so every active
// board with a task is listed whatever the period; a deleted board has no row.
export function BoardReportTable({ boards }: { boards: readonly BoardReportRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? boards : boards.slice(0, INITIAL_ROWS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Boards</h2>
        </CardTitle>
        <CardDescription>Every board with tasks. The most overdue come first.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No board has tasks yet.</p>
        ) : (
          <Table>
            <caption className="sr-only">Boards with tasks</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Board</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Done in period</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((board) => (
                <TableRow key={board.id}>
                  <TableCell className="max-w-72">
                    <Link to={boardPath(board.id)} className="flex min-w-0 items-center gap-2 font-medium underline-offset-4 hover:underline">
                      <KeyBadge kind="board">{board.key}</KeyBadge> <span className="truncate">{board.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ProgressMeter done={board.tasksDone} total={board.tasksTotal} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{board.tasksCompletedInPeriod}</TableCell>
                  <TableCell className="text-right tabular-nums">{board.openTasks}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {board.overdueTasks > 0 && <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
                      {board.overdueTasks}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {boards.length > INITIAL_ROWS && (
          <Button type="button" variant="ghost" size="sm" className="self-start" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show fewer' : `Show all ${boards.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
