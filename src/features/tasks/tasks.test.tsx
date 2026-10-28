import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Employee } from '@/features/employees'
import { api, currentUrl, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import { TaskListSection } from './components/TaskListSection'
import type { Task } from './types'

const PROGRAM_ID = '5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14'
const TASKS_PATH = `/programs/${PROGRAM_ID}/tasks`

const ravi: Employee = {
  ...janeDoe,
  id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
  emailId: 'ravi.kumar@saajha.org',
  name: 'Ravi Kumar',
  role: 'MEMBER',
}
const summary = ({ id, name, emailId }: Employee) => ({ id, name, emailId })

// The contract's Task example, plus a second, unassigned one.
const draft: Task = {
  id: '7d2e9b40-1c3a-4e5f-8a6b-9c0d1e2f3a4b',
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedAt: '2026-10-17T10:00:00.000Z',
  isActive: true,
  programId: PROGRAM_ID,
  boardId: null,
  parent: { type: 'PROGRAM', id: PROGRAM_ID, key: 'MKT', name: 'Marketing Research', isActive: true },
  key: 'MKT-13',
  number: 13,
  title: 'Draft survey questions',
  description: 'Cover pricing, channels and brand recall.',
  type: 'PRE',
  status: 'DISCUSSION',
  priority: 'HIGHEST',
  assignee: summary(janeDoe),
  reporter: summary(ravi),
  startDate: '2026-10-20',
  dueDate: '2026-10-31',
  estimateMinutes: 480,
  labels: ['survey', 'q4', 'pricing', 'brand', 'research'],
  completedAt: null,
  isDependent: false,
}
const venue: Task = {
  ...draft,
  id: '0e6c1f2a-4b8d-4c3e-9f7a-1d2b3c4d5e6f',
  key: 'MKT-12',
  number: 12,
  title: 'Book the venue',
  type: 'TASK',
  status: 'IN_PROGRESS',
  priority: 'MEDIUM',
  // Unassigned; the generated type doesn't allow null (spec 08, contract note 1).
  assignee: null as unknown as Task['assignee'],
  dueDate: null,
  labels: [],
}

function mockTasks(respond: (url: URL) => Response | Task[]) {
  const queries: string[] = []
  server.use(
    http.get(api(TASKS_PATH), ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.search.slice(1))
      const result = respond(url)
      if (result instanceof Response) return result
      return HttpResponse.json({ data: result, meta: { total: result.length, limit: 20, offset: 0 } })
    }),
  )
  return queries
}

function mockCreate(respond: () => Response | Promise<Response>) {
  const calls = { bodies: [] as unknown[] }
  server.use(
    http.post(api(TASKS_PATH), async ({ request }) => {
      calls.bodies.push(await request.json())
      return respond()
    }),
  )
  return calls
}

function mockPeople(people: Employee[]) {
  server.use(
    http.get(api('/employees'), ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
      const data = people.filter((person) => person.name.toLowerCase().includes(q))
      return HttpResponse.json({ data, meta: { total: data.length, limit: 20, offset: 0 } })
    }),
  )
}

const created = (task: Task) => HttpResponse.json({ data: task }, { status: 201 })

function renderTasks(path = '/p') {
  return renderSignedIn(path, {
    routes: (
      <Routes>
        <Route
          path="/p"
          element={<TaskListSection parent={{ type: 'PROGRAM', id: PROGRAM_ID }} parentName="Marketing Research" headingHidden />}
        />
      </Routes>
    ),
  })
}

async function openCreateDialog() {
  await userEvent.click((await screen.findAllByRole('button', { name: 'Create task' }))[0])
  return screen.findByRole('dialog', { name: 'Create a task' })
}

const row = (title: string) => screen.getByText(title).closest('tr')!

// The Created tests fake today's date.
afterEach(() => {
  vi.useRealTimers()
})

describe('TaskListSection (program)', () => {
  it('lists tasks with key, labels, type, status, priority and assignee, without a due date', async () => {
    const queries = mockTasks(() => [draft, venue])
    renderTasks()

    expect(await screen.findByText('Draft survey questions')).toBeInTheDocument()
    const first = within(row('Draft survey questions'))
    expect(first.getByText('MKT-13')).toBeInTheDocument()
    expect(first.getByRole('list', { name: 'Labels' })).toHaveTextContent('surveyq4pricing+2')
    expect(first.getByText('Pre')).toBeInTheDocument()
    expect(first.getByText('Discussion')).toBeInTheDocument()
    expect(first.getByText('Highest')).toBeInTheDocument()
    expect(first.getByText('Jane Doe')).toBeInTheDocument()

    const second = within(row('Book the venue'))
    expect(second.getByText('MKT-12')).toBeInTheDocument()
    expect(second.queryByRole('list', { name: 'Labels' })).not.toBeInTheDocument()
    expect(second.getByText('In progress')).toBeInTheDocument()
    expect(second.getByText('Medium')).toBeInTheDocument()
    expect(second.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Due' })).not.toBeInTheDocument()
    expect(queries).toEqual(['limit=20&offset=0'])
  })

  it('shows "No tasks yet" with a create action when the program has none', async () => {
    mockTasks(() => [])
    renderTasks()
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument()
    // One in the toolbar, one in the empty state.
    expect(screen.getAllByRole('button', { name: 'Create task' })).toHaveLength(2)
  })

  it('offers to clear filters that match nothing', async () => {
    mockTasks(() => [])
    renderTasks('/p?q=zzz&status=DONE&created=30d')

    expect(await screen.findByText('No tasks match these filters')).toBeInTheDocument()
    expect(screen.getByLabelText('Search tasks')).toHaveValue('zzz')
    const [, emptyStateButton] = screen.getAllByRole('button', { name: 'Clear filters' })
    await userEvent.click(emptyStateButton)

    await waitFor(() => expect(currentUrl()).toBe('/p'))
    expect(screen.getByLabelText('Search tasks')).toHaveValue('')
  })

  it('filters by status and goes back to the first page', async () => {
    const queries = mockTasks(() => [draft])
    renderTasks('/p?offset=20')
    await screen.findByText('Draft survey questions')

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }))
    await userEvent.click(await screen.findByRole('option', { name: 'In progress' }))

    await waitFor(() => expect(queries.at(-1)).toBe('status=IN_PROGRESS&limit=20&offset=0'))
    expect(currentUrl()).toBe('/p?status=IN_PROGRESS')
  })

  it('searches once typing pauses', async () => {
    const queries = mockTasks(() => [draft])
    renderTasks()
    await screen.findByText('Draft survey questions')

    await userEvent.type(screen.getByLabelText('Search tasks'), 'survey')

    await waitFor(() => expect(queries).toContain('q=survey&limit=20&offset=0'))
    expect(queries.filter((query) => query.startsWith('q='))).toEqual(['q=survey&limit=20&offset=0'])
    expect(currentUrl()).toBe('/p?q=survey')
  })

  it('requests what the URL says', async () => {
    const queries = mockTasks(() =>
      HttpResponse.json({ data: [draft], meta: { total: 21, limit: 20, offset: 20 } }),
    )
    renderTasks('/p?q=draft&status=DISCUSSION&offset=20')

    expect(await screen.findByText('Draft survey questions')).toBeInTheDocument()
    expect(queries).toEqual(['q=draft&status=DISCUSSION&limit=20&offset=20'])
    expect(screen.getByLabelText('Search tasks')).toHaveValue('draft')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Discussion')
  })

  it('pages through the tasks', async () => {
    const queries = mockTasks((url) =>
      url.searchParams.get('offset') === '20'
        ? HttpResponse.json({ data: [venue], meta: { total: 21, limit: 20, offset: 20 } })
        : HttpResponse.json({ data: [draft], meta: { total: 21, limit: 20, offset: 0 } }),
    )
    renderTasks()

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Book the venue')).toBeInTheDocument()
    expect(queries).toEqual(['limit=20&offset=0', 'limit=20&offset=20'])
    expect(currentUrl()).toBe('/p?offset=20')
  })

  it('filters by creation date from the first page, and keeps it when paging', async () => {
    // Today is 28 Oct 2026 in the browser's zone. Only Date is faked; timers stay real for MSW and user-event.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 12))
    const queries = mockTasks((url) => HttpResponse.json({ data: [draft], meta: { total: 21, limit: 20, offset: Number(url.searchParams.get('offset')) } }))
    renderTasks('/p?offset=20')
    await screen.findByText('Draft survey questions')
    expect(screen.getByRole('combobox', { name: 'Created' })).toHaveTextContent('All time')

    await userEvent.click(screen.getByRole('combobox', { name: 'Created' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Last 7 days' }))
    await waitFor(() => expect(queries.at(-1)).toBe('createdFrom=2026-10-22&limit=20&offset=0'))
    expect(currentUrl()).toBe('/p?created=7d')

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(queries.at(-1)).toBe('createdFrom=2026-10-22&limit=20&offset=20'))
    expect(currentUrl()).toBe('/p?created=7d&offset=20')
  })

  it('sends Last 30 days from the URL and ignores an unknown value', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 12))
    const queries = mockTasks(() => [draft])
    renderTasks('/p?created=30d')
    await screen.findByText('Draft survey questions')
    expect(queries).toEqual(['createdFrom=2026-09-29&limit=20&offset=0'])
    expect(screen.getByRole('combobox', { name: 'Created' })).toHaveTextContent('Last 30 days')
  })

  it('ignores ?created=bogus', async () => {
    const queries = mockTasks(() => [draft])
    renderTasks('/p?created=bogus')
    await screen.findByText('Draft survey questions')
    expect(queries).toEqual(['limit=20&offset=0'])
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockTasks(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : [draft]))
    renderTasks()

    expect(await screen.findByText("Couldn't load tasks")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Draft survey questions')).toBeInTheDocument()
  })
})

describe('CreateTaskDialog', () => {
  it('creates a title-only task with the contract defaults', async () => {
    const queries = mockTasks(() => [venue])
    const calls = mockCreate(() => created({ ...draft, title: 'Book catering' }))
    renderTasks()
    await screen.findByText('Book the venue')
    const dialog = await openCreateDialog()

    expect(within(dialog).getByText("Adds a task to Marketing Research. You'll be its reporter.")).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Title'), '  Book catering ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await screen.findByText('Task MKT-13 created')).toBeInTheDocument()
    expect(calls.bodies).toEqual([
      { title: 'Book catering', type: 'TASK', status: 'DISCUSSION', priority: 'MEDIUM', labels: [], dependsOn: [] },
    ])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(queries).toHaveLength(2))
  })

  it('sends every field that is filled in', async () => {
    mockTasks(() => [venue])
    mockPeople([ravi])
    const calls = mockCreate(() => created(draft))
    renderTasks()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft survey questions')
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Type' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Pre' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Status' }))
    await userEvent.click(await screen.findByRole('option', { name: 'In progress' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Priority' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Highest' }))
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Assignee' }), 'rav')
    await userEvent.click(await screen.findByRole('option', { name: /Ravi Kumar/ }))
    await userEvent.type(within(dialog).getByLabelText('Start date (optional)'), '2026-10-20')
    await userEvent.type(within(dialog).getByLabelText('Due date (optional)'), '2026-10-31')
    await userEvent.type(within(dialog).getByLabelText('Estimate in hours (optional)'), '1.5')
    await userEvent.type(within(dialog).getByLabelText('Labels (optional)'), 'Survey, q4')
    expect(within(dialog).getByRole('list', { name: 'Labels to add' })).toHaveTextContent('surveyq4')
    await userEvent.type(within(dialog).getByLabelText('Description (optional)'), 'Cover pricing')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    await screen.findByText('Task MKT-13 created')
    expect(calls.bodies).toEqual([
      {
        title: 'Draft survey questions',
        type: 'PRE',
        status: 'IN_PROGRESS',
        priority: 'HIGHEST',
        labels: ['survey', 'q4'],
        dependsOn: [],
        assigneeId: ravi.id,
        startDate: '2026-10-20',
        dueDate: '2026-10-31',
        estimateMinutes: 90,
        description: 'Cover pricing',
      },
    ])
  })

  it('assigns the task to the signed-in employee, and the search comes back after removing them', async () => {
    mockTasks(() => [venue])
    renderTasks()
    const dialog = await openCreateDialog()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign to me' }))
    expect(within(dialog).getByRole('list', { name: 'Selected assignee' })).toHaveTextContent('Jane Doe')
    expect(within(dialog).queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('combobox', { name: 'Assignee' })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Jane Doe' }))
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Assignee' })).toHaveFocus())
    expect(within(dialog).getByRole('button', { name: 'Assign to me' })).toBeInTheDocument()
  })

  it.each([
    ['a blank title', 'Title', '   ', 'Enter a title.'],
    ['a bad label', 'Labels (optional)', 'ok, bad!label', /^“bad!label” can only use/],
    ['a bad estimate', 'Estimate in hours (optional)', '0', 'Enter hours as a number, up to 8,760 (one year).'],
  ])("doesn't send %s", async (_, field, value, message) => {
    mockTasks(() => [venue])
    const calls = mockCreate(() => created(draft))
    renderTasks()
    const dialog = await openCreateDialog()

    if (field !== 'Title') await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft')
    await userEvent.type(within(dialog).getByLabelText(field), value)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await within(dialog).findByText(message)).toBeInTheDocument()
    expect(calls.bodies).toEqual([])
  })

  it('takes off an assignee who is gone (ASSIGNEE_NOT_FOUND)', async () => {
    mockTasks(() => [venue])
    mockCreate(() =>
      HttpResponse.json({ error: 'Assignee not found or inactive', code: 'ASSIGNEE_NOT_FOUND' }, { status: 400 }),
    )
    renderTasks()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign to me' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await within(dialog).findByText("The assignee doesn't exist or is inactive.")).toBeInTheDocument()
    expect(within(dialog).queryByRole('list', { name: 'Selected assignee' })).not.toBeInTheDocument()
  })

  it('shows INVALID_DATE_RANGE under Due date', async () => {
    mockTasks(() => [venue])
    mockCreate(() =>
      HttpResponse.json({ error: 'dueDate must be on or after startDate', code: 'INVALID_DATE_RANGE' }, { status: 400 }),
    )
    renderTasks()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft')
    await userEvent.type(within(dialog).getByLabelText('Start date (optional)'), '2026-10-31')
    await userEvent.type(within(dialog).getByLabelText('Due date (optional)'), '2026-10-01')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await within(dialog).findByText('The due date must be on or after the start date.')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByLabelText('Due date (optional)')).toHaveFocus())
  })

  it.each([
    ['Labels (optional)', [{ path: 'labels.0', message: 'Invalid label' }], 'Invalid label'],
    ['Estimate in hours (optional)', [{ path: 'estimateMinutes', message: 'Too small' }], 'Too small'],
    ['the alert', [{ path: '', message: 'Unrecognized key: "extra"' }], 'Unrecognized key: "extra"'],
  ])('puts 400 validation details on %s', async (where, details, text) => {
    mockTasks(() => [venue])
    mockCreate(() => HttpResponse.json({ error: 'Validation failed', details }, { status: 400 }))
    renderTasks()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await within(dialog).findByText(text)).toBeInTheDocument()
    if (where === 'the alert') expect(within(dialog).getByRole('alert')).toHaveTextContent(text)
    else expect(within(dialog).getByLabelText(where)).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a 404 (program deleted meanwhile) in the dialog', async () => {
    mockTasks(() => [venue])
    mockCreate(() => HttpResponse.json({ error: 'Program not found' }, { status: 404 }))
    renderTasks()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Program not found')
  })

  it("can't be closed while the request is pending", async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    mockTasks(() => [venue])
    mockCreate(async () => {
      await held
      return created(draft)
    })
    renderTasks()
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    expect(await within(dialog).findByRole('button', { name: 'Creating task…' })).toBeDisabled()
    expect(within(dialog).getByLabelText('Title')).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Create a task' })).toBeInTheDocument()

    release()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('goes back to the first page after creating, keeping the filters', async () => {
    mockTasks(() => HttpResponse.json({ data: [venue], meta: { total: 21, limit: 20, offset: 20 } }))
    mockCreate(() => created(draft))
    renderTasks('/p?status=IN_PROGRESS&offset=20')
    await screen.findByText('Book the venue')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Title'), 'Draft')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create task' }))

    await waitFor(() => expect(currentUrl()).toBe('/p?status=IN_PROGRESS'))
  })
})
