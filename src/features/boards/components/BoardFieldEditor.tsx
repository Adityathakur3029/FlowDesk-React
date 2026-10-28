import { useEffect, useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors } from '@/lib/formErrors'
import { useUpdateBoard } from '../api'
import { boardSchema } from '../boardSchema'
import type { Board, UpdateBoardRequest } from '../types'

export type EditableBoardField = 'name' | 'description'

interface FieldConfig {
  // The input's label, also used in "Edit …" and the toast.
  label: string
  // Mirrors UpdateBoardRequest for instant feedback only; the server's details win.
  schema: z.ZodString
  // The board's value as the input's text.
  read: (board: Board) => string
  // The input's text as the PATCH body: only this field.
  toBody: (text: string) => UpdateBoardRequest
}

const FIELDS: Record<EditableBoardField, FieldConfig> = {
  name: {
    label: 'Name',
    schema: boardSchema.shape.name,
    read: (board) => board.name,
    toBody: (text) => ({ name: text }),
  },
  // A blank description clears it (null), as on create.
  description: {
    label: 'Description',
    schema: boardSchema.shape.description,
    read: (board) => board.description ?? '',
    toBody: (text) => ({ description: text.trim() ? text : null }),
  },
}

interface FormValues {
  value: string
}

interface BoardFieldEditorProps {
  board: Board
  field: EditableBoardField
  // After a save, a cancel, or a save that changed nothing.
  onClose: () => void
}

// Jira-style inline editor for the board's name or description: Enter (Ctrl+Enter in the description) or Save
// saves, Escape or Cancel discards. The page only shows it to ADMIN and MANAGER; a 403 is still handled here.
export function BoardFieldEditor({ board, field, onClose }: BoardFieldEditorProps) {
  const config = FIELDS[field]
  const id = useId()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const update = useUpdateBoard(board.id)
  const form = useForm<FormValues>({
    resolver: zodResolver(z.object({ value: config.schema })),
    defaultValues: { value: config.read(board) },
  })
  const pending = update.isPending
  const multiline = field === 'description'

  // The input is disabled while the request is pending, and onError runs before it's enabled again,
  // so focusing it waits for the render that shows the error.
  const submitError = update.error
  useEffect(() => {
    if (submitError) form.setFocus('value')
  }, [submitError, form])

  const onSubmit = form.handleSubmit(({ value }) => {
    const body = config.toBody(value)
    // Nothing changed: close without a request.
    if (body[field] === board[field]) {
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
        // Deleted meanwhile: the page refetches it and shows "Board not found".
        if (isApiError(error) && error.status === 404) {
          toast.error('This board has been deleted.')
          return
        }
        if (isApiError(error) && error.status === 403) {
          setFormErrors(["You don't have permission to edit boards."])
          return
        }
        // 5xx and network errors land in the alert, with the text kept so the user can retry.
        setFormErrors(applyServerErrors(error, ['value'], form.setError, { [field]: 'value' }))
      },
    })
  })

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
      className="flex flex-col gap-2"
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
            {multiline ? (
              <Textarea
                {...input}
                id={inputId}
                rows={6}
                autoFocus
                placeholder="Describe what the board collects and anything people should know."
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
                autoFocus
                // The name editor takes the h1's place, so it keeps its size.
                className="h-auto py-1 text-2xl font-semibold tracking-tight md:text-2xl"
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
        {multiline && <p className="mr-auto text-xs text-muted-foreground">Ctrl+Enter saves, Escape cancels.</p>}
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
