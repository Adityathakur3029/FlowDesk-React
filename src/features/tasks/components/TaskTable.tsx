import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCalendarDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { TASK_TYPE_LABELS } from '../taskDisplay'
import type { Task } from '../types'
import { TaskPriorityLabel } from './TaskPriorityLabel'
import { TaskStatusBadge } from './TaskStatusBadge'

const SKELETON_ROWS = 5
const COLUMNS = 7
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
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due</TableHead>
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
                  <TableCell className="font-mono text-sm whitespace-nowrap">{task.key}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex max-w-md flex-col gap-1">
                      <span className="font-medium">{task.title}</span>
                      <TaskLabels labels={task.labels} />
                    </div>
                  </TableCell>
                  <TableCell>{TASK_TYPE_LABELS[task.type]}</TableCell>
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
                  <TableCell className="whitespace-nowrap">
                    {task.dueDate ? formatCalendarDate(task.dueDate) : <span className="text-muted-foreground">None</span>}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
