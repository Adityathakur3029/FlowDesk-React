import { useState } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/api/errors'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Button } from '@/components/ui/button'
import { CommandItem, CommandList } from '@/components/ui/command'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useAddBlocker, useTaskSearch } from '../api'
import { toastTaskUpdateError } from '../taskErrors'
import type { TaskDetail, TaskSummary } from '../types'
import { TaskStatusBadge } from './TaskStatusBadge'

const SEARCH_DEBOUNCE_MS = 250
const MAX_QUERY_LENGTH = 100 // GET …/tasks `q` is 1-100 characters
const MAX_SUGGESTIONS = 8

interface AddBlockerProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry.
  taskRef: string
  onClose: () => void
}

// Jira's "is blocked by" link: search the program's tasks by title or key, and picking one links it right
// away. Any active employee may (contract).
export function AddBlocker({ task, taskRef, onClose }: AddBlockerProps) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const q = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS)
  const search = useTaskSearch(task.programId, q)
  const addBlocker = useAddBlocker(task.programId, taskRef)
  const pending = addBlocker.isPending

  // The task itself and its current blockers would only fail (SELF_DEPENDENCY, DEPENDENCY_EXISTS). Cycles,
  // DONE tasks and the limit are the server's call.
  const linked = new Set([task.id, ...task.dependsOn.map((blocker) => blocker.id)])
  const suggestions = (search.data?.data ?? []).filter((candidate) => !linked.has(candidate.id)).slice(0, MAX_SUGGESTIONS)

  function pick(blocker: TaskSummary) {
    setErrors([])
    addBlocker.mutate(blocker, {
      onSuccess: (saved) => {
        toast.success(`${task.key} is blocked by ${blocker.key}`, {
          description: saved.status === 'DEPENDENT' && task.status !== 'DEPENDENT' ? "It's Dependent until its blockers are done." : undefined,
        })
        onClose()
      },
      onError: (error) => {
        // This task was deleted meanwhile: the page refetches it and shows "Task not found".
        if (isApiError(error) && error.status === 404) {
          toastTaskUpdateError(error)
          return
        }
        // SELF_DEPENDENCY, DEPENDENCY_CYCLE, DEPENDENCY_EXISTS, TASK_DONE… The server's messages name the tasks.
        setErrors([getErrorMessage(error)])
      },
    })
  }

  let status: string | null = null
  if (pending) status = `Adding ${addBlocker.variables.key}…`
  else if (search.isError) status = "Couldn't search tasks. Try again."
  else if (search.isPending) status = 'Searching…'
  else if (suggestions.length === 0) status = q ? `No tasks match “${q}”.` : 'No other tasks in this program yet.'

  return (
    <div className="flex flex-col gap-2">
      <FormErrorAlert errors={errors} />
      <CommandPrimitive
        shouldFilter={false}
        // cmdk names its input with this (aria-labelledby), so it's the search box's accessible name.
        label="Search tasks to add as a blocker"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !pending) {
            event.preventDefault()
            onClose()
          }
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input px-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <CommandPrimitive.Input
              value={text}
              onValueChange={setText}
              autoFocus
              maxLength={MAX_QUERY_LENGTH}
              disabled={pending}
              placeholder="Search tasks by title or key"
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
        <div className="rounded-lg border bg-popover p-1 text-popover-foreground">
          {status ? (
            <p role="status" className="px-2 py-1.5 text-sm text-muted-foreground">
              {status}
            </p>
          ) : (
            <CommandList label="Tasks" className="max-h-64">
              {suggestions.map((candidate) => (
                <CommandItem key={candidate.id} value={candidate.id} onSelect={() => pick(candidate)}>
                  <span className="font-mono text-xs text-muted-foreground">{candidate.key}</span>{' '}
                  <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
                  <TaskStatusBadge status={candidate.status} />
                </CommandItem>
              ))}
            </CommandList>
          )}
        </div>
      </CommandPrimitive>
    </div>
  )
}
