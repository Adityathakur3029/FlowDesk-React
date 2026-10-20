import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { ToneDot } from '@/components/data/ToneBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EmployeeMultiPicker } from '@/features/employees'
import { applyServerErrors } from '@/lib/formErrors'
import { useCreateTask } from '../api'
import { CREATABLE_TASK_STATUSES, TASK_PRIORITIES, TASK_STATUS_LABELS, TASK_STATUS_TONES, TASK_TYPES } from '../taskDisplay'
import { hoursToMinutes, parseLabels, taskFieldAliases, taskFields, taskSchema, type TaskFormValues } from '../taskSchema'
import type { CreateTaskRequest } from '../types'
import { TaskPriorityLabel } from './TaskPriorityLabel'
import { TaskTypeLabel } from './TaskTypeLabel'

// The contract's defaults, shown in the selects so what the user sees is what's stored.
const DEFAULT_VALUES: TaskFormValues = {
  title: '',
  type: 'TASK',
  status: 'DISCUSSION',
  priority: 'MEDIUM',
  assignee: [],
  startDate: '',
  dueDate: '',
  estimateHours: '',
  labels: '',
  description: '',
}

interface CreateTaskDialogProps {
  programId: string
  programName: string
  // Called after the task is created, e.g. to show the first page, where the newest task is.
  onCreated?: () => void
}

// Any active employee can create a task (contract), so this isn't role-gated.
export function CreateTaskDialog({ programId, programName, onCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const { employee } = useAuth()
  const createTask = useCreateTask(programId)
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: DEFAULT_VALUES })
  const [assignee, labelsText] = useWatch({ control: form.control, name: ['assignee', 'labels'] })
  const labels = parseLabels(labelsText)
  const pending = createTask.isPending

  // Fields are disabled while the request is pending, and onError runs before they're enabled again,
  // so focusing the first field with a server error waits for the render that shows the new error.
  const submitError = createTask.error
  useEffect(() => {
    if (!submitError) return
    const invalid = taskFields.find((name) => form.getFieldState(name).invalid)
    if (invalid) form.setFocus(invalid)
  }, [submitError, form])

  function close() {
    setOpen(false)
    setFormErrors([])
    createTask.reset()
  }

  function handleOpenChange(next: boolean) {
    // A closed dialog must never hide a request still in flight.
    if (pending) return
    if (next) {
      form.reset(DEFAULT_VALUES)
      setOpen(true)
    } else {
      close()
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    // Unset optional fields are left out; on create, omitted and null both mean "not set". labels and
    // dependsOn are always sent: the generated type requires every field with a contract default, and []
    // is that default. Blockers come with the dependencies spec.
    const body: CreateTaskRequest = {
      title: values.title,
      type: values.type,
      status: values.status,
      priority: values.priority,
      labels: parseLabels(values.labels),
      dependsOn: [],
      ...(values.assignee[0] && { assigneeId: values.assignee[0].id }),
      ...(values.startDate && { startDate: values.startDate }),
      ...(values.dueDate && { dueDate: values.dueDate }),
      ...(values.estimateHours && { estimateMinutes: hoursToMinutes(values.estimateHours) }),
      ...(values.description.trim() && { description: values.description }),
    }
    createTask.mutate(body, {
      onSuccess: (task) => {
        toast.success(`Task ${task.key} created`, { description: task.title })
        close()
        onCreated?.()
      },
      onError: (error) => {
        // Coded errors carry no field details, so applyServerErrors would put them in the form alert.
        if (hasErrorCode(error, 'ASSIGNEE_NOT_FOUND')) {
          // Deactivated meanwhile: they can't be assigned, so take them off.
          form.setValue('assignee', [])
          form.setError('assignee', { type: 'server', message: getErrorMessage(error) })
          return
        }
        if (hasErrorCode(error, 'INVALID_DATE_RANGE')) {
          form.setError('dueDate', { type: 'server', message: getErrorMessage(error) })
          return
        }
        setFormErrors(applyServerErrors(error, taskFields, form.setError, taskFieldAliases))
      },
    })
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden="true" />
          Create task
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-xl"
        // Escape inside an open suggestion list closes the list, not the dialog.
        onEscapeKeyDown={(event) => {
          if (event.target instanceof Element && event.target.closest('[data-picker-open="true"]')) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create a task</DialogTitle>
          <DialogDescription>Adds a task to {programName}. You'll be its reporter.</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-task-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormErrorAlert errors={formErrors} />

            <FieldGroup>
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="task-title">Title</FieldLabel>
                    <Input
                      {...field}
                      id="task-title"
                      autoComplete="off"
                      placeholder="Draft survey questions"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="task-title-error"
                      disabled={pending}
                    />
                    <FieldError id="task-title-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Controller
                  name="type"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="task-type">Type</FieldLabel>
                      <Select name={field.name} value={field.value} onValueChange={field.onChange} disabled={pending}>
                        <SelectTrigger id="task-type" ref={field.ref} onBlur={field.onBlur} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              <TaskTypeLabel type={type} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="task-status">Status</FieldLabel>
                      <Select name={field.name} value={field.value} onValueChange={field.onChange} disabled={pending}>
                        <SelectTrigger id="task-status" ref={field.ref} onBlur={field.onBlur} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CREATABLE_TASK_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              <ToneDot tone={TASK_STATUS_TONES[status]} />
                              {TASK_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Controller
                  name="priority"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
                      <Select name={field.name} value={field.value} onValueChange={field.onChange} disabled={pending}>
                        <SelectTrigger id="task-priority" ref={field.ref} onBlur={field.onBlur} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              <TaskPriorityLabel priority={priority} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="assignee"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center justify-between gap-2">
                      {/* The picker's input gets its accessible name from `label`; this is the visible one. */}
                      <FieldTitle>Assignee (optional)</FieldTitle>
                      {employee && assignee.length === 0 && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => field.onChange([employee])}
                          disabled={pending}
                        >
                          Assign to me
                        </Button>
                      )}
                    </div>
                    <EmployeeMultiPicker
                      label="Assignee"
                      value={field.value}
                      onChange={field.onChange}
                      max={1}
                      disabled={pending}
                      invalid={fieldState.invalid}
                      placeholder="Search by name or email"
                      aria-describedby="task-assignee-error"
                    />
                    <FieldError id="task-assignee-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="startDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="task-start-date">Start date (optional)</FieldLabel>
                      <Input
                        {...field}
                        id="task-start-date"
                        type="date"
                        aria-invalid={fieldState.invalid}
                        aria-describedby="task-start-date-error"
                        disabled={pending}
                      />
                      <FieldError id="task-start-date-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="dueDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="task-due-date">Due date (optional)</FieldLabel>
                      <Input
                        {...field}
                        id="task-due-date"
                        type="date"
                        aria-invalid={fieldState.invalid}
                        aria-describedby="task-due-date-error"
                        disabled={pending}
                      />
                      <FieldError id="task-due-date-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="estimateHours"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="task-estimate">Estimate in hours (optional)</FieldLabel>
                    <Input
                      {...field}
                      id="task-estimate"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="1.5"
                      className="w-32"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="task-estimate-hint task-estimate-error"
                      disabled={pending}
                    />
                    <FieldDescription id="task-estimate-hint">For example 1.5 for 1 h 30 min.</FieldDescription>
                    <FieldError id="task-estimate-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="labels"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="task-labels">Labels (optional)</FieldLabel>
                    <Input
                      {...field}
                      id="task-labels"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="survey, q4"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="task-labels-hint task-labels-error"
                      disabled={pending}
                    />
                    <FieldDescription id="task-labels-hint">Separate with commas. Saved in lowercase.</FieldDescription>
                    {labels.length > 0 && (
                      <ul aria-label="Labels to add" className="flex flex-wrap gap-1">
                        {labels.map((label) => (
                          <li key={label}>
                            <Badge variant="outline" className="font-normal">
                              {label}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                    <FieldError id="task-labels-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="task-description">Description (optional)</FieldLabel>
                    <Textarea
                      {...field}
                      id="task-description"
                      rows={4}
                      placeholder="Details, links, acceptance criteria"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="task-description-error"
                      disabled={pending}
                    />
                    <FieldError id="task-description-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="create-task-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {pending ? 'Creating task…' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
