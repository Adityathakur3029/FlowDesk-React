import { useEffect, useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, Loader2, Send } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode } from '@/api/errors'
import { useAuth } from '@/auth/useAuth'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { applyServerErrors } from '@/lib/formErrors'
import { initials } from '@/lib/initials'
import { useCreateProgramComment } from '../api'
import { commentFields, commentSchema, type CommentFormValues } from '../commentSchema'
import { mentionedIn, toMentionTokens } from '../mentions'
import type { MentionedPerson } from '../types'
import { MentionTextarea } from './MentionTextarea'

interface CommentFormProps {
  programId: string
  // Set for a reply: the top-level comment it answers.
  parentId?: string
  autoFocus?: boolean
  // After the comment is posted.
  onDone?: () => void
  // Shows a Cancel button.
  onCancel?: () => void
}

// Any active employee can comment (contract), so this isn't role-gated.
export function CommentForm({ programId, parentId, autoFocus = false, onDone, onCancel }: CommentFormProps) {
  const isReply = parentId !== undefined
  const fieldId = useId()
  const { employee } = useAuth()
  const [formErrors, setFormErrors] = useState<string[]>([])
  // Everyone picked from the @ list; only those whose "@Name" is still in the text are mentioned.
  const [picked, setPicked] = useState<MentionedPerson[]>([])
  const createComment = useCreateProgramComment(programId)
  const form = useForm<CommentFormValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: '' } })
  const pending = createComment.isPending
  const mentioned = mentionedIn(useWatch({ control: form.control, name: 'body' }), picked)

  const addPicked = (person: MentionedPerson) =>
    setPicked((prev) => (prev.some((p) => p.id === person.id) ? prev : [...prev, person]))

  // The textarea is disabled while the request is pending, and onError runs before it's enabled again,
  // so focusing it waits for the render that shows the error.
  const submitError = createComment.error
  useEffect(() => {
    if (submitError) form.setFocus('body')
  }, [submitError, form])

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    createComment.mutate(
      // The box shows mentions as "@Name"; the contract wants @[Name](mention:<uuid>).
      { body: toMentionTokens(values.body, picked), ...(parentId && { parentId }) },
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
          // Coded errors (NESTED_REPLY, TOO_MANY_MENTIONS, a 404…) have no field details and land in the alert.
          setFormErrors(applyServerErrors(error, commentFields, form.setError))
        },
      },
    )
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-label={isReply ? 'Reply' : 'Add a comment'} className="flex gap-3">
      {!isReply && employee && (
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
              <FieldLabel htmlFor={`${fieldId}-body`} className="sr-only">
                {isReply ? 'Reply' : 'Comment'}
              </FieldLabel>
              <MentionTextarea
                {...field}
                onMention={addPicked}
                id={`${fieldId}-body`}
                rows={isReply ? 2 : 3}
                placeholder={isReply ? 'Write a reply…' : 'Add a comment…'}
                autoFocus={autoFocus}
                onKeyDown={(event) => {
                  // Ctrl/Cmd + Enter posts, as in most comment boxes.
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
            Type @ to mention someone. Ctrl+Enter posts.
          </p>
          <div className="ml-auto flex gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {pending ? 'Posting…' : isReply ? 'Post reply' : 'Post comment'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
