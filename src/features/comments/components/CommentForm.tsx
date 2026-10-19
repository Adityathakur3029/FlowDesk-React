import { useEffect, useId, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Send } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode } from '@/api/errors'
import { FormErrorAlert } from '@/components/feedback/FormErrorAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors } from '@/lib/formErrors'
import { useCreateProgramComment } from '../api'
import { commentFields, commentSchema, type CommentFormValues } from '../commentSchema'

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
  const [formErrors, setFormErrors] = useState<string[]>([])
  const createComment = useCreateProgramComment(programId)
  const form = useForm<CommentFormValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: '' } })
  const pending = createComment.isPending

  // The textarea is disabled while the request is pending, and onError runs before it's enabled again,
  // so focusing it waits for the render that shows the error.
  const submitError = createComment.error
  useEffect(() => {
    if (submitError) form.setFocus('body')
  }, [submitError, form])

  const onSubmit = form.handleSubmit((values) => {
    setFormErrors([])
    createComment.mutate(
      { body: values.body, ...(parentId && { parentId }) },
      {
        onSuccess: () => {
          toast.success(isReply ? 'Reply added' : 'Comment added')
          form.reset()
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
    <form noValidate onSubmit={onSubmit} aria-label={isReply ? 'Reply' : 'Add a comment'} className="flex flex-col gap-2">
      <FormErrorAlert errors={formErrors} />
      <Controller
        name="body"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${fieldId}-body`} className="sr-only">
              {isReply ? 'Reply' : 'Comment'}
            </FieldLabel>
            <Textarea
              {...field}
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
              aria-describedby={`${fieldId}-body-error`}
              disabled={pending}
            />
            <FieldError id={`${fieldId}-body-error`} errors={[fieldState.error]} />
          </Field>
        )}
      />
      <div className="flex justify-end gap-2">
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
    </form>
  )
}
