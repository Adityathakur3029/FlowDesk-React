import { describe, expect, it } from 'vitest'
import { findMentionQuery, insertMention, mentionedIn, toMentionTokens } from './mentions'

const JANE = { id: 'baac08e5-eaef-46f0-ac9e-f8b7266c71e0', name: 'Jane Doe' }
const JAN = { id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', name: 'Jan' }

describe('findMentionQuery', () => {
  it.each([
    ['@', 0, ''],
    ['Hi @ja', 3, 'ja'],
    ['(@jane d', 1, 'jane d'],
    ['Line one\n@Jane', 9, 'Jane'],
  ])('finds the query in %j', (text, start, query) => {
    expect(findMentionQuery(text, text.length)).toEqual({ start, query })
  })

  it.each(['no mention', 'mail jane@saajha.org', '@ jane', '@jane  doe', '@one two three four', 'a @b\nc', '@[Jane'])(
    'finds nothing in %j',
    (text) => {
      expect(findMentionQuery(text, text.length)).toBeNull()
    },
  )

  it('only looks before the caret', () => {
    expect(findMentionQuery('@jane and more', 5)).toEqual({ start: 0, query: 'jane' })
    expect(findMentionQuery('Hello @jane', 3)).toBeNull()
  })
})

describe('insertMention', () => {
  it('replaces the query with the name and a space', () => {
    expect(insertMention('Hi @ja', 3, 6, 'Jane Doe')).toEqual({ text: 'Hi @Jane Doe ', caret: 13 })
  })

  it("doesn't double a following space and strips brackets from the name", () => {
    expect(insertMention('@ja please', 0, 3, 'Jane [Ops]')).toEqual({ text: '@Jane Ops please', caret: 10 })
  })
})

describe('toMentionTokens', () => {
  it('turns picked names into tokens and leaves the rest as typed', () => {
    expect(toMentionTokens('@Jane Doe and @Jan, not @Bob or jane@Jan', [JAN, JANE])).toBe(
      `@[Jane Doe](mention:${JANE.id}) and @[Jan](mention:${JAN.id}), not @Bob or jane@Jan`,
    )
  })

  it('leaves an edited name as text', () => {
    expect(toMentionTokens('@Jane Do', [JANE])).toBe('@Jane Do')
    expect(toMentionTokens('@Jane Doesmith', [JANE])).toBe('@Jane Doesmith')
  })

  it('returns the body unchanged without picks', () => {
    expect(toMentionTokens('@Jane Doe', [])).toBe('@Jane Doe')
  })
})

describe('mentionedIn', () => {
  it('lists the picked people still in the body, once each, in order', () => {
    expect(mentionedIn('@Jan then @Jane Doe and @Jan again', [JANE, JAN])).toEqual([JAN, JANE])
    expect(mentionedIn('nobody here', [JANE])).toEqual([])
  })
})
