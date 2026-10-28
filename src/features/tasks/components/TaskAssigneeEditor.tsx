import { useEffect, useId, useState, type FormEvent } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode, isApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { EmployeeMultiPicker } from '@/features/employees'
import { useUpdateTask } from '../api'
import { toastTaskUpdateError } from '../taskErrors'
import type { EmployeeSummary, TaskDetail } from '../types'

interface TaskAssigneeEditorProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry.
  taskRef: string
  // After a save, a cancel, or a save that changed nothing.
  onClose: () => void
}

// Picks one person (GET /employees?q=, active only), or none to unassign, then Save. Every role may edit.
export function TaskAssigneeEditor({ task, taskRef, onClose }: TaskAssigneeEditorProps) {
  const id = useId()
  const { employee } = useAuth()
  // null when unassigned, although the generated type says otherwise (spec 08, contract note 1).
  const [value, setValue] = useState<EmployeeSummary[]>(task.assignee ? [task.assignee] : [])
  const [fieldError, setFieldError] = useState<string>()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const update = useUpdateTask(taskRef)
  const pending = update.isPending

  // After a failed save, focus goes back into the picker (the Save button was disabled meanwhile).
  const submitError = update.error
  useEffect(() => {
    if (submitError) document.getElementById(id)?.querySelector<HTMLElement>('input, li button')?.focus()
  }, [submitError, id])

  function save(event?: FormEvent) {
    event?.preventDefault()
    const assigneeId = value[0]?.id ?? null
    if (assigneeId === (task.assignee?.id ?? null)) {
      onClose()
      return
    }
    setFieldError(undefined)
    setFormErrors([])
    update.mutate(
      { assigneeId },
      {
        onSuccess: (saved) => {
          toast.success(saved.assignee ? `Assigned to ${saved.assignee.name}` : 'Unassigned')
          onClose()
        },
        onError: (error) => {
          // Deactivated meanwhile: they can't be assigned, so take them off.
          if (hasErrorCode(error, 'ASSIGNEE_NOT_FOUND')) {
            setValue([])
            setFieldError(getErrorMessage(error))
            return
          }
          if (isApiError(error) && error.status === 404) {
            toastTaskUpdateError(error)
            return
          }
          const detail = isApiError(error) ? error.fieldErrors.assigneeId : undefined
          if (detail) setFieldError(detail)
          else setFormErrors([getErrorMessage(error)])
        },
      },
    )
  }

  return (
    <form
      noValidate
      onSubmit={save}
      onKeyDown={(event) => {
        // Escape inside an open suggestion list closes the list, not the editor.
        if (event.target instanceof Element && event.target.closest('[data-picker-open="true"]')) return
        if (event.key === 'Escape' && !pending) {
          event.preventDefault()
          onClose()
        }
      }}
      aria-label="Edit assignee"
      className="flex flex-col gap-2"
    >
      <FormErrorAlert errors={formErrors} />
      <Field data-invalid={fieldError !== undefined}>
        {/* The row's "Assignee" term is the visible label; the picker's input gets its name from `label`. */}
        {employee && value.length === 0 && (
          <Button
            type="button"
            variant="link"
            className="h-auto self-end p-0"
            onClick={() => setValue([{ id: employee.id, name: employee.name, emailId: employee.emailId }])}
            disabled={pending}
          >
            Assign to me
          </Button>
        )}
        <div id={id}>
          <EmployeeMultiPicker<EmployeeSummary>
            label="Assignee"
            value={value}
            onChange={setValue}
            max={1}
            disabled={pending}
            invalid={fieldError !== undefined}
            placeholder="Search by name or email"
            aria-describedby={`${id}-error`}
          />
        </div>
        <FieldError id={`${id}-error`} errors={fieldError ? [{ message: fieldError }] : []} />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {value.length === 0 && <p className="mr-auto text-xs text-muted-foreground">Save with no one to unassign.</p>}
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
