import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode, isApiError } from '@/api/errors'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors } from '@/lib/formErrors'
import { keyHint, suggestKey } from '@/lib/keys'
import { boardPath } from '@/routes/paths'
import { useCreateBoard } from '../api'
import { boardFields, boardSchema, type BoardFormValues } from '../boardSchema'
import type { CreateBoardRequest } from '../types'

const DEFAULT_VALUES: BoardFormValues = { name: '', key: '', description: '' }

// Callers render this only for ADMIN and MANAGER. The backend still decides: a 403 shows here.
// A new board opens on its own page, ready for its first task.
export function CreateBoardDialog() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  // The key last suggested from the name. The name only fills the key while it's empty or still this.
  const lastSuggestion = useRef('')
  const createBoard = useCreateBoard()
  const form = useForm<BoardFormValues>({ resolver: zodResolver(boardSchema), defaultValues: DEFAULT_VALUES })
  const key = useWatch({ control: form.control, name: 'key' })
  const pending = createBoard.isPending

  // Fields are disabled while the request is pending, and onError runs before they're enabled again,
  // so focusing the first field with a server error waits for the render that shows the new error.
  const submitError = createBoard.error
  useEffect(() => {
    if (!submitError) return
    const invalid = boardFields.find((name) => form.getFieldState(name).invalid)
    if (invalid) form.setFocus(invalid)
  }, [submitError, form])

  function close() {
    setOpen(false)
    setFormErrors([])
    createBoard.reset()
  }

  function handleOpenChange(next: boolean) {
    // A closed dialog must never hide a request still in flight.
    if (pending) return
    if (next) {
      form.reset(DEFAULT_VALUES)
      lastSuggestion.current = ''
      setOpen(true)
    } else {
      close()
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    // A blank description is left out.
    const body: CreateBoardRequest = {
      key: values.key,
      name: values.name,
      ...(values.description.trim() && { description: values.description }),
    }
    createBoard.mutate(body, {
      onSuccess: (board) => {
        // The server's trimmed, uppercased values.
        toast.success(`Board ${board.key} created`, { description: board.name })
        close()
        void navigate(boardPath(board.id))
      },
      onError: (error) => {
        // Coded errors carry no field details, so applyServerErrors would put them in the form alert.
        if (hasErrorCode(error, 'BOARD_KEY_EXISTS')) {
          form.setError('key', { type: 'server', message: getErrorMessage(error) })
          return
        }
        if (isApiError(error) && error.status === 403) {
          setFormErrors(["You don't have permission to create boards."])
          return
        }
        setFormErrors(applyServerErrors(error, boardFields, form.setError))
      },
    })
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus aria-hidden="true" />
          Create board
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a board</DialogTitle>
          <DialogDescription>A board collects tasks on one topic. It has no dates, status or owner team.</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-board-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormErrorAlert errors={formErrors} />

            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="board-name">Name</FieldLabel>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        const suggestion = suggestKey(event.target.value)
                        const current = form.getValues('key')
                        if (current === '' || current === lastSuggestion.current) {
                          form.setValue('key', suggestion, { shouldValidate: form.formState.isSubmitted })
                        }
                        lastSuggestion.current = suggestion
                      }}
                      id="board-name"
                      autoComplete="off"
                      placeholder="Product feedback"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="board-name-error"
                      disabled={pending}
                    />
                    <FieldError id="board-name-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="key"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="board-key">Key</FieldLabel>
                    <Input
                      {...field}
                      onChange={(event) => {
                        // Uppercase in the DOM first, keeping the caret where it was, so React doesn't move it to the end.
                        const input = event.target
                        const { selectionStart, selectionEnd } = input
                        input.value = input.value.toUpperCase()
                        input.setSelectionRange(selectionStart, selectionEnd)
                        field.onChange(input.value)
                      }}
                      id="board-key"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="PRO"
                      className="font-mono uppercase"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="board-key-hint board-key-error"
                      disabled={pending}
                    />
                    <FieldDescription id="board-key-hint">{keyHint(key)}</FieldDescription>
                    <FieldError id="board-key-error" errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="board-description">Description (optional)</FieldLabel>
                    <Textarea
                      {...field}
                      id="board-description"
                      rows={4}
                      placeholder="What the board collects"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="board-description-error"
                      disabled={pending}
                    />
                    <FieldError id="board-description-error" errors={[fieldState.error]} />
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
          <Button type="submit" form="create-board-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {pending ? 'Creating board…' : 'Create board'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
