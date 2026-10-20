import { Link } from 'react-router'
import { KeyBadge } from '@/components/data/KeyBadge'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { taskPath } from '@/routes/paths'
import type { Task } from '../types'
import { TaskPriorityLabel } from './TaskPriorityLabel'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskTypeLabel } from './TaskTypeLabel'

const SKELETON_ROWS = 5
const COLUMNS = 6
const MAX_LABELS_SHOWN = 3

interface TaskTableProps {
  tasks?: readonly Task[]
  // A newer page or filter is loading while these rows stay on screen.
  busy?: boolean
}

function TaskLabels({ labels }: { labels: readonly string[] }) {
  if (labels.length === 0) return null
  const hidden = labels.length - MAX_LABELS_SHOWN
  return (
    <ul aria-label="Labels" className="flex flex-wrap gap-1">
      {labels.slice(0, MAX_LABELS_SHOWN).map((label) => (
        <li key={label}>
          <Badge variant="outline" className="font-normal">
            {label}
          </Badge>
        </li>
      ))}
      {hidden > 0 && (
        <li className="text-xs text-muted-foreground" title={labels.slice(MAX_LABELS_SHOWN).join(', ')}>
          +{hidden}
        </li>
      )}
    </ul>
  )
}

export function TaskTable({ tasks, busy = false }: TaskTableProps) {
  return (
    // The table scrolls sideways inside its container on narrow screens, never the page.
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label="Tasks" aria-busy={busy || tasks === undefined} className={cn(busy && 'opacity-60 transition-opacity')}>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            {/* The title takes all the spare width, so the columns after it sit at the right edge. */}
            <TableHead className="w-full">Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks === undefined
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMNS }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <KeyBadge kind="task">{task.key}</KeyBadge>
                  </TableCell>
                  <TableCell className="min-w-64 whitespace-normal">
                    <div className="flex flex-col gap-1">
                      <Link to={taskPath(task.programId, task.key)} className="font-medium underline-offset-4 hover:underline">
                        {task.title}
                      </Link>
                      <TaskLabels labels={task.labels} />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <TaskTypeLabel type={task.type} />
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <TaskPriorityLabel priority={task.priority} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {/* null when unassigned, although the generated type says otherwise (spec 08, contract note 1). */}
                    {task.assignee ? task.assignee.name : <span className="text-muted-foreground">Unassigned</span>}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
