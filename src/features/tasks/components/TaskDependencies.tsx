import { useId, useRef, useState, type ReactNode } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { taskPath } from '@/routes/paths'
import { useRemoveBlocker } from '../api'
import { TASK_STATUS_LABELS } from '../taskDisplay'
import type { TaskDetail, TaskSummary } from '../types'
import { AddBlocker } from './AddBlocker'
import { TaskStatusBadge } from './TaskStatusBadge'

// Rows per side before "Show N more".
const VISIBLE_ROWS = 5

interface TaskDependenciesProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry.
  taskRef: string
}

// Both sides of the task's dependency links, ordered by number (contract). "Blocked by" is edited here
// (add, remove); "Blocks" is the other tasks' blockers, so it's edited on their pages.
export function TaskDependencies({ task, taskRef }: TaskDependenciesProps) {
  const [adding, setAdding] = useState(false)
  const addRef = useRef<HTMLButtonElement>(null)
  const removeBlocker = useRemoveBlocker(task.programId, taskRef)

  function closeAdd() {
    setAdding(false)
    requestAnimationFrame(() => addRef.current?.focus())
  }

  function remove(blocker: TaskSummary) {
    removeBlocker.mutate(blocker, {
      onSuccess: (saved) => {
        const restored = task.status === 'DEPENDENT' && saved.status !== 'DEPENDENT'
        toast.success(`Removed blocker ${blocker.key}`, {
          description: restored ? `Status is back to ${TASK_STATUS_LABELS[saved.status]}.` : undefined,
        })
      },
      // A 404: the link or the task is gone; the task refetches either way (useRemoveBlocker).
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  const hasLinks = task.dependsOn.length > 0 || task.blocks.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Dependencies</h2>
        </CardTitle>
        {task.status === 'DEPENDENT' && (
          <CardDescription>This task waits for its blockers. Its status comes back by itself once they're done.</CardDescription>
        )}
        {!adding && (
          <CardAction>
            <Button ref={addRef} type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" />
              Add blocker
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {adding && <AddBlocker task={task} taskRef={taskRef} onClose={closeAdd} />}
        {/* An empty side isn't shown: Blocks is read-only here, and Add blocker sits in the header. */}
        {hasLinks ? (
          <div className="flex flex-col divide-y rounded-lg border">
            {task.dependsOn.length > 0 && (
              <DependencyGroup
                title="Blocked by"
                programId={task.programId}
                tasks={task.dependsOn}
                renderRemove={(blocker) => {
                  const removing = removeBlocker.isPending && removeBlocker.variables.id === blocker.id
                  return (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove blocker ${blocker.key}`}
                      onClick={() => remove(blocker)}
                      disabled={removeBlocker.isPending}
                      className="text-muted-foreground"
                    >
                      {removing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                    </Button>
                  )
                }}
              />
            )}
            {task.blocks.length > 0 && <DependencyGroup title="Blocks" programId={task.programId} tasks={task.blocks} />}
          </div>
        ) : (
          !adding && <p className="text-sm text-muted-foreground">No dependencies.</p>
        )}
      </CardContent>
    </Card>
  )
}

interface DependencyGroupProps {
  title: string
  programId: string
  tasks: readonly TaskSummary[]
  // A button at the end of each row, e.g. Remove.
  renderRemove?: (task: TaskSummary) => ReactNode
}

// One side of the links: a small label over single-line rows, the first VISIBLE_ROWS of them until expanded.
function DependencyGroup({ title, programId, tasks, renderRemove }: DependencyGroupProps) {
  const headingId = useId()
  const [expanded, setExpanded] = useState(false)
  const hiddenCount = tasks.length - VISIBLE_ROWS
  const shown = expanded || hiddenCount <= 0 ? tasks : tasks.slice(0, VISIBLE_ROWS)

  return (
    <div className="flex flex-col py-1.5">
      <h3 id={headingId} className="px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <ul aria-labelledby={headingId} className="flex flex-col">
        {shown.map((task) => (
          <li key={task.id} className="flex min-h-8 items-center gap-2 px-3 py-1">
            <Link
              to={taskPath(programId, task.key)}
              title={task.title}
              className="flex min-w-0 flex-1 items-baseline gap-2 underline-offset-4 hover:underline"
            >
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{task.key}</span>{' '}
              {/* The space keeps "MKT-3 Finalise sample" apart for screen readers; flex hides it visually. */}
              <span className="truncate text-sm font-medium">{task.title}</span>
            </Link>
            <TaskStatusBadge status={task.status} />
            {renderRemove?.(task)}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mx-1.5 self-start text-muted-foreground"
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </Button>
      )}
    </div>
  )
}
