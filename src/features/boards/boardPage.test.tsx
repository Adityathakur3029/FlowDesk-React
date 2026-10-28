import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/features/tasks/types'
import { api, currentUrl, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Board, UpdateBoardRequest } from './types'

const feedback: Board = {
  id: '8c7d6e5f-4a3b-4c2d-9e1f-0a9b8c7d6e5f',
  createdAt: '2026-10-28T09:00:00.000Z',
  updatedAt: '2026-10-28T09:30:00.000Z',
  isActive: true,
  key: 'PRO',
  name: 'Product feedback',
  description: 'Ideas and bugs reported from the field',
}
const BOARD_URL = `/boards/${feedback.id}`
const jane = { id: janeDoe.id, name: janeDoe.name, emailId: janeDoe.emailId }

// A board task: programId null, a BOARD parent, and a global number.
const crash: Task = {
  id: '4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8',
  createdAt: '2026-10-27T10:00:00.000Z',
  updatedAt: '2026-10-27T10:00:00.000Z',
  isActive: true,
  programId: null,
  boardId: feedback.id,
  parent: { type: 'BOARD', id: feedback.id, key: 'PRO', name: 'Product feedback', isActive: true },
  key: 'PRO-50',
  number: 50,
  title: 'App crashes on login',
  description: null,
  type: 'BUG',
  status: 'DISCUSSION',
  priority: 'HIGH',
  assignee: jane,
  reporter: jane,
  startDate: null,
  dueDate: null,
  estimateMinutes: null,
  labels: [],
  completedAt: null,
  isDependent: false,
}

const createdFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

// GET the board and its task list; records each list request as `boardId?query`.
function mockBoard(respondBoard: () => Response | Board = () => feedback, respondTasks: (url: URL) => Response | Task[] = () => [crash]) {
  const lists: string[] = []
  server.use(
    http.get(api('/boards/:boardId'), () => {
      const result = respondBoard()
      return result instanceof Response ? result : HttpResponse.json({ data: result })
    }),
    http.get(api('/boards/:boardId/tasks'), ({ request, params }) => {
      const url = new URL(request.url)
      lists.push(`${String(params.boardId)}?${url.search.slice(1)}`)
      const result = respondTasks(url)
      if (result instanceof Response) return result
      return HttpResponse.json({ data: result, meta: { total: result.length, limit: 20, offset: 0 } })
    }),
  )
  return lists
}

// PATCH /boards/{boardId}: answers with the board merged with the body, or a given response.
function mockPatch(respond?: () => Response) {
  const bodies: UpdateBoardRequest[] = []
  server.use(
    http.patch(api('/boards/:boardId'), async ({ request }) => {
      const body = (await request.json()) as UpdateBoardRequest
      bodies.push(body)
      return respond ? respond() : HttpResponse.json({ data: { ...feedback, ...body } })
    }),
  )
  return bodies
}

async function openBoard(options: Parameters<typeof renderSignedIn>[1] = {}, path = BOARD_URL) {
  renderSignedIn(path, options)
  await screen.findByRole('heading', { level: 1, name: 'Product feedback' })
}

const details = () => within(screen.getByRole('complementary', { name: 'Board details' }))
const detail = (label: string) => details().getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement

afterEach(() => {
  vi.useRealTimers()
})

describe('BoardPage', () => {
  it('shows the board, its details and its tasks', async () => {
    const lists = mockBoard()
    await openBoard()

    expect(screen.getByText('Ideas and bugs reported from the field')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Boards' })).toHaveAttribute('href', '/boards')
    expect(detail('Key')).toHaveTextContent('PRO')
    expect(detail('Created')).toHaveTextContent(createdFormat.format(new Date(feedback.createdAt)))
    expect(screen.getByRole('heading', { level: 2, name: 'Tasks' })).toBeVisible()

    expect(await screen.findByRole('link', { name: 'App crashes on login' })).toHaveAttribute('href', '/tasks/PRO-50')
    expect(screen.getByText('PRO-50')).toBeInTheDocument()
    expect(lists).toEqual([`${feedback.id}?limit=20&offset=0`])
  })

  it('filters tasks by creation date and keeps the filter when paging', async () => {
    // Today is 28 Oct 2026 in the browser's zone. Only Date is faked; timers stay real for MSW and user-event.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 12))
    const lists = mockBoard(undefined, (url) =>
      HttpResponse.json({ data: [crash], meta: { total: 43, limit: 20, offset: Number(url.searchParams.get('offset')) } }),
    )
    await openBoard()
    await screen.findByRole('link', { name: 'App crashes on login' })

    await userEvent.click(screen.getByRole('combobox', { name: 'Created' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Last 7 days' }))
    await waitFor(() => expect(lists.at(-1)).toBe(`${feedback.id}?createdFrom=2026-10-22&limit=20&offset=0`))
    expect(currentUrl()).toBe(`${BOARD_URL}?created=7d`)

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(lists.at(-1)).toBe(`${feedback.id}?createdFrom=2026-10-22&limit=20&offset=20`))
    expect(currentUrl()).toBe(`${BOARD_URL}?created=7d&offset=20`)
  })

  it('ignores ?created=bogus', async () => {
    const lists = mockBoard()
    await openBoard({}, `${BOARD_URL}?created=bogus`)
    await screen.findByRole('link', { name: 'App crashes on login' })
    expect(lists).toEqual([`${feedback.id}?limit=20&offset=0`])
  })

  it('invites the first task on an empty board, for any role', async () => {
    mockBoard(undefined, () => [])
    await openBoard({ role: 'MEMBER' })
    expect(await screen.findByText('Add the first task to this board.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Create task' })).toHaveLength(2)
  })

  it('creates a task on the board and refetches the list', async () => {
    const lists = mockBoard()
    const bodies: unknown[] = []
    server.use(
      http.post(api('/boards/:boardId/tasks'), async ({ request, params }) => {
        bodies.push({ boardId: params.boardId, body: await request.json() })
        return HttpResponse.json({ data: { ...crash, key: 'PRO-51', number: 51, title: 'Dark mode' } }, { status: 201 })
      }),
    )
    await openBoard({ role: 'MEMBER' })
    await screen.findByRole('link', { name: 'App crashes on login' })

    await userEvent.click(screen.getByRole('button', { name: 'Create task' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create a task' })
    expect(within(dialog).getByText("Adds a task to Product feedback. You'll be its reporter.")).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Dark mode')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await screen.findByText('Task PRO-51 created')).toBeInTheDocument()
    expect(bodies).toEqual([
      {
        boardId: feedback.id,
        body: { title: 'Dark mode', type: 'TASK', status: 'DISCUSSION', priority: 'MEDIUM', labels: [], dependsOn: [] },
      },
    ])
    await waitFor(() => expect(lists).toHaveLength(2))
  })

  it('shows "Board not found" on a 404', async () => {
    mockBoard(() => HttpResponse.json({ error: 'Board not found' }, { status: 404 }))
    renderSignedIn(BOARD_URL)
    expect(await screen.findByText('Board not found')).toBeInTheDocument()
  })

  it('shows "Board not found" for an id that isn\'t a UUID (400)', async () => {
    mockBoard(() => HttpResponse.json({ error: 'Validation failed', details: [{ path: 'boardId', message: 'Invalid uuid' }] }, { status: 400 }))
    renderSignedIn('/boards/not-a-uuid')
    expect(await screen.findByText('Board not found')).toBeInTheDocument()
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockBoard(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : feedback))
    renderSignedIn(BOARD_URL)

    expect(await screen.findByText("Couldn't load the board")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Product feedback' })).toBeInTheDocument()
  })
})

describe('BoardPage editing', () => {
  it('renames the board in place as a MANAGER', async () => {
    mockBoard()
    const bodies = mockPatch()
    await openBoard({ role: 'MANAGER' })

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = screen.getByRole('textbox', { name: 'Name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Field feedback{Enter}')

    expect(await screen.findByText('Name updated')).toBeInTheDocument()
    expect(bodies).toEqual([{ name: 'Field feedback' }])
    expect(await screen.findByRole('heading', { level: 1, name: 'Field feedback' })).toBeInTheDocument()
  })

  it('clears the description, sending null', async () => {
    mockBoard()
    const bodies = mockPatch()
    await openBoard({ role: 'ADMIN' })

    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Description updated')).toBeInTheDocument()
    expect(bodies).toEqual([{ description: null }])
    expect(await screen.findByText('No description.')).toBeInTheDocument()
  })

  it('closes without a request when nothing changed', async () => {
    mockBoard()
    const bodies = mockPatch()
    await openBoard({ role: 'MANAGER' })

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), '{Enter}')

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit name' })).not.toBeInTheDocument())
    expect(bodies).toEqual([])
  })

  it('shows a 403 in the editor and keeps the text', async () => {
    mockBoard()
    mockPatch(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    await openBoard({ role: 'MANAGER' })

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' 2{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have permission to edit boards.")
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Product feedback 2')
  })

  it('shows "Board not found" when the board was deleted meanwhile', async () => {
    let deleted = false
    mockBoard(() => (deleted ? HttpResponse.json({ error: 'Board not found' }, { status: 404 }) : feedback))
    mockPatch(() => {
      deleted = true
      return HttpResponse.json({ error: 'Board not found' }, { status: 404 })
    })
    await openBoard({ role: 'MANAGER' })

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' 2{Enter}')

    expect(await screen.findByText('This board has been deleted.')).toBeInTheDocument()
    expect(await screen.findByText('Board not found')).toBeInTheDocument()
  })

  it("doesn't offer editing or delete to a MEMBER", async () => {
    mockBoard()
    await openBoard({ role: 'MEMBER' })

    expect(screen.queryByRole('button', { name: 'Edit name' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit description' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete board Product feedback' })).not.toBeInTheDocument()
  })

  it('offers delete to an ADMIN only', async () => {
    mockBoard()
    await openBoard({ role: 'MANAGER' })
    expect(screen.queryByRole('button', { name: 'Delete board Product feedback' })).not.toBeInTheDocument()
  })
})

describe('BoardPage delete', () => {
  function mockDelete(respond: () => Response = () => new HttpResponse(null, { status: 204 })) {
    const calls: string[] = []
    server.use(
      http.delete(api('/boards/:boardId'), ({ params }) => {
        calls.push(String(params.boardId))
        return respond()
      }),
      // The Boards page the user lands on.
      http.get(api('/boards'), () => HttpResponse.json({ data: [], meta: { total: 0, limit: 20, offset: 0 } })),
    )
    return calls
  }

  it('deletes the board as an ADMIN after confirming and goes to Boards', async () => {
    mockBoard()
    const calls = mockDelete()
    await openBoard({ role: 'ADMIN' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete board Product feedback' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Product feedback?' })
    // Only the board is hidden (contract): its tasks stay live.
    expect(dialog).toHaveTextContent('Its tasks stay open at their own links')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete board' }))

    expect(await screen.findByText('Product feedback deleted')).toBeInTheDocument()
    await waitFor(() => expect(currentUrl()).toBe('/boards'))
    expect(calls).toEqual([feedback.id])
  })

  it('keeps the dialog open with the error on a 403', async () => {
    mockBoard()
    mockDelete(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    await openBoard({ role: 'ADMIN' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete board Product feedback' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Product feedback?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete board' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("You don't have permission to do that.")
    expect(currentUrl()).toBe(BOARD_URL)
  })

  it('goes to Boards when someone else deleted it first (404)', async () => {
    mockBoard()
    mockDelete(() => HttpResponse.json({ error: 'Board not found' }, { status: 404 }))
    await openBoard({ role: 'ADMIN' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete board Product feedback' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete board' }))

    expect(await screen.findByText('This board has already been deleted.')).toBeInTheDocument()
    await waitFor(() => expect(currentUrl()).toBe('/boards'))
  })
})
