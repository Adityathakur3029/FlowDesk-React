import { z } from 'zod'
import type { Employee } from './types'

// Radix Select needs a non-empty value, so "No team" is this sentinel in the form and null in the API.
export const NO_TEAM = 'none'

// Mirrors UpdateEmployeeRequest (plus the team) for instant feedback only; the server's details win.
export const editEmployeeSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(150, 'Use at most 150 characters.'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  isActive: z.boolean(),
  teamId: z.string(),
})

export type EditEmployeeValues = z.infer<typeof editEmployeeSchema>

// Fields a PATCH /employees/{id} 400 can name.
export const editEmployeeFields = ['name', 'role', 'isActive'] as const

export const toEditValues = (employee: Employee): EditEmployeeValues => ({
  name: employee.name,
  role: employee.role,
  isActive: employee.isActive,
  teamId: employee.teamId ?? NO_TEAM,
})

export const toTeamId = (value: string): string | null => (value === NO_TEAM ? null : value)
