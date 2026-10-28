import { useEffect, useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { hasErrorCode, isApiError } from '@/api/errors'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors } from '@/lib/formErrors'
import { cn } from '@/lib/utils'
import { useUpdateTask } from '../api'
import { minutesToHours } from '../taskDisplay'
import { toastTaskUpdateError } from '../taskErrors'
import { hoursToMinutes, parseLabels, taskSchema } from '../taskSchema'
import type { TaskDetail, UpdateTaskRequest } from '../types'

export type EditableTaskField = 'title' | 'description' | 'startDate' | 'dueDate' | 'estimate' | 'labels'

interface FieldConfig {
  // The input's label, also used in "Edit …" and the toast.
  label: string
  kind: 'text' | 'textarea' | 'date' | 'hours' | 'labels'
  // Mirrors UpdateTaskRequest for instant feedback only; the server's details win.
  schema: z.ZodString
  // The request field this edits: the PATCH body's only key, and the path of its 400 details.
  requestField: keyof UpdateTaskRequest
  // The task's value as the input's text.
  read: (task: TaskDetail) => string
  // The stored value, to skip saving when nothing changed.
  stored: (task: TaskDetail) => unknown
  // The input's text as the PATCH body: only this field.
  toBody: (text: string) => UpdateTaskRequest
  // "Clear date" / "Clear estimate" while a value is stored.
  clearLabel?: string
}

const FIELDS: Record<EditableTaskField, FieldConfig> = {
  title: {
    label: 'Title',
    kind: 'text',
    schema: taskSchema.shape.title,
    requestField: 'title',
    read: (task) => task.title,
    stored: (task) => task.title,
    toBody: (text) => ({ title: text }),
  },
  // A blank description clears it (null).
  description: {
    label: 'Description',
    kind: 'textarea',
    schema: taskSchema.shape.description,
    requestField: 'description',
    read: (task) => task.description ?? '',
    stored: (task) => task.description,
    toBody: (text) => ({ description: text.trim() ? text : null }),
  },
  startDate: {
    label: 'Start date',
    kind: 'date',
    schema: taskSchema.shape.startDate,
    requestField: 'startDate',
    read: (task) => task.startDate ?? '',
    stored: (task) => task.startDate,
    toBody: (text) => ({ startDate: text || null }),
    clearLabel: 'Clear date',
  },
  dueDate: {
    label: 'Due date',
    kind: 'date',
    schema: taskSchema.shape.dueDate,
    requestField: 'dueDate',
    read: (task) => task.dueDate ?? '',
    stored: (task) => task.dueDate,
    toBody: (text) => ({ dueDate: text || null }),
    clearLabel: 'Clear date',
  },
  // Typed in hours, stored in minutes (as in the create dialog).
  estimate: {
    label: 'Estimate',
    kind: 'hours',
    schema: taskSchema.shape.estimateHours,
    requestField: 'estimateMinutes',
    read: (task) => (task.estimateMinutes === null ? '' : minutesToHours(task.estimateMinutes)),
    stored: (task) => task.estimateMinutes,
    toBody: (text) => ({ estimateMinutes: text ? hoursToMinutes(text) : null }),
    clearLabel: 'Clear estimate',
  },
  // Replaces the whole list; blank removes every label.
  labels: {
    label: 'Labels',
    kind: 'labels',
    schema: taskSchema.shape.labels,
    requestField: 'labels',
    read: (task) => task.labels.join(', '),
    stored: (task) => task.labels,
    toBody: (text) => ({ labels: parseLabels(text) }),
  },
}

// The shared INVALID_DATE_RANGE message only talks about the due date.
const RANGE_MESSAGES: Partial<Record<EditableTaskField, string>> = {
  startDate: 'The start date must be on or before the due date.',
  dueDate: 'The due date must be on or after the start date.',
}

interface FormValues {
  value: string
}

interface TaskFieldEditorProps {
  task: TaskDetail
  // As in the URL (key or id): the task's cache entry.
  taskRef: string
  field: EditableTaskField
  // After a save, a cancel, or a save that changed nothing.
  onClose: () => void
  className?: string
}

// Jira-style inline editor for one task field: Enter (Ctrl+Enter in the description) or Save saves,
// Escape or Cancel discards. Every role may edit a task (contract); a 403 is still handled here.
export function TaskFieldEditor({ task, taskRef, field, onClose, className }: TaskFieldEditorProps) {
  const config = FIELDS[field]
  const id = useId()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const update = useUpdateTask(taskRef)
  const form = useForm<FormValues>({
    resolver: zodResolver(z.object({ value: config.schema })),
    defaultValues: { value: config.read(task) },
  })
  const text = useWatch({ control: form.control, name: 'value' })
  const pending = update.isPending

  // The input is disabled while the request is pending, and onError runs before it's enabled again,
  // so focusing it waits for the render that shows the error.
  const submitError = update.error
  useEffect(() => {
    if (submitError) form.setFocus('value')
  }, [submitError, form])

  const onSubmit = form.handleSubmit(({ value }) => {
    const body = config.toBody(value)
    // Nothing changed: close without a request.
    if (JSON.stringify(body[config.requestField]) === JSON.stringify(config.stored(task))) {
      onClose()
      return
    }
    setFormErrors([])
    update.mutate(body, {
      onSuccess: () => {
        toast.success(`${config.label} updated`)
        onClose()
      },
      onError: (error) => {
        if (hasErrorCode(error, 'INVALID_DATE_RANGE') && RANGE_MESSAGES[field]) {
          form.setError('value', { type: 'server', message: RANGE_MESSAGES[field] })
          return
        }
        // Deleted meanwhile: the page refetches it and shows "Task not found".
        if (isApiError(error) && error.status === 404) {
          toastTaskUpdateError(error)
          return
        }
        // 400 details (labels.3 too) go under the input; 403, 5xx and network errors land in the alert,
        // with the text kept so the user can retry.
        setFormErrors(applyServerErrors(error, ['value'], form.setError, { [config.requestField]: 'value' }))
      },
    })
  })

  function clear() {
    form.setValue('value', '')
    void onSubmit()
  }

  const inputId = `${id}-value`
  const errorId = `${id}-value-error`
  const hintId = `${id}-value-hint`
  const labels = config.kind === 'labels' ? parseLabels(text) : []

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) {
          event.preventDefault()
          onClose()
        }
      }}
      aria-label={`Edit ${config.label.toLowerCase()}`}
      className={cn('flex flex-col gap-2', className)}
    >
      <FormErrorAlert errors={formErrors} />
      <Controller
        name="value"
        control={form.control}
        render={({ field: input, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={inputId} className="sr-only">
              {config.kind === 'hours' ? 'Estimate in hours' : config.label}
            </FieldLabel>
            {config.kind === 'textarea' ? (
              <Textarea
                {...input}
                id={inputId}
                rows={6}
                autoFocus
                placeholder="Details, links, acceptance criteria"
                onKeyDown={(event) => {
                  // Enter is a new line here, so Ctrl/Cmd + Enter saves.
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault()
                    void onSubmit()
                  }
                }}
                aria-invalid={fieldState.invalid}
                aria-describedby={errorId}
                disabled={pending}
              />
            ) : (
              <Input
                {...input}
                id={inputId}
                type={config.kind === 'date' ? 'date' : 'text'}
                autoFocus
                autoComplete="off"
                {...(config.kind === 'hours' && { inputMode: 'decimal' as const, placeholder: '1.5' })}
                {...(config.kind === 'labels' && { spellCheck: false, placeholder: 'survey, q4' })}
                // The title editor takes the h1's place, so it keeps its size.
                className={cn(field === 'title' && 'h-auto py-1 text-2xl font-semibold tracking-tight md:text-2xl')}
                aria-invalid={fieldState.invalid}
                aria-describedby={config.kind === 'hours' || config.kind === 'labels' ? `${hintId} ${errorId}` : errorId}
                disabled={pending}
              />
            )}
            {config.kind === 'hours' && <FieldDescription id={hintId}>In hours, for example 1.5 for 1 h 30 min.</FieldDescription>}
            {config.kind === 'labels' && (
              <>
                <FieldDescription id={hintId}>Separate with commas. Saved in lowercase.</FieldDescription>
                {labels.length > 0 && (
                  <ul aria-label="Labels to save" className="flex flex-wrap gap-1">
                    {labels.map((label) => (
                      <li key={label}>
                        <Badge variant="outline" className="font-normal">
                          {label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <FieldError id={errorId} errors={[fieldState.error]} />
          </Field>
        )}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {config.kind === 'textarea' && <p className="mr-auto text-xs text-muted-foreground">Ctrl+Enter saves, Escape cancels.</p>}
        {config.clearLabel && config.stored(task) !== null && (
          <Button type="button" variant="ghost" size="sm" className="mr-auto" onClick={clear} disabled={pending}>
            {config.clearLabel}
          </Button>
        )}
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
