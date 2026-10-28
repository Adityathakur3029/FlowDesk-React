import { describe, expect, it } from 'vitest'
import { keyHint, suggestKey } from './keys'

describe('suggestKey', () => {
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
    expect(suggestKey(name)).toBe(key)
  })
})

describe('keyHint', () => {
  it('shows the prefix of a valid key, and the rule otherwise', () => {
    expect(keyHint(' PRO ')).toBe("Task keys will start with PRO-. The key can't be changed later.")
    expect(keyHint('P')).toBe("2–10 letters or digits, starting with a letter. It can't be changed later.")
  })
})
