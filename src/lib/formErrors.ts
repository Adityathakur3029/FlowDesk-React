import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { getErrorMessage, isApiError } from '@/api/errors'

// Puts a 400's `details` onto the matching form fields (the server always wins over the zod schema)
// and returns what's left for a form-level alert: unmatched issues, or the error's message when
// no field took anything (409, 502, 500, network…).
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): string[] {
  if (!isApiError(error)) return [getErrorMessage(error)]
  const unmatched = [...error.formErrors]
  let applied = false
  for (const [path, message] of Object.entries(error.fieldErrors)) {
    const field = fields.find((f) => f === path)
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
