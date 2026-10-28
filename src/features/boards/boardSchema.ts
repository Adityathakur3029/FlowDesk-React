import { z } from 'zod'
import { keySchema } from '@/lib/keys'

// Mirrors CreateBoardRequest for instant feedback only; the server's details win.
export const boardSchema = z.object({
  name: z.string().trim().min(1, 'Enter a board name.').max(150, 'Use at most 150 characters.'),
  key: keySchema,
  description: z.string().max(10000, 'Use at most 10,000 characters.'),
})

export type BoardFormValues = z.infer<typeof boardSchema>

export const boardFields = ['name', 'key', 'description'] as const
