import { useEffect, useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { hasErrorCode, isApiError } from '@/api/errors'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors } from '@/lib/formErrors'
import { cn } from '@/lib/utils'
import { useUpdateProgram } from '../api'
import { programSchema } from '../programSchema'
import type { Program, UpdateProgramRequest } from '../types'

export type EditableProgramField = 'name' | 'description' | 'startDate' | 'endDate'

interface FieldConfig {
  // The input's label, also used in "Edit …" and the toast.
  label: string
  kind: 'text' | 'textarea' | 'date'
  // Mirrors UpdateProgramRequest for instant feedback only; the server's details win.
  schema: z.ZodString
  // The program's value as the input's text.
  read: (program: Program) => string
  // The input's text as the PATCH body: only this field.
  toBody: (text: string) => UpdateProgramRequest
}

const FIELDS: Record<EditableProgramField, FieldConfig> = {
  name: {
    label: 'Name',
    kind: 'text',
    schema: programSchema.shape.name,
    read: (program) => program.name,
    toBody: (text) => ({ name: text }),
  },
  // A blank description clears it (null), as on create.
  description: {
    label: 'Description',
    kind: 'textarea',
    schema: programSchema.shape.description,
    read: (program) => program.description ?? '',
    toBody: (text) => ({ description: text.trim() ? text : null }),
  },
  startDate: {
    label: 'Start date',
    kind: 'date',
    schema: programSchema.shape.startDate,
    read: (program) => program.startDate ?? '',
    toBody: (text) => ({ startDate: text || null }),
  },
  endDate: {
    label: 'End date',
    kind: 'date',
    schema: programSchema.shape.endDate,
    read: (program) => program.endDate ?? '',
    toBody: (text) => ({ endDate: text || null }),
  },
}

// The shared INVALID_DATE_RANGE message is worded for tasks (start and due date).
const RANGE_MESSAGES: Partial<Record<EditableProgramField, string>> = {
  startDate: 'The start date must be on or before the end date.',
  endDate: 'The end date must be on or after the start date.',
}

interface FormValues {
  value: string
}

interface ProgramFieldEditorProps {
  program: Program
  field: EditableProgramField
  // After a save, a cancel, or a save that changed nothing.
  onClose: () => void
  className?: string
}

// Jira-style inline editor for one program field: Enter (Ctrl+Enter in the description) or Save saves,
// Escape or Cancel discards. The page only shows it to ADMIN and MANAGER; a 403 is still handled here.
export function ProgramFieldEditor({ program, field, onClose, className }: ProgramFieldEditorProps) {
  const config = FIELDS[field]
  const id = useId()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const update = useUpdateProgram(program.id)
  const form = useForm<FormValues>({
    resolver: zodResolver(z.object({ value: config.schema })),
    defaultValues: { value: config.read(program) },
  })
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
    if (body[field] === program[field]) {
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
        // Deleted meanwhile: the page refetches it and shows "Program not found".
        if (isApiError(error) && error.status === 404) {
          toast.error('This program has been deleted.')
          return
        }
        // 403, 5xx and network errors land in the alert, with the text kept so the user can retry.
        setFormErrors(applyServerErrors(error, ['value'], form.setError, { [field]: 'value' }))
      },
    })
  })

  function clearDate() {
    form.setValue('value', '')
    void onSubmit()
  }

  const inputId = `${id}-value`
  const errorId = `${id}-value-error`

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
              {config.label}
            </FieldLabel>
            {config.kind === 'textarea' ? (
              <Textarea
                {...input}
                id={inputId}
                rows={6}
                autoFocus
                placeholder="Describe the program's goal, scope and anything people should know."
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
                type={config.kind}
                autoFocus
                // The name editor takes the h1's place, so it keeps its size.
                className={cn(field === 'name' && 'h-auto py-1 text-2xl font-semibold tracking-tight md:text-2xl')}
                aria-invalid={fieldState.invalid}
                aria-describedby={errorId}
                disabled={pending}
              />
            )}
            <FieldError id={errorId} errors={[fieldState.error]} />
          </Field>
        )}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {config.kind === 'textarea' && <p className="mr-auto text-xs text-muted-foreground">Ctrl+Enter saves, Escape cancels.</p>}
        {config.kind === 'date' && program[field] !== null && (
          <Button type="button" variant="ghost" size="sm" className="mr-auto" onClick={clearDate} disabled={pending}>
            Clear date
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
