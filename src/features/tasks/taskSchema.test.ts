import { describe, expect, it } from 'vitest'
import { hoursToMinutes, parseLabels, taskSchema, type TaskFormValues } from './taskSchema'

const valid: TaskFormValues = {
  title: 'Draft survey questions',
  type: 'TASK',
  status: 'DISCUSSION',
  priority: 'MEDIUM',
  assignee: [],
  startDate: '',
  dueDate: '',
  estimateHours: '',
  labels: '',
  description: '',
}

const errorOn = (overrides: Partial<TaskFormValues>, field: keyof TaskFormValues) => {
  const result = taskSchema.safeParse({ ...valid, ...overrides })
  return result.success ? undefined : result.error.issues.find((issue) => issue.path[0] === field)?.message
}

describe('parseLabels', () => {
  it('splits on commas and spaces, lowercases and removes duplicates', () => {
    expect(parseLabels(' Survey, q4  survey,,')).toEqual(['survey', 'q4'])
  })

  it('returns nothing for a blank input', () => {
    expect(parseLabels('  ,  ')).toEqual([])
  })
})

describe('hoursToMinutes', () => {
  it.each([
    ['1.5', 90],
    ['8', 480],
    ['0.01', 1],
    ['8760', 525600],
  ])('%s h → %i min', (hours, minutes) => {
    expect(hoursToMinutes(hours)).toBe(minutes)
  })
})

describe('taskSchema', () => {
  it('accepts a title-only task', () => {
    expect(taskSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a title', () => {
    expect(errorOn({ title: '   ' }, 'title')).toBe('Enter a title.')
  })

  it.each(['0', 'abc', '8761', '1.234', '-1'])('rejects the estimate %j', (estimateHours) => {
    expect(errorOn({ estimateHours }, 'estimateHours')).toBe('Enter hours as a number, up to 8,760 (one year).')
  })

  it.each(['1.5', ' 2 ', '8760'])('accepts the estimate %j', (estimateHours) => {
    expect(errorOn({ estimateHours }, 'estimateHours')).toBeUndefined()
  })

  it('names the first invalid label', () => {
    expect(errorOn({ labels: 'ok, bad!label' }, 'labels')).toBe(
      "“bad!label” can only use letters, digits, '.', '_' and '-', start with a letter or digit, and be up to 50 characters.",
    )
  })

  it('allows at most 20 labels', () => {
    const labels = Array.from({ length: 21 }, (_, i) => `l${i}`).join(',')
    expect(errorOn({ labels }, 'labels')).toBe('Use at most 20 labels.')
  })

  it('rejects a label starting with a dot', () => {
    expect(errorOn({ labels: '.hidden' }, 'labels')).toMatch(/^“\.hidden”/)
  })
})
