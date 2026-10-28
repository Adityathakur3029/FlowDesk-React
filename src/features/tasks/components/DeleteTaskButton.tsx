import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/api/errors'
import { ConfirmDeleteDialog } from '@/components/feedback/ConfirmDeleteDialog'
import { useDeleteTask } from '../api'
import { parentPath } from '../taskParent'
import type { TaskDetail } from '../types'

interface DeleteTaskButtonProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry.
  taskRef: string
}

// The page only shows this to ADMIN, MANAGER and the task's reporter (contract); a 403 is still handled.
// Afterwards it goes back to the task's program or board.
export function DeleteTaskButton({ task, taskRef }: DeleteTaskButtonProps) {
  const navigate = useNavigate()
  const [errors, setErrors] = useState<string[]>([])
  const deleteTask = useDeleteTask(task, taskRef)

  function confirm() {
    setErrors([])
    deleteTask.mutate(undefined, {
      onSuccess: () => {
        toast.success(`${task.key} deleted`, { description: task.title })
        void navigate(parentPath(task.parent))
      },
      onError: (error) => {
        // Someone else deleted it (or its program) first: the outcome is the same.
        if (isApiError(error) && error.status === 404) {
          toast.info('This task has already been deleted.')
          void navigate(parentPath(task.parent))
          return
        }
        setErrors([getErrorMessage(error)])
      },
    })
  }

  return (
    <ConfirmDeleteDialog
      triggerLabel={`Delete task ${task.key}`}
      title={`Delete ${task.key}?`}
      description={`“${task.title}” and its dependency links will be removed. Tasks it blocks are re-evaluated, and its key isn't reused. This can't be undone.`}
      confirmLabel="Delete task"
      pending={deleteTask.isPending}
      errors={errors}
      onConfirm={confirm}
      onClose={() => setErrors([])}
    />
  )
}
