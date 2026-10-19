import { z } from 'zod'
import type { Employee } from '@/features/employees'
import { CREATABLE_TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from './taskDisplay'

// CreateTaskRequest.labels item pattern, which the server applies after trimming and lowercasing.
const LABEL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,49}$/
const MAX_LABELS = 20
const MAX_ESTIMATE_HOURS = 8760 // estimateMinutes is at most 525,600 (one year)

// Splits the Labels input the way the server normalises labels: trimmed, lowercased, no duplicates.
// Commas and whitespace both separate labels, since a label can't contain a space.
export function parseLabels(text: string): string[] {
  const labels = text
    .split(/[\s,]+/)
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(labels)]
}

// The contract stores minutes; the form asks for hours. Anything the schema accepts is at least 1 minute.
export const hoursToMinutes = (hours: string) => Math.round(Number(hours) * 60)

// A native date input holds '' or YYYY-MM-DD. The range rule (due on or after start) is left to the
// server, which answers INVALID_DATE_RANGE.
const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a valid date.')

// Mirrors CreateTaskRequest for instant feedback only; the server's details win.
export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(255, 'Use at most 255 characters.'),
  type: z.enum(TASK_TYPES),
  status: z.enum(CREATABLE_TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  assignee: z.array(z.custom<Employee>()).max(1),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimateHours: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= MAX_ESTIMATE_HOURS),
      'Enter hours as a number, up to 8,760 (one year).',
    ),
  labels: z.string().superRefine((value, ctx) => {
    const labels = parseLabels(value)
    const invalid = labels.find((label) => !LABEL_PATTERN.test(label))
    if (invalid !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `“${invalid}” can only use letters, digits, '.', '_' and '-', start with a letter or digit, and be up to 50 characters.`,
      })
    } else if (labels.length > MAX_LABELS) {
      ctx.addIssue({ code: 'custom', message: 'Use at most 20 labels.' })
    }
  }),
  description: z.string().max(20000, 'Use at most 20,000 characters.'),
})

export type TaskFormValues = z.infer<typeof taskSchema>

export const taskFields = [
  'title',
  'type',
  'status',
  'priority',
  'assignee',
  'startDate',
  'dueDate',
  'estimateHours',
  'labels',
  'description',
] as const

// Request fields whose form field has another name.
export const taskFieldAliases = { assigneeId: 'assignee', estimateMinutes: 'estimateHours' } as const
