import { z } from 'zod'

// Mirrors CreateInviteRequest for instant feedback only. The @saajha.org domain rule is the backend's;
// its 400 for `email` is shown on the field.
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address.')
    .max(255, 'Use at most 255 characters.')
    .pipe(z.email('Enter a valid email address.')),
  name: z.string().trim().min(1, 'Enter a name.').max(150, 'Use at most 150 characters.'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
})

export type InviteFormValues = z.infer<typeof inviteSchema>

export const inviteFields = ['email', 'name', 'role'] as const
