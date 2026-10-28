import { z } from 'zod'

// Mirrors CreateCommentRequest.body (trimmed, 1-10,000 characters) for instant feedback only; the server's details win.
export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first.').max(10000, 'Use at most 10,000 characters.'),
})

export type CommentFormValues = z.infer<typeof commentSchema>

export const commentFields = ['body'] as const
