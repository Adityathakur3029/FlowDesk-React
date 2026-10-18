import { z } from 'zod'
import type { Employee } from '@/features/employees'

// Mirrors CreateTeamRequest for instant feedback only; the server's details win. Members aren't
// part of the request: each one is a PUT after the team exists.
export const teamSchema = z.object({
  name: z.string().trim().min(1, 'Enter a team name.').max(100, 'Use at most 100 characters.'),
  description: z.string().max(2000, 'Use at most 2,000 characters.'),
  members: z.array(z.custom<Employee>()),
})

export type TeamFormValues = z.infer<typeof teamSchema>

export const teamFields = ['name', 'description'] as const
