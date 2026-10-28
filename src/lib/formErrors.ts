import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { getErrorMessage, isApiError } from '@/api/errors'

// Puts a 400's `details` onto the matching form fields (the server always wins over the zod schema)
// and returns what's left for a form-level alert: unmatched issues, or the error's message when
// no field took anything (409, 502, 500, network…).
// A nested path (`labels.3`) goes to its top-level field. `aliases` maps a request field to the form
// field that edits it when their names differ (`{ assigneeId: 'assignee' }`).
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
  aliases: Partial<Record<string, Path<T>>> = {},
): string[] {
  if (!isApiError(error)) return [getErrorMessage(error)]
  const unmatched = [...error.formErrors]
  let applied = false
  for (const [path, message] of Object.entries(error.fieldErrors)) {
    const top = path.split('.')[0]
    const field = aliases[top] ?? fields.find((f) => f === top)
    if (!field) {
      unmatched.push(message)
      continue
    }
    setError(field, { type: 'server', message }, { shouldFocus: !applied })
    applied = true
  }
  if (!applied && unmatched.length === 0) return [getErrorMessage(error)]
  return unmatched
}
