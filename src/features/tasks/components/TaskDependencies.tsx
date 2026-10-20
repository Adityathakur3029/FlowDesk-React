import { useId, useRef, useState, type ReactNode } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { taskPath } from '@/routes/paths'
import { useRemoveBlocker } from '../api'
import { TASK_STATUS_LABELS } from '../taskDisplay'
import type { TaskDetail, TaskSummary } from '../types'
import { AddBlocker } from './AddBlocker'
import { TaskStatusBadge } from './TaskStatusBadge'

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Dependencies</h2>
        </CardTitle>
        {task.status === 'DEPENDENT' && (
          <CardDescription>This task waits for its blockers. Its status comes back by itself once they're done.</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DependencyList
          title="Blocked by"
          programId={task.programId}
          tasks={task.dependsOn}
          action={
            !adding && (
              <Button ref={addRef} type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <Plus aria-hidden="true" />
                Add blocker
              </Button>
            )
          }
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
        >
          {adding && <AddBlocker task={task} taskRef={taskRef} onClose={closeAdd} />}
        </DependencyList>
        <DependencyList title="Blocks" programId={task.programId} tasks={task.blocks} />
      </CardContent>
    </Card>
  )
}

interface DependencyListProps {
  title: string
  programId: string
  tasks: readonly TaskSummary[]
  // Next to the title, e.g. Add blocker.
  action?: ReactNode
  // A button at the end of each row, e.g. Remove.
  renderRemove?: (task: TaskSummary) => ReactNode
  // Under the title, e.g. the add-blocker search.
  children?: ReactNode
}

function DependencyList({ title, programId, tasks, action, renderRemove, children }: DependencyListProps) {
  const headingId = useId()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-medium text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col divide-y rounded-lg border">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Link
                to={taskPath(programId, task.key)}
                className="mr-auto flex min-w-0 items-baseline gap-2 underline-offset-4 hover:underline"
              >
                <span className="font-mono text-sm text-muted-foreground">{task.key}</span>{' '}
                {/* The space keeps "MKT-3 Finalise sample" apart for screen readers; flex hides it visually. */}
                <span className="font-medium break-words">{task.title}</span>
              </Link>
              <TaskStatusBadge status={task.status} />
              {renderRemove?.(task)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
