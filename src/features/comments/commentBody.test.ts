import { describe, expect, it } from 'vitest'
import { parseCommentBody } from './commentBody'

const JANE = 'baac08e5-eaef-46f0-ac9e-f8b7266c71e0'

describe('parseCommentBody', () => {
  it('splits text and mention tokens in order', () => {
    expect(parseCommentBody(`Draft ready, @[Jane Doe](mention:${JANE}) please review`)).toEqual([
      { type: 'text', text: 'Draft ready, ' },
      { type: 'mention', employeeId: JANE, label: 'Jane Doe' },
      { type: 'text', text: ' please review' },
    ])
  })

  it('handles a body that is only mentions', () => {
    expect(parseCommentBody(`@[Jane](mention:${JANE.toUpperCase()})@[Jane Doe](mention:${JANE})`)).toEqual([
      { type: 'mention', employeeId: JANE, label: 'Jane' },
      { type: 'mention', employeeId: JANE, label: 'Jane Doe' },
    ])
  })

  it.each(['A plain @jane is just text', '@[Jane](mention:not-a-uuid)', '[Jane](mention:' + JANE + ')'])(
    'leaves %j as text',
    (body) => {
      expect(parseCommentBody(body)).toEqual([{ type: 'text', text: body }])
    },
  )

  it('returns nothing for an empty body', () => {
    expect(parseCommentBody('')).toEqual([])
  })
})
