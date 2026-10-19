import { z } from 'zod'
import { PROGRAM_STATUSES } from './programStatus'

// CreateProgramRequest.key's pattern, which the server applies after trimming and uppercasing.
export const PROGRAM_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

// A native date input holds '' or YYYY-MM-DD. The range rule (end on or after start) is left to the
// server, which answers INVALID_DATE_RANGE.
const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.')

// Mirrors CreateProgramRequest for instant feedback only; the server's details win.
export const programSchema = z.object({
  name: z.string().trim().min(1, 'Enter a program name.').max(150, 'Use at most 150 characters.'),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter a key.')
    .regex(PROGRAM_KEY_PATTERN, 'Use 2–10 letters or digits, starting with a letter.'),
  ownerTeamId: z.string().min(1, 'Pick the team that owns this program.'),
  status: z.enum(PROGRAM_STATUSES),
  startDate: optionalDate,
  endDate: optionalDate,
  description: z.string().max(10000, 'Use at most 10,000 characters.'),
})

export type ProgramFormValues = z.infer<typeof programSchema>

export const programFields = ['name', 'key', 'ownerTeamId', 'status', 'startDate', 'endDate', 'description'] as const
