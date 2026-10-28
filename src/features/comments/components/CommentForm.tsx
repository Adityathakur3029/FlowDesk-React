import { useEffect, useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, Check, Loader2, Send } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode, isApiError, type ApiError } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { applyServerErrors } from '@/lib/formErrors'
import { initials } from '@/lib/initials'
import { useCreateComment, useUpdateComment } from '../api'
import { commentFields, commentSchema, type CommentFormValues } from '../commentSchema'
import { fromMentionTokens, mentionedIn, toMentionTokens } from '../mentions'
import type { Comment, CommentReply, CommentTarget, MentionedPerson } from '../types'
import { MentionTextarea } from './MentionTextarea'

interface CommentFormProps {
  target: CommentTarget
  // Set for a reply: the top-level comment it answers.
  parentId?: string
  // Set to edit this comment (its author only) instead of posting a new one.
  editing?: Comment | CommentReply
  autoFocus?: boolean
  // After the comment is posted or saved.
  onDone?: () => void
  // Shows a Cancel button; Escape cancels an edit too.
  onCancel?: () => void
}

// Posting is open to any active employee (contract), so this isn't role-gated. Editing is the author's;
// the comment only offers it to them.
export function CommentForm({ target, parentId, editing, autoFocus = false, onDone, onCancel }: CommentFormProps) {
  const isReply = parentId !== undefined || (editing !== undefined && editing.parentId !== null)
  const fieldId = useId()
  const { employee } = useAuth()
  const [formErrors, setFormErrors] = useState<string[]>([])
  // The stored body shows mentions as "@Name" too, with those people already picked.
  const [initial] = useState(() => (editing ? fromMentionTokens(editing.body ?? '', editing.mentions) : null))
  // Everyone picked from the @ list; only those whose "@Name" is still in the text are mentioned.
  const [picked, setPicked] = useState<MentionedPerson[]>(initial?.people ?? [])
  const createComment = useCreateComment(target)
  const updateComment = useUpdateComment(target)
  const form = useForm<CommentFormValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: initial?.text ?? '' } })
  const pending = createComment.isPending || updateComment.isPending
  const mentioned = mentionedIn(useWatch({ control: form.control, name: 'body' }), picked)
  const bodyId = `${fieldId}-body`

  const addPicked = (person: MentionedPerson) =>
    setPicked((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]))

  // An edit starts focused, with the caret after the text. Only when the form opens: `initial` never changes,
  // while `editing` is a new object after every refetch of the list.
  useEffect(() => {
    if (!initial) return
    const box = document.getElementById(bodyId)
    if (box instanceof HTMLTextAreaElement) {
      box.focus()
      box.setSelectionRange(box.value.length, box.value.length)
    }
  }, [initial, bodyId])

  // The textarea is disabled while the request is pending, and onError runs before it's enabled again,
  // so focusing it waits for the render that shows the error.
  const submitError = editing ? updateComment.error : createComment.error
  useEffect(() => {
    if (submitError) form.setFocus('body')
  }, [submitError, form])

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    // The box shows mentions as "@Name"; the contract wants @[Name](mention:<uuid>).
    const body = toMentionTokens(values.body, picked)
    // Coded errors (NESTED_REPLY, TOO_MANY_MENTIONS, a 403…) have no field details and land in the alert.
    const showErrors = (error: ApiError) => setFormErrors(applyServerErrors(error, commentFields, form.setError))

    if (editing) {
      updateComment.mutate(
        { commentId: editing.id, body },
        {
          onSuccess: () => {
            toast.success(isReply ? 'Reply updated' : 'Comment updated')
            onDone?.()
          },
          onError: (error) => {
            // Deleted meanwhile: the list refetches without it, and this form goes with it.
            if (isApiError(error) && error.status === 404) toast.error('This comment has been deleted.')
            else showErrors(error)
          },
        },
      )
      return
    }

    createComment.mutate(
      { body, ...(parentId && { parentId }) },
      {
        onSuccess: () => {
          toast.success(isReply ? 'Reply added' : 'Comment added')
          form.reset()
          setPicked([])
          onDone?.()
        },
        onError: (error) => {
          // The refetch can remove the whole thread, and this form with it, so say it in a toast too.
          if (hasErrorCode(error, 'PARENT_COMMENT_NOT_FOUND')) toast.error(getErrorMessage(error))
          showErrors(error)
        },
      },
    )
  })

  let formLabel = isReply ? 'Reply' : 'Add a comment'
  if (editing) formLabel = isReply ? 'Edit reply' : 'Edit comment'
  let submitLabel = isReply ? 'Post reply' : 'Post comment'
  if (editing) submitLabel = 'Save'

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        // The @ list handles its own Escape (and prevents the default), so this only cancels an edit.
        if (editing && event.key === 'Escape' && !event.defaultPrevented && !pending) {
          event.preventDefault()
          onCancel?.()
        }
      }}
      aria-label={formLabel}
      className="flex gap-3"
    >
      {!isReply && !editing && employee && (
        <Avatar aria-hidden="true" className="mt-0.5 hidden sm:flex">
          <AvatarFallback className="bg-blue-600 text-white">{initials(employee.name)}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <FormErrorAlert errors={formErrors} />
        <Controller
          name="body"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={bodyId} className="sr-only">
                {isReply ? 'Reply' : 'Comment'}
              </FieldLabel>
              <MentionTextarea
                {...field}
                onMention={addPicked}
                id={bodyId}
                rows={isReply ? 2 : 3}
                placeholder={isReply ? 'Write a reply…' : 'Add a comment…'}
                autoFocus={autoFocus}
                onKeyDown={(event) => {
                  // Ctrl/Cmd + Enter posts (or saves), as in most comment boxes.
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault()
                    void onSubmit()
                  }
                }}
                aria-invalid={fieldState.invalid}
                aria-describedby={`${fieldId}-body-hint ${fieldId}-body-error`}
                disabled={pending}
                className="bg-background"
              />
              <FieldError id={`${fieldId}-body-error`} errors={[fieldState.error]} />
            </Field>
          )}
        />
        {mentioned.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span id={`${fieldId}-mentions`}>Mentioning</span>
            <ul aria-labelledby={`${fieldId}-mentions`} className="flex flex-wrap gap-1">
              {mentioned.map((person) => (
                <li key={person.id} className="rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
                  @{person.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`${fieldId}-body-hint`} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <AtSign className="size-3.5" aria-hidden="true" />
            {editing ? 'Type @ to mention someone. Ctrl+Enter saves, Escape cancels.' : 'Type @ to mention someone. Ctrl+Enter posts.'}
          </p>
          <div className="ml-auto flex gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : editing ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}
              {pending ? (editing ? 'Saving…' : 'Posting…') : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
