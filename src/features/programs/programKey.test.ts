import { describe, expect, it } from 'vitest'
import { suggestProgramKey } from './programKey'

describe('suggestProgramKey', () => {
  it.each([
    ['Marketing Research', 'MR'],
    ['Q4 Market Research', 'QMR'],
    ['Onboarding', 'ONB'],
    ['2026 Hiring Drive', 'HD'],
    ['Design-System v2', 'DSV'],
    ['A', ''],
    ['नई पहल', ''],
    ['', ''],
    ['one two three four five six seven eight nine ten eleven', 'OTTFFSSENT'],
  ])('%j → %j', (name, key) => {
    expect(suggestProgramKey(name)).toBe(key)
  })
})
