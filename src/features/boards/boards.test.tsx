import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, currentUrl, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Board } from './types'

// The contract's Board example, plus an older one without a description.
const feedback: Board = {
  id: '8c7d6e5f-4a3b-4c2d-9e1f-0a9b8c7d6e5f',
  createdAt: '2026-10-28T09:00:00.000Z',
  updatedAt: '2026-10-28T09:00:00.000Z',
  isActive: true,
  key: 'PRO',
  name: 'Product feedback',
  description: 'Ideas and bugs reported from the field',
}
const ops: Board = {
  ...feedback,
  id: '6b5a4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d',
  createdAt: '2026-10-01T09:00:00.000Z',
  key: 'OPSW',
  name: 'Ops weekly',
  description: null,
}

const createdFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// GET /boards: records each query string and answers with `respond`.
function mockBoards(respond: (url: URL) => Response | Board[] = () => [feedback, ops]) {
  const queries: string[] = []
  server.use(
    http.get(api('/boards'), ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.search.slice(1))
      const result = respond(url)
      if (result instanceof Response) return result
      return HttpResponse.json({ data: result, meta: { total: result.length, limit: 20, offset: 0 } })
    }),
  )
  return queries
}

// POST /boards, and the new board's page the dialog goes to.
function mockCreate(respond: () => Response) {
  const bodies: unknown[] = []
  server.use(
    http.post(api('/boards'), async ({ request }) => {
      bodies.push(await request.json())
      return respond()
    }),
    http.get(api('/boards/:boardId'), () => HttpResponse.json({ data: feedback })),
    http.get(api('/boards/:boardId/tasks'), () => HttpResponse.json({ data: [], meta: { total: 0, limit: 20, offset: 0 } })),
  )
  return bodies
}

async function openBoards(path = '/boards', options: Parameters<typeof renderSignedIn>[1] = {}) {
  renderSignedIn(path, options)
  await screen.findByRole('heading', { level: 1, name: 'Boards' })
}

async function openCreateDialog() {
  await userEvent.click((await screen.findAllByRole('button', { name: 'Create board' }))[0])
  return screen.findByRole('dialog', { name: 'Create a board' })
}

const card = (name: string) => screen.getByRole('link', { name }).closest('li')!

describe('BoardsPage', () => {
  it('shows each board as a card with key, name, description and created date', async () => {
    const queries = mockBoards()
    await openBoards()

    expect(await screen.findByRole('link', { name: 'Product feedback' })).toHaveAttribute('href', `/boards/${feedback.id}`)
    expect(within(screen.getByRole('list', { name: 'Boards' })).getAllByRole('listitem')).toHaveLength(2)
    const first = within(card('Product feedback'))
    expect(first.getByRole('heading', { level: 2, name: 'Product feedback' })).toBeInTheDocument()
    expect(first.getByText('PRO')).toBeInTheDocument()
    expect(first.getByText('Ideas and bugs reported from the field')).toBeInTheDocument()
    expect(first.getByText(createdFormat.format(new Date(feedback.createdAt)))).toHaveAttribute('datetime', feedback.createdAt)
    const second = within(card('Ops weekly'))
    expect(second.getByText('OPSW')).toBeInTheDocument()
    expect(second.getByText('No description')).toBeInTheDocument()
    expect(queries).toEqual(['limit=20&offset=0'])
    expect(screen.getByText('Lightweight lists of tasks, without dates or status.')).toBeInTheDocument()
  })

  it('is in the sidebar, below Programs', async () => {
    mockBoards()
    await openBoards()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Boards' })).toHaveAttribute('aria-current', 'page')
  })

  it('pages through the boards and reads the page from the URL', async () => {
    const queries = mockBoards((url) =>
      url.searchParams.get('offset') === '20'
        ? HttpResponse.json({ data: [ops], meta: { total: 21, limit: 20, offset: 20 } })
        : HttpResponse.json({ data: [feedback], meta: { total: 21, limit: 20, offset: 0 } }),
    )
    await openBoards()

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('link', { name: 'Ops weekly' })).toBeInTheDocument()
    expect(queries).toEqual(['limit=20&offset=0', 'limit=20&offset=20'])
    expect(currentUrl()).toBe('/boards?offset=20')
  })

  it('ignores a bad offset in the URL', async () => {
    const queries = mockBoards()
    await openBoards('/boards?offset=-1')
    await screen.findByRole('link', { name: 'Product feedback' })
    expect(queries).toEqual(['limit=20&offset=0'])
  })

  it('offers Create board on the empty state to a MANAGER', async () => {
    mockBoards(() => [])
    await openBoards('/boards', { role: 'MANAGER' })
    expect(await screen.findByText('No boards yet')).toBeInTheDocument()
    // One in the header, one in the empty state.
    expect(screen.getAllByRole('button', { name: 'Create board' })).toHaveLength(2)
  })

  it('hides Create board from a MEMBER', async () => {
    mockBoards(() => [])
    await openBoards('/boards', { role: 'MEMBER' })
    expect(await screen.findByText('Ask an admin or manager to create one.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create board' })).not.toBeInTheDocument()
  })

  it('offers the first page when the page is past the end', async () => {
    mockBoards(() => HttpResponse.json({ data: [], meta: { total: 3, limit: 20, offset: 40 } }))
    await openBoards('/boards?offset=40')
    expect(await screen.findByText('This page is empty')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to first page' }))
    await waitFor(() => expect(currentUrl()).toBe('/boards'))
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockBoards(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : [feedback]))
    await openBoards()

    expect(await screen.findByText("Couldn't load boards")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: 'Product feedback' })).toBeInTheDocument()
  })
})

describe('CreateBoardDialog', () => {
  it('suggests a key from the name and shows the task key prefix', async () => {
    mockBoards()
    await openBoards()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Ops weekly')
    expect(within(dialog).getByLabelText('Key')).toHaveValue('OW')
    expect(within(dialog).getByText("Task keys will start with OW-. The key can't be changed later.")).toBeInTheDocument()
  })

  it('creates the board, leaving out a blank description, and opens it', async () => {
    mockBoards()
    const bodies = mockCreate(() => HttpResponse.json({ data: feedback }, { status: 201 }))
    await openBoards()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), '  Product feedback ')
    await userEvent.clear(within(dialog).getByLabelText('Key'))
    // Uppercased as it's typed. A program may already use PRO: keys are only unique among boards.
    await userEvent.type(within(dialog).getByLabelText('Key'), 'pro')
    await userEvent.type(within(dialog).getByLabelText('Description (optional)'), '   ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))

    expect(await screen.findByText('Board PRO created')).toBeInTheDocument()
    expect(bodies).toEqual([{ key: 'PRO', name: 'Product feedback' }])
    await waitFor(() => expect(currentUrl()).toBe(`/boards/${feedback.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Product feedback' })).toBeInTheDocument()
  })

  it('sends the description when it is filled in', async () => {
    mockBoards()
    const bodies = mockCreate(() => HttpResponse.json({ data: feedback }, { status: 201 }))
    await openBoards()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Product feedback')
    await userEvent.type(within(dialog).getByLabelText('Description (optional)'), 'Ideas and bugs')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))

    await waitFor(() => expect(bodies).toEqual([{ key: 'PF', name: 'Product feedback', description: 'Ideas and bugs' }]))
  })

  it('shows BOARD_KEY_EXISTS under Key and keeps the dialog open', async () => {
    mockBoards()
    mockCreate(() =>
      HttpResponse.json({ error: 'A board with key PRO already exists', code: 'BOARD_KEY_EXISTS' }, { status: 409 }),
    )
    await openBoards()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Product feedback')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))

    expect(
      await within(dialog).findByText('Another board already uses this key. Keys of deleted boards stay taken too, so pick a different one.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(within(dialog).getByLabelText('Key')).toHaveFocus())
  })

  it('puts 400 details on their fields', async () => {
    mockBoards()
    mockCreate(() =>
      HttpResponse.json(
        { error: 'Validation failed', details: [{ path: 'name', message: 'name must be at most 150 characters' }] },
        { status: 400 },
      ),
    )
    await openBoards()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Product feedback')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))

    expect(await within(dialog).findByText('name must be at most 150 characters')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('checks the key before sending', async () => {
    mockBoards()
    const bodies = mockCreate(() => HttpResponse.json({ data: feedback }, { status: 201 }))
    await openBoards()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Product feedback')
    await userEvent.clear(within(dialog).getByLabelText('Key'))
    await userEvent.type(within(dialog).getByLabelText('Key'), '1A')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))

    expect(await within(dialog).findByText('Use 2–10 letters or digits, starting with a letter.')).toBeInTheDocument()
    expect(bodies).toEqual([])
  })

  it('shows a 403 in the dialog', async () => {
    mockBoards()
    mockCreate(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    await openBoards('/boards', { role: 'ADMIN' })
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Product feedback')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create board' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("You don't have permission to create boards.")
  })
})
