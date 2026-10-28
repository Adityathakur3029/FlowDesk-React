import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { applyServerErrors } from './formErrors'

interface Values {
  title: string
  labels: string
  assignee: string[]
}

const fields = ['title', 'labels', 'assignee'] as const
const validation = (fieldErrors: Record<string, string>, formErrors: string[] = []) =>
  new ApiError({ status: 400, fieldErrors, formErrors, serverMessage: 'Validation failed' })

describe('applyServerErrors', () => {
  it('puts a nested path on its top-level field', () => {
    const setError = vi.fn()
    const rest = applyServerErrors<Values>(validation({ 'labels.2': 'Invalid label' }), fields, setError)
    expect(setError).toHaveBeenCalledWith('labels', { type: 'server', message: 'Invalid label' }, { shouldFocus: true })
    expect(rest).toEqual([])
  })

  it('maps a request field to its form field through an alias', () => {
    const setError = vi.fn()
    applyServerErrors<Values>(validation({ assigneeId: 'Invalid UUID' }), fields, setError, { assigneeId: 'assignee' })
    expect(setError).toHaveBeenCalledWith('assignee', { type: 'server', message: 'Invalid UUID' }, { shouldFocus: true })
  })

  it('returns unknown paths and form-level issues for the alert, focusing only the first field', () => {
    const setError = vi.fn()
    const rest = applyServerErrors<Values>(
      validation({ title: 'Too long', extra: 'Unrecognized key', labels: 'Too many' }, ['Body must be an object']),
      fields,
      setError,
    )
    expect(rest).toEqual(['Body must be an object', 'Unrecognized key'])
    expect(setError).toHaveBeenNthCalledWith(1, 'title', { type: 'server', message: 'Too long' }, { shouldFocus: true })
    expect(setError).toHaveBeenNthCalledWith(2, 'labels', { type: 'server', message: 'Too many' }, { shouldFocus: false })
  })

  it('returns the error message when no field took anything', () => {
    const setError = vi.fn()
    const rest = applyServerErrors<Values>(new ApiError({ status: 500, serverMessage: 'Internal server error' }), fields, setError)
    expect(rest).toEqual(['Something went wrong on our side. Try again.'])
    expect(setError).not.toHaveBeenCalled()
  })
})
