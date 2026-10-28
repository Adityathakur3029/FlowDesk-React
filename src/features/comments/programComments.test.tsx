import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { api, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import { ProgramComments } from './components/ProgramComments'
import type { Comment, CommentReply, EmployeeSummary } from './types'

const PROGRAM_ID = '5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14'
const COMMENTS_PATH = `/programs/${PROGRAM_ID}/comments`

const jane: EmployeeSummary = { id: janeDoe.id, name: 'Jane Doe', emailId: janeDoe.emailId }
const ravi: EmployeeSummary = { id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', name: 'Ravi Kumar', emailId: 'ravi.kumar@saajha.org' }

// The contract's Comment example, as a program-level comment.
function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    createdAt: '2026-10-17T10:30:00.000Z',
    updatedAt: '2026-10-17T10:30:00.000Z',
    isActive: true,
    programId: PROGRAM_ID,
    boardId: null,
    taskId: null,
    parentId: null,
    author: ravi,
    body: 'Kick-off notes are in the drive',
    editedAt: null,
    mentions: [],
    replies: [],
    ...overrides,
  }
}

function reply(overrides: Partial<CommentReply> = {}): CommentReply {
  return {
    id: '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f',
    createdAt: '2026-10-17T11:05:00.000Z',
    updatedAt: '2026-10-17T11:05:00.000Z',
    isActive: true,
    programId: PROGRAM_ID,
    boardId: null,
    taskId: null,
    parentId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    author: jane,
    body: 'Looks good, two small notes inline.',
    editedAt: null,
    mentions: [],
    ...overrides,
  }
}

// A deleted top-level comment that still has replies. The generated type says author is never null,
// although the contract says it is on a tombstone (spec 07, contract note 5).
const tombstone = (replies: CommentReply[]): Comment =>
  comment({
    id: '0e1f2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b',
    isActive: false,
    author: null as unknown as Comment['author'],
    body: null,
    replies,
  })

function mockComments(respond: (url: URL) => Response | Comment[]) {
  const queries: string[] = []
  server.use(
    http.get(api(COMMENTS_PATH), ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.search.slice(1))
      const result = respond(url)
      if (result instanceof Response) return result
      return HttpResponse.json({ data: result, meta: { total: result.length, limit: 20, offset: 0 } })
    }),
  )
  return queries
}

function mockPost(respond: () => Response | Promise<Response>) {
  const calls = { bodies: [] as unknown[] }
  server.use(
    http.post(api(COMMENTS_PATH), async ({ request }) => {
      calls.bodies.push(await request.json())
      return respond()
    }),
  )
  return calls
}

const created = (data: Comment) => HttpResponse.json({ data }, { status: 201 })

// GET /employees?q= for the @ list: a case-insensitive name match.
function mockPeople() {
  const people = [janeDoe, { ...janeDoe, ...ravi }]
  server.use(
    http.get(api('/employees'), ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
      const data = people.filter((person) => person.name.toLowerCase().includes(q))
      return HttpResponse.json({ data, meta: { total: data.length, limit: 20, offset: 0 } })
    }),
  )
}

function renderComments() {
  return renderSignedIn('/comments', {
    routes: (
      <Routes>
        <Route path="/comments" element={<ProgramComments programId={PROGRAM_ID} />} />
      </Routes>
    ),
  })
}

const composer = () => screen.getByRole('form', { name: 'Add a comment' })
const thread = (author: string) => screen.getByRole('article', { name: `Comment by ${author}` }).closest('li')!

describe('ProgramComments', () => {
  it('lists threads newest first with their replies, mentions and edits', async () => {
    const queries = mockComments(() => [
      comment({
        body: `Draft ready, @[Jane](mention:${jane.id}) please review`,
        mentions: [jane],
        editedAt: '2026-10-17T10:45:00.000Z',
        replies: [reply()],
      }),
    ])
    renderComments()

    const ravisThread = within(await screen.findByRole('article', { name: 'Comment by Ravi Kumar' }))
    // The mention shows the person's current name, not the token's label.
    expect(ravisThread.getByText('@Jane Doe')).toBeInTheDocument()
    expect(ravisThread.getByText('@Jane Doe').parentElement).toHaveTextContent('Draft ready, @Jane Doe please review')
    expect(ravisThread.getByText('(edited)')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Reply by Jane Doe' })).toHaveTextContent('Looks good, two small notes inline.')
    expect(queries).toEqual(['order=desc&limit=20&offset=0'])
  })

  it('shows a deleted comment with its replies and no Reply button', async () => {
    mockComments(() => [tombstone([reply({ parentId: '0e1f2a3b-4c5d-4e6f-8a7b-9c0d1e2f3a4b' })])])
    renderComments()

    const deleted = await screen.findByRole('article', { name: 'Deleted comment' })
    expect(deleted).toHaveTextContent('This comment was deleted.')
    expect(screen.getByRole('article', { name: 'Reply by Jane Doe' })).toBeInTheDocument()
    expect(within(deleted.closest('li')!).queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    mockComments(() => [])
    renderComments()
    expect(await screen.findByText('No comments yet')).toBeInTheDocument()
    expect(composer()).toBeInTheDocument()
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockComments(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : [comment()]))
    renderComments()

    expect(await screen.findByText("Couldn't load comments")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('article', { name: 'Comment by Ravi Kumar' })).toBeInTheDocument()
  })

  it('loads older threads', async () => {
    const firstPage = Array.from({ length: 20 }, (_, i) => comment({ id: `newer-${i}`, body: `Newer ${i}` }))
    const queries = mockComments((url) =>
      url.searchParams.get('offset') === '20'
        ? HttpResponse.json({ data: [comment({ id: 'oldest', author: jane, body: 'Oldest' })], meta: { total: 21, limit: 20, offset: 20 } })
        : HttpResponse.json({ data: firstPage, meta: { total: 21, limit: 20, offset: 0 } }),
    )
    renderComments()

    await userEvent.click(await screen.findByRole('button', { name: 'Show older comments' }))
    expect(await screen.findByText('Oldest')).toBeInTheDocument()
    expect(screen.getByText('Newer 0')).toBeInTheDocument()
    expect(queries).toEqual(['order=desc&limit=20&offset=0', 'order=desc&limit=20&offset=20'])
    expect(screen.queryByRole('button', { name: 'Show older comments' })).not.toBeInTheDocument()
  })

  it('posts a comment, clears the box and refetches the threads', async () => {
    const queries = mockComments(() => [])
    const calls = mockPost(() => created(comment({ author: jane, body: 'Hello team' })))
    renderComments()
    await screen.findByText('No comments yet')

    await userEvent.type(within(composer()).getByLabelText('Comment'), '  Hello team  ')
    await userEvent.click(within(composer()).getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByText('Comment added')).toBeInTheDocument()
    expect(calls.bodies).toEqual([{ body: 'Hello team' }])
    expect(within(composer()).getByLabelText('Comment')).toHaveValue('')
    await waitFor(() => expect(queries).toHaveLength(2))
  })

  it('posts with Ctrl+Enter', async () => {
    mockComments(() => [])
    const calls = mockPost(() => created(comment({ author: jane, body: 'Quick one' })))
    renderComments()
    await screen.findByText('No comments yet')

    await userEvent.type(within(composer()).getByLabelText('Comment'), 'Quick one{Control>}{Enter}{/Control}')
    await waitFor(() => expect(calls.bodies).toEqual([{ body: 'Quick one' }]))
  })

  it("doesn't post a blank comment", async () => {
    mockComments(() => [])
    const calls = mockPost(() => created(comment()))
    renderComments()
    await screen.findByText('No comments yet')

    await userEvent.type(within(composer()).getByLabelText('Comment'), '   ')
    await userEvent.click(within(composer()).getByRole('button', { name: 'Post comment' }))

    expect(await within(composer()).findByText('Write something first.')).toBeInTheDocument()
    expect(calls.bodies).toEqual([])
  })

  it('replies to a thread', async () => {
    mockComments(() => [comment()])
    const calls = mockPost(() => created(comment({ id: 'r1', parentId: comment().id, author: jane, body: 'On it' })))
    renderComments()
    await screen.findByRole('article', { name: 'Comment by Ravi Kumar' })

    await userEvent.click(within(thread('Ravi Kumar')).getByRole('button', { name: 'Reply' }))
    const form = within(thread('Ravi Kumar')).getByRole('form', { name: 'Reply' })
    expect(within(form).getByLabelText('Reply')).toHaveFocus()
    await userEvent.type(within(form).getByLabelText('Reply'), 'On it')
    await userEvent.click(within(form).getByRole('button', { name: 'Post reply' }))

    expect(await screen.findByText('Reply added')).toBeInTheDocument()
    expect(calls.bodies).toEqual([{ body: 'On it', parentId: comment().id }])
    expect(within(thread('Ravi Kumar')).queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument()
  })

  it('cancels a reply', async () => {
    mockComments(() => [comment()])
    renderComments()
    await screen.findByRole('article', { name: 'Comment by Ravi Kumar' })

    await userEvent.click(within(thread('Ravi Kumar')).getByRole('button', { name: 'Reply' }))
    await userEvent.click(within(thread('Ravi Kumar')).getByRole('button', { name: 'Cancel' }))
    expect(within(thread('Ravi Kumar')).queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument()
    expect(within(thread('Ravi Kumar')).getByRole('button', { name: 'Reply' })).toBeInTheDocument()
  })

  it('says so and refetches when the parent was deleted (PARENT_COMMENT_NOT_FOUND)', async () => {
    const queries = mockComments(() => [comment()])
    mockPost(() =>
      HttpResponse.json({ error: 'Parent comment not found', code: 'PARENT_COMMENT_NOT_FOUND' }, { status: 400 }),
    )
    renderComments()
    await screen.findByRole('article', { name: 'Comment by Ravi Kumar' })

    await userEvent.click(within(thread('Ravi Kumar')).getByRole('button', { name: 'Reply' }))
    const form = within(thread('Ravi Kumar')).getByRole('form', { name: 'Reply' })
    await userEvent.type(within(form).getByLabelText('Reply'), 'On it')
    await userEvent.click(within(form).getByRole('button', { name: 'Post reply' }))

    const message = "The comment you're replying to no longer exists."
    expect(await within(form).findByRole('alert')).toHaveTextContent(message)
    // The toast says it too, in case the refetch removes the thread.
    expect(screen.getAllByText(message)).toHaveLength(2)
    await waitFor(() => expect(queries).toHaveLength(2))
  })

  it.each([
    ['a field', { error: 'Validation failed', details: [{ path: 'body', message: 'Body is too long' }] }, 'Body is too long'],
    [
      'the form (coded 400)',
      { error: 'Mentioned employee 1234 not found or inactive', code: 'MENTION_NOT_FOUND' },
      'Mentioned employee 1234 not found or inactive',
    ],
  ])('shows a 400 on %s', async (where, response, text) => {
    mockComments(() => [])
    mockPost(() => HttpResponse.json(response, { status: 400 }))
    renderComments()
    await screen.findByText('No comments yet')

    const box = within(composer()).getByLabelText('Comment')
    await userEvent.type(box, 'Hello')
    await userEvent.click(within(composer()).getByRole('button', { name: 'Post comment' }))

    expect(await within(composer()).findByText(text)).toBeInTheDocument()
    if (where === 'a field') expect(box).toHaveAttribute('aria-invalid', 'true')
    else expect(within(composer()).getByRole('alert')).toHaveTextContent(text)
    await waitFor(() => expect(box).toHaveFocus())
    expect(box).toHaveValue('Hello')
  })

  it('disables the box while posting', async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    mockComments(() => [])
    mockPost(async () => {
      await held
      return created(comment({ author: jane, body: 'Hello' }))
    })
    renderComments()
    await screen.findByText('No comments yet')

    await userEvent.type(within(composer()).getByLabelText('Comment'), 'Hello')
    await userEvent.click(within(composer()).getByRole('button', { name: 'Post comment' }))

    expect(await within(composer()).findByRole('button', { name: 'Posting…' })).toBeDisabled()
    expect(within(composer()).getByLabelText('Comment')).toBeDisabled()
    release()
    expect(await screen.findByText('Comment added')).toBeInTheDocument()
  })

  it('mentions someone picked from the @ list and posts the mention token', async () => {
    mockComments(() => [])
    mockPeople()
    const calls = mockPost(() => created(comment({ author: jane, body: 'Thanks' })))
    renderComments()
    await screen.findByText('No comments yet')

    const box = within(composer()).getByLabelText('Comment')
    await userEvent.type(box, 'Thanks @ja')
    const option = await screen.findByRole('option', { name: /Jane Doe/ })
    expect(option).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('option', { name: /Ravi Kumar/ })).not.toBeInTheDocument()

    await userEvent.keyboard('{Enter}')
    expect(box).toHaveValue('Thanks @Jane Doe ')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await userEvent.type(box, 'please review')
    expect(within(composer()).getByRole('list', { name: 'Mentioning' })).toHaveTextContent('@Jane Doe')
    await userEvent.click(within(composer()).getByRole('button', { name: 'Post comment' }))

    await waitFor(() => expect(calls.bodies).toEqual([{ body: `Thanks @[Jane Doe](mention:${jane.id}) please review` }]))
  })

  it('closes the @ list on Escape and keeps a name that was typed, not picked, as text', async () => {
    mockComments(() => [])
    mockPeople()
    const calls = mockPost(() => created(comment({ author: jane, body: 'x' })))
    renderComments()
    await screen.findByText('No comments yet')

    const box = within(composer()).getByLabelText('Comment')
    await userEvent.type(box, '@zz')
    expect(await within(composer()).findByText('No one matches “zz”.')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(within(composer()).queryByText('No one matches “zz”.')).not.toBeInTheDocument()

    await userEvent.clear(box)
    await userEvent.type(box, 'Ask @Ravi Kumar{Escape}')
    await userEvent.click(within(composer()).getByRole('button', { name: 'Post comment' }))
    await waitFor(() => expect(calls.bodies).toEqual([{ body: 'Ask @Ravi Kumar' }]))
  })
})

describe('Editing and deleting comments', () => {
  const COMMENT_PATH = `${COMMENTS_PATH}/:commentId`

  function mockPatch(respond: () => Response = () => HttpResponse.json({ data: comment() })) {
    const calls = { ids: [] as string[], bodies: [] as unknown[] }
    server.use(
      http.patch(api(COMMENT_PATH), async ({ request, params }) => {
        calls.ids.push(String(params.commentId))
        calls.bodies.push(await request.json())
        return respond()
      }),
    )
    return calls
  }

  function mockDelete(respond: () => Response = () => new HttpResponse(null, { status: 204 })) {
    const ids: string[] = []
    server.use(
      http.delete(api(COMMENT_PATH), ({ params }) => {
        ids.push(String(params.commentId))
        return respond()
      }),
    )
    return ids
  }

  const article = (name: string) => screen.getByRole('article', { name })

  it("edits the author's own comment and keeps its mention", async () => {
    mockComments(() => [comment({ author: jane, body: `Hi @[Ravi](mention:${ravi.id}) see this`, mentions: [ravi] })])
    const calls = mockPatch()
    renderComments()

    await userEvent.click(within(await screen.findByRole('article', { name: 'Comment by Jane Doe' })).getByRole('button', { name: 'Edit' }))
    const form = screen.getByRole('form', { name: 'Edit comment' })
    const box = within(form).getByRole('textbox', { name: 'Comment' })
    expect(box).toHaveValue('Hi @Ravi Kumar see this')
    expect(box).toHaveFocus()
    expect(within(form).getByText('@Ravi Kumar', { selector: 'li' })).toBeInTheDocument()

    await userEvent.type(box, ' now')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Comment updated')).toBeInTheDocument()
    expect(calls.ids).toEqual(['2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d'])
    expect(calls.bodies).toEqual([{ body: `Hi @[Ravi Kumar](mention:${ravi.id}) see this now` }])
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit comment' })).not.toBeInTheDocument())
    await waitFor(() => expect(within(article('Comment by Jane Doe')).getByRole('button', { name: 'Edit' })).toHaveFocus())
  })

  it('discards an edit on Escape', async () => {
    mockComments(() => [comment({ author: jane, body: 'Original' })])
    const calls = mockPatch()
    renderComments()

    await userEvent.click(within(await screen.findByRole('article', { name: 'Comment by Jane Doe' })).getByRole('button', { name: 'Edit' }))
    await userEvent.type(within(screen.getByRole('form', { name: 'Edit comment' })).getByRole('textbox'), ' changed{Escape}')

    expect(screen.queryByRole('form', { name: 'Edit comment' })).not.toBeInTheDocument()
    expect(article('Comment by Jane Doe')).toHaveTextContent('Original')
    expect(calls.bodies).toEqual([])
  })

  it('edits a reply and shows a 403 in the form', async () => {
    mockComments(() => [comment({ replies: [reply()] })])
    mockPatch(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    renderComments()

    await userEvent.click(within(await screen.findByRole('article', { name: 'Reply by Jane Doe' })).getByRole('button', { name: 'Edit' }))
    const form = screen.getByRole('form', { name: 'Edit reply' })
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent("You don't have permission to do that.")
  })

  it('offers Edit only to the author, and Delete to the author, ADMIN and MANAGER', async () => {
    mockComments(() => [comment({ replies: [reply()] })])
    renderSignedIn('/comments', {
      role: 'MEMBER',
      routes: (
        <Routes>
          <Route path="/comments" element={<ProgramComments programId={PROGRAM_ID} />} />
        </Routes>
      ),
    })

    // Ravi's comment: neither for a MEMBER who isn't its author.
    const ravis = within(await screen.findByRole('article', { name: 'Comment by Ravi Kumar' }))
    expect(ravis.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(ravis.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    // Jane's own reply: both.
    const janes = within(article('Reply by Jane Doe'))
    expect(janes.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(janes.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it("lets a MANAGER delete someone else's comment, but not edit it", async () => {
    mockComments(() => [comment()])
    renderComments()

    const ravis = within(await screen.findByRole('article', { name: 'Comment by Ravi Kumar' }))
    expect(ravis.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(ravis.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('deletes a comment after confirming, and the list refetches', async () => {
    let deleted = false
    const queries = mockComments(() => (deleted ? [] : [comment({ author: jane })]))
    const ids = mockDelete(() => {
      deleted = true
      return new HttpResponse(null, { status: 204 })
    })
    renderComments()

    await userEvent.click(within(await screen.findByRole('article', { name: 'Comment by Jane Doe' })).getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this comment?' })
    expect(dialog).toHaveTextContent("This can't be undone.")
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete comment' }))

    expect(await screen.findByText('Comment deleted')).toBeInTheDocument()
    expect(await screen.findByText('No comments yet')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(ids).toEqual(['2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d'])
    expect(queries).toHaveLength(2)
  })

  it('says the replies stay when deleting a comment that has some, and shows a 403 in the dialog', async () => {
    mockComments(() => [comment({ replies: [reply()] })])
    mockDelete(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    renderComments()

    await userEvent.click(within(await screen.findByRole('article', { name: 'Comment by Ravi Kumar' })).getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this comment?' })
    expect(dialog).toHaveTextContent('Its replies stay, under “This comment was deleted.”')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete comment' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("You don't have permission to do that.")
  })
})
