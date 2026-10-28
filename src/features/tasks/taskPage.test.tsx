import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { Board } from '@/features/boards/types'
import type { Comment } from '@/features/comments/types'
import type { Program } from '@/features/programs/types'
import { calendarDateFormat } from '@/lib/dates'
import { api, currentUrl, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { EmployeeSummary, TaskDetail, TaskSummary, UpdateTaskRequest } from './types'

// The contract's Program and TaskDetail examples.
const marketing: Program = {
  id: '5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14',
  createdAt: '2026-10-17T09:30:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
  isActive: true,
  key: 'MKT',
  name: 'Marketing Research',
  description: null,
  status: 'ACTIVE',
  startDate: null,
  endDate: null,
  ownerTeamId: '3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23',
  completedAt: null,
  cancelledAt: null,
}
const jane: EmployeeSummary = { id: janeDoe.id, name: janeDoe.name, emailId: janeDoe.emailId }
const ravi: EmployeeSummary = { id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', name: 'Ravi Kumar', emailId: 'ravi.kumar@saajha.org' }

const draft: TaskDetail = {
  id: '7d2e9b40-1c3a-4e5f-8a6b-9c0d1e2f3a4b',
  createdAt: '2026-10-17T10:00:00.000Z',
  updatedAt: '2026-10-18T10:00:00.000Z',
  isActive: true,
  programId: marketing.id,
  boardId: null,
  parent: { type: 'PROGRAM', id: marketing.id, key: 'MKT', name: 'Marketing Research', isActive: true },
  key: 'MKT-7',
  number: 7,
  title: 'Draft survey questions',
  description: 'Cover pricing, channels and brand recall.',
  type: 'PRE',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  assignee: jane,
  reporter: ravi,
  startDate: '2026-10-20',
  dueDate: '2026-10-31',
  estimateMinutes: 480,
  labels: ['survey', 'q4'],
  completedAt: null,
  isDependent: true,
  dependsOn: [{ id: '0e6c1f2a-4b8d-4c3e-9f7a-1d2b3c4d5e6f', key: 'MKT-3', title: 'Finalise sample', status: 'DONE' }],
  blocks: [{ id: '3f4a5b6c-7d8e-4f90-a1b2-c3d4e5f6a7b8', key: 'MKT-9', title: 'Run survey', status: 'DEPENDENT' }],
}
const TASK_URL = '/tasks/MKT-7'
const PROGRAM_URL = `/programs/${marketing.id}`

const emptyPage = { data: [], meta: { total: 0, limit: 20, offset: 0 } }

// GET the task (by whatever ref the URL has) and its comments, and the program page for tests that land there.
function mockTask(respond: () => Response | TaskDetail = () => draft) {
  const calls = { refs: [] as string[], comments: [] as string[] }
  server.use(
    http.get(api('/tasks/:taskRef'), ({ params }) => {
      calls.refs.push(String(params.taskRef))
      const result = respond()
      return result instanceof Response ? result : HttpResponse.json({ data: result })
    }),
    http.get(api('/programs/:programId'), () => HttpResponse.json({ data: marketing })),
    http.get(api('/tasks/:taskRef/comments'), ({ request, params }) => {
      calls.comments.push(`${String(params.taskRef)}?${new URL(request.url).search.slice(1)}`)
      return HttpResponse.json(emptyPage)
    }),
  )
  return calls
}

// PATCH /tasks/{taskRef}: answers with the task merged with the body, or a given error.
function mockPatch(respond?: (body: UpdateTaskRequest) => Response | TaskDetail) {
  const bodies: UpdateTaskRequest[] = []
  const people: Record<string, EmployeeSummary> = { [jane.id]: jane, [ravi.id]: ravi }
  server.use(
    http.patch(api('/tasks/:taskRef'), async ({ request }) => {
      const body = (await request.json()) as UpdateTaskRequest
      bodies.push(body)
      const { assigneeId, ...rest } = body
      const merged: TaskDetail = {
        ...draft,
        ...rest,
        ...(assigneeId !== undefined && { assignee: (assigneeId === null ? null : people[assigneeId]) as TaskDetail['assignee'] }),
      }
      const result = respond ? respond(body) : merged
      return result instanceof Response ? result : HttpResponse.json({ data: result })
    }),
  )
  return bodies
}

const details = () => within(screen.getByRole('complementary', { name: 'Task details' }))

function detail(label: string) {
  const term = details().getByText(label, { selector: 'dt' })
  return term.nextElementSibling as HTMLElement
}

async function openTask(options: Parameters<typeof renderSignedIn>[1] = {}) {
  renderSignedIn(TASK_URL, options)
  await screen.findByRole('heading', { level: 1, name: 'Draft survey questions' })
}

describe('TaskPage', () => {
  it('shows the task, its details, dependencies and comments', async () => {
    const calls = mockTask()
    await openTask()

    expect(screen.getByText('MKT-7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Status: In progress. Change status' })).toBeInTheDocument()
    expect(screen.getByText('Cover pricing, channels and brand recall.')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Marketing Research' })).toHaveAttribute('href', PROGRAM_URL)

    expect(detail('Assignee')).toHaveTextContent('Jane Doe')
    expect(detail('Reporter')).toHaveTextContent('Ravi Kumar')
    expect(detail('Type')).toHaveTextContent('Pre')
    expect(detail('Priority')).toHaveTextContent('High')
    expect(detail('Start date')).toHaveTextContent(calendarDateFormat.format(new Date('2026-10-20')))
    expect(detail('Due date')).toHaveTextContent(calendarDateFormat.format(new Date('2026-10-31')))
    expect(detail('Estimate')).toHaveTextContent('8 h')
    expect(detail('Labels')).toHaveTextContent('surveyq4')
    expect(details().queryByText('Completed', { selector: 'dt' })).not.toBeInTheDocument()

    const blockedBy = screen.getByRole('list', { name: 'Blocked by' })
    expect(within(blockedBy).getByRole('link', { name: 'MKT-3 Finalise sample' })).toHaveAttribute(
      'href',
      '/tasks/MKT-3',
    )
    expect(within(blockedBy).getByText('Done')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Blocks' })).getByText('Dependent')).toBeInTheDocument()

    // Comments are the task's own, by id, newest first.
    expect(await screen.findByText('No comments yet')).toBeInTheDocument()
    expect(calls.comments).toEqual([`${draft.id}?order=desc&limit=20&offset=0`])
    expect(calls.refs).toEqual(['MKT-7'])
  })

  it('opens from the Tasks tab', async () => {
    mockTask()
    server.use(
      http.get(api('/programs/:programId/tasks'), () => HttpResponse.json({ data: [draft], meta: { total: 1, limit: 20, offset: 0 } })),
      http.get(api('/programs/:programId/comments'), () => HttpResponse.json(emptyPage)),
    )
    renderSignedIn(PROGRAM_URL)

    await userEvent.click(await screen.findByRole('link', { name: 'Draft survey questions' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Draft survey questions' })).toBeInTheDocument()
    expect(currentUrl()).toBe(TASK_URL)
  })

  it('shows "Task not found" on a 404', async () => {
    mockTask(() => HttpResponse.json({ error: 'Task not found' }, { status: 404 }))
    renderSignedIn(TASK_URL)
    expect(await screen.findByText('Task not found')).toBeInTheDocument()
  })

  it('shows "Not set", "Unassigned" and the completed date', async () => {
    mockTask(() => ({
      ...draft,
      status: 'DONE',
      completedAt: '2026-10-19T08:00:00.000Z',
      assignee: null as unknown as TaskDetail['assignee'],
      description: null,
      dueDate: null,
      estimateMinutes: null,
      labels: [],
      dependsOn: [],
      blocks: [],
    }))
    await openTask()

    expect(detail('Assignee')).toHaveTextContent('Unassigned')
    expect(detail('Due date')).toHaveTextContent('Not set')
    expect(detail('Estimate')).toHaveTextContent('Not set')
    expect(detail('Labels')).toHaveTextContent('None')
    expect(detail('Completed')).toHaveTextContent(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date('2026-10-19T08:00:00.000Z')))
    expect(screen.getByText('No description.')).toBeInTheDocument()
    // One line for both sides, and no empty lists.
    expect(screen.getByText('No dependencies.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Blocked by' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Blocks' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add blocker' })).toBeInTheDocument()
  })
})

describe('TaskPage editing', () => {
  it('changes the status from the badge menu', async () => {
    mockTask()
    const bodies = mockPatch()
    await openTask({ role: 'MEMBER' })

    await userEvent.click(screen.getByRole('button', { name: 'Status: In progress. Change status' }))
    expect(screen.queryByRole('menuitemradio', { name: 'Dependent' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Done' }))

    expect(await screen.findByText('Status changed to Done')).toBeInTheDocument()
    expect(bodies).toEqual([{ status: 'DONE' }])
    expect(screen.getByRole('button', { name: 'Status: Done. Change status' })).toBeInTheDocument()
  })

  it('names the blockers when a DEPENDENT task answers 409 TASK_BLOCKED', async () => {
    const blocker = { id: '0e6c1f2a-4b8d-4c3e-9f7a-1d2b3c4d5e6f', key: 'MKT-3', title: 'Finalise sample', status: 'IN_PROGRESS' } as const
    mockTask(() => ({ ...draft, status: 'DEPENDENT', dependsOn: [blocker] }))
    const bodies = mockPatch(() =>
      HttpResponse.json(
        { error: 'Task is blocked by unfinished dependencies', code: 'TASK_BLOCKED', details: { blockers: [blocker] } },
        { status: 409 },
      ),
    )
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Status: Dependent. Change status' }))
    expect(screen.getByText(/Waiting for its blockers/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Done' }))

    expect(await screen.findByText('This task is blocked by unfinished dependencies.')).toBeInTheDocument()
    expect(screen.getByText('Waiting for MKT-3 Finalise sample (In progress).')).toBeInTheDocument()
    expect(bodies).toEqual([{ status: 'DONE' }])
    expect(screen.getByRole('button', { name: 'Status: Dependent. Change status' })).toBeInTheDocument()
  })

  it('says when reopening saves the task as Dependent', async () => {
    mockTask(() => ({ ...draft, status: 'DONE' }))
    mockPatch(() => ({ ...draft, status: 'DEPENDENT' }))
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Status: Done. Change status' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'In progress' }))

    expect(await screen.findByText('Status changed to Dependent')).toBeInTheDocument()
    expect(screen.getByText("It has unfinished blockers. It moves to In progress once they're done.")).toBeInTheDocument()
  })

  it('renames the task in place', async () => {
    mockTask()
    const bodies = mockPatch()
    await openTask({ role: 'MEMBER' })

    await userEvent.click(screen.getByRole('button', { name: 'Edit title' }))
    const input = screen.getByRole('textbox', { name: 'Title' })
    expect(input).toHaveValue('Draft survey questions')
    await userEvent.clear(input)
    await userEvent.type(input, '  Write survey questions {Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Write survey questions' })).toBeInTheDocument()
    expect(bodies).toEqual([{ title: 'Write survey questions' }])
    expect(await screen.findByText('Title updated')).toBeInTheDocument()
  })

  it('changes the type and the priority from their menus', async () => {
    mockTask()
    const bodies = mockPatch()
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Type: Pre. Change type' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Bug' }))
    expect(await screen.findByText('Type changed to Bug')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Priority: High. Change priority' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Low' }))
    expect(await screen.findByText('Priority changed to Low')).toBeInTheDocument()

    expect(bodies).toEqual([{ type: 'BUG' }, { priority: 'LOW' }])
  })

  it('unassigns the task, then assigns it to me', async () => {
    mockTask()
    const bodies = mockPatch()
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Edit assignee, Jane Doe' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Jane Doe' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(detail('Assignee')).toHaveTextContent('Unassigned'))

    await userEvent.click(screen.getByRole('button', { name: 'Edit assignee, unassigned' }))
    await userEvent.click(screen.getByRole('button', { name: 'Assign to me' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(detail('Assignee')).toHaveTextContent('Jane Doe'))

    expect(bodies).toEqual([{ assigneeId: null }, { assigneeId: janeDoe.id }])
  })

  it('shows ASSIGNEE_NOT_FOUND under the picker and clears it', async () => {
    mockTask(() => ({ ...draft, assignee: null as unknown as TaskDetail['assignee'] }))
    mockPatch(() => HttpResponse.json({ error: 'Assignee not found', code: 'ASSIGNEE_NOT_FOUND' }, { status: 400 }))
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Edit assignee, unassigned' }))
    await userEvent.click(screen.getByRole('button', { name: 'Assign to me' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText("The assignee doesn't exist or is inactive.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Remove ${janeDoe.name}` })).not.toBeInTheDocument()
  })

  it('edits the estimate in hours and skips an unchanged save', async () => {
    mockTask()
    const bodies = mockPatch()
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Edit estimate, 8 h' }))
    const input = screen.getByRole('textbox', { name: 'Estimate in hours' })
    expect(input).toHaveValue('8')
    await userEvent.clear(input)
    await userEvent.type(input, '1.5{Enter}')
    await waitFor(() => expect(detail('Estimate')).toHaveTextContent('1 h 30 min'))

    // The response still says 480 minutes here, so open, change nothing and save.
    await userEvent.click(screen.getByRole('button', { name: /^Edit estimate/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(bodies).toEqual([{ estimateMinutes: 90 }])
  })

  it('replaces the labels', async () => {
    mockTask()
    const bodies = mockPatch()
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Edit labels, survey, q4' }))
    const input = screen.getByRole('textbox', { name: 'Labels' })
    expect(input).toHaveValue('survey, q4')
    await userEvent.clear(input)
    await userEvent.type(input, 'Survey, Q4 pricing{Enter}')

    await waitFor(() => expect(detail('Labels')).toHaveTextContent('surveyq4pricing'))
    expect(bodies).toEqual([{ labels: ['survey', 'q4', 'pricing'] }])
  })

  it('shows INVALID_DATE_RANGE under the due date', async () => {
    mockTask()
    mockPatch(() => HttpResponse.json({ error: 'dueDate must be on or after startDate', code: 'INVALID_DATE_RANGE' }, { status: 400 }))
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: /^Edit due date/ }))
    const input = screen.getByLabelText('Due date')
    await userEvent.clear(input)
    await userEvent.type(input, '2026-10-01')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The due date must be on or after the start date.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows "Task not found" when the task was deleted meanwhile', async () => {
    let deleted = false
    mockTask(() => (deleted ? HttpResponse.json({ error: 'Task not found' }, { status: 404 }) : draft))
    mockPatch(() => {
      deleted = true
      return HttpResponse.json({ error: 'Task not found' }, { status: 404 })
    })
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Priority: High. Change priority' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Low' }))

    expect(await screen.findByText('This task has been deleted.')).toBeInTheDocument()
    expect(await screen.findByText('Task not found')).toBeInTheDocument()
  })
})

describe('TaskPage delete', () => {
  function mockDelete(respond: () => Response = () => new HttpResponse(null, { status: 204 })) {
    const calls = { refs: [] as string[] }
    server.use(
      http.delete(api('/tasks/:taskRef'), ({ params }) => {
        calls.refs.push(String(params.taskRef))
        return respond()
      }),
      // The program page the user lands on.
      http.get(api('/programs/:programId/tasks'), () => HttpResponse.json(emptyPage)),
    )
    return calls
  }

  it('deletes the task as a MANAGER after confirming and goes back to the program', async () => {
    mockTask()
    const calls = mockDelete()
    await openTask({ role: 'MANAGER' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete task MKT-7' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete MKT-7?' })
    expect(dialog).toHaveTextContent('“Draft survey questions” and its dependency links will be removed.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }))

    expect(await screen.findByText('MKT-7 deleted')).toBeInTheDocument()
    await waitFor(() => expect(currentUrl()).toBe(PROGRAM_URL))
    expect(calls.refs).toEqual(['MKT-7'])
  })

  it('offers delete to the reporter, but not to another MEMBER', async () => {
    mockTask()
    await openTask({ role: 'MEMBER', me: { id: ravi.id, name: ravi.name, emailId: ravi.emailId } })
    expect(screen.getByRole('button', { name: 'Delete task MKT-7' })).toBeInTheDocument()
  })

  it("doesn't offer delete to a MEMBER who isn't the reporter", async () => {
    mockTask()
    await openTask({ role: 'MEMBER' })
    expect(screen.queryByRole('button', { name: 'Delete task MKT-7' })).not.toBeInTheDocument()
  })

  it('keeps the dialog open with the error on a 403', async () => {
    mockTask()
    mockDelete(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    await openTask({ role: 'ADMIN' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete task MKT-7' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete MKT-7?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("You don't have permission to do that.")
    expect(currentUrl()).toBe(TASK_URL)
  })
})

describe('TaskPage comments', () => {
  it('posts a comment on the task', async () => {
    mockTask()
    const bodies: unknown[] = []
    const paths: string[] = []
    server.use(
      http.post(api('/tasks/:taskRef/comments'), async ({ request, params }) => {
        paths.push(String(params.taskRef))
        bodies.push(await request.json())
        return HttpResponse.json(
          {
            data: {
              id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
              createdAt: '2026-10-20T10:30:00.000Z',
              updatedAt: '2026-10-20T10:30:00.000Z',
              isActive: true,
              programId: marketing.id,
              boardId: null,
              taskId: draft.id,
              parentId: null,
              author: jane,
              body: 'Looks good',
              editedAt: null,
              mentions: [],
              replies: [],
            },
          },
          { status: 201 },
        )
      }),
    )
    await openTask()
    await screen.findByText('No comments yet')

    await userEvent.type(screen.getByRole('textbox', { name: 'Comment' }), 'Looks good')
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(await screen.findByText('Comment added')).toBeInTheDocument()
    expect(bodies).toEqual([{ body: 'Looks good' }])
    expect(paths).toEqual([draft.id])
  })
})

describe('TaskPage blockers', () => {
  const sample = draft.dependsOn[0]
  const venue: TaskDetail = {
    ...draft,
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    key: 'MKT-12',
    number: 12,
    title: 'Book the venue',
    status: 'IN_PROGRESS',
    dependsOn: [],
    blocks: [],
  }
  const tool: TaskDetail = { ...venue, id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e', key: 'MKT-11', number: 11, title: 'Pick a survey tool', status: 'DONE' }
  // The list endpoint answers Task, not TaskDetail; the extra fields don't matter to the picker.
  const listed = [venue, tool, { ...draft }, { ...venue, ...sample, title: sample.title }]

  // GET …/tasks for the search: a case-insensitive title match, newest first.
  function mockSearch() {
    const queries: string[] = []
    server.use(
      http.get(api('/programs/:programId/tasks'), ({ request }) => {
        const url = new URL(request.url)
        queries.push(url.search.slice(1))
        const q = url.searchParams.get('q')?.toLowerCase() ?? ''
        const data = listed.filter((task) => task.title.toLowerCase().includes(q) || task.key.toLowerCase() === q)
        return HttpResponse.json({ data, meta: { total: data.length, limit: 20, offset: 0 } })
      }),
    )
    return queries
  }

  function mockAdd(respond: () => Response) {
    const bodies: unknown[] = []
    server.use(
      http.post(api('/tasks/:taskRef/dependencies'), async ({ request }) => {
        bodies.push(await request.json())
        return respond()
      }),
    )
    return bodies
  }

  it('lists the newest tasks without the task itself and its blockers', async () => {
    mockTask()
    const queries = mockSearch()
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Add blocker' }))
    expect(screen.getByRole('combobox', { name: 'Search tasks to add as a blocker' })).toHaveFocus()

    const options = await screen.findAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['MKT-12 Book the venueIn progress', 'MKT-11 Pick a survey toolDone'])
    expect(queries).toEqual(['limit=20&offset=0'])
  })

  it('searches, links the picked task and shows the task as Dependent', async () => {
    mockTask()
    const queries = mockSearch()
    const bodies = mockAdd(() =>
      HttpResponse.json({ data: { ...draft, status: 'DEPENDENT', dependsOn: [sample, { id: venue.id, key: venue.key, title: venue.title, status: venue.status }] } }, { status: 201 }),
    )
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Add blocker' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Search tasks to add as a blocker' }), 'venue')
    await waitFor(() => expect(queries).toContain('q=venue&limit=20&offset=0'))
    await userEvent.click(await screen.findByRole('option', { name: /MKT-12/ }))

    expect(await screen.findByText('MKT-7 is blocked by MKT-12')).toBeInTheDocument()
    expect(screen.getByText("It's Dependent until its blockers are done.")).toBeInTheDocument()
    expect(bodies).toEqual([{ dependsOnTaskId: venue.id }])
    expect(within(screen.getByRole('list', { name: 'Blocked by' })).getByRole('link', { name: 'MKT-12 Book the venue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Status: Dependent. Change status' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Search tasks to add as a blocker' })).not.toBeInTheDocument()
  })

  it('keeps the search open with the error on a 409 DEPENDENCY_CYCLE', async () => {
    mockTask()
    mockSearch()
    mockAdd(() => HttpResponse.json({ error: 'This dependency would create a cycle', code: 'DEPENDENCY_CYCLE' }, { status: 409 }))
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Add blocker' }))
    await userEvent.click(await screen.findByRole('option', { name: /MKT-11/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Adding this dependency would create a cycle.')
    expect(screen.getByRole('combobox', { name: 'Search tasks to add as a blocker' })).toBeInTheDocument()
  })

  it('closes the search on Escape', async () => {
    mockTask()
    mockSearch()
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Add blocker' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('combobox', { name: 'Search tasks to add as a blocker' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add blocker' })).toHaveFocus())
  })

  it('removes a blocker and says the status is back', async () => {
    const open = { ...sample, status: 'IN_PROGRESS' as const }
    mockTask(() => ({ ...draft, status: 'DEPENDENT', dependsOn: [open] }))
    const removed: string[] = []
    server.use(
      http.delete(api('/tasks/:taskRef/dependencies/:dependsOnTaskId'), ({ params }) => {
        removed.push(`${String(params.taskRef)}/${String(params.dependsOnTaskId)}`)
        return HttpResponse.json({ data: { ...draft, status: 'IN_PROGRESS', dependsOn: [] } })
      }),
    )
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove blocker MKT-3' }))

    expect(await screen.findByText('Removed blocker MKT-3')).toBeInTheDocument()
    expect(screen.getByText('Status is back to In progress.')).toBeInTheDocument()
    expect(removed).toEqual([`MKT-7/${sample.id}`])
    expect(screen.queryByRole('list', { name: 'Blocked by' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Status: In progress. Change status' })).toBeInTheDocument()
  })

  it('shows five blockers, and the rest after "Show 2 more"', async () => {
    const blockers = Array.from(
      { length: 7 },
      (_, i): TaskSummary => ({ id: `00000000-0000-4000-8000-00000000002${i}`, key: `MKT-${20 + i}`, title: `Blocker ${i + 1}`, status: 'ON_HOLD' }),
    )
    mockTask(() => ({ ...draft, dependsOn: blockers }))
    await openTask()

    const rows = () => within(screen.getByRole('list', { name: 'Blocked by' })).getAllByRole('listitem')
    expect(rows()).toHaveLength(5)
    await userEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    expect(rows()).toHaveLength(7)
    await userEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(rows()).toHaveLength(5)
    // Blocks has one task, so no toggle of its own.
    expect(screen.getAllByRole('button', { name: /^Show / })).toHaveLength(1)
  })

  it('toasts the error when removing fails', async () => {
    mockTask()
    server.use(
      http.delete(api('/tasks/:taskRef/dependencies/:dependsOnTaskId'), () =>
        HttpResponse.json({ error: 'MKT-7 does not depend on MKT-3' }, { status: 404 }),
      ),
    )
    await openTask()

    await userEvent.click(screen.getByRole('button', { name: 'Remove blocker MKT-3' }))
    expect(await screen.findByText('MKT-7 does not depend on MKT-3')).toBeInTheDocument()
  })
})

describe('TaskPage parents (spec 15)', () => {
  const BOARD_ID = '8c7d6e5f-4a3b-4c2d-9e1f-0a9b8c7d6e5f'
  const BOARD_URL = `/boards/${BOARD_ID}`
  const feedback: Board = {
    id: BOARD_ID,
    createdAt: '2026-10-28T09:00:00.000Z',
    updatedAt: '2026-10-28T09:00:00.000Z',
    isActive: true,
    key: 'PRO',
    name: 'Product feedback',
    description: null,
  }
  // A board task: same shape as a program task, with boardId and a BOARD parent.
  const boardTask: TaskDetail = {
    ...draft,
    id: '4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8',
    programId: null,
    boardId: BOARD_ID,
    parent: { type: 'BOARD', id: BOARD_ID, key: 'PRO', name: 'Product feedback', isActive: true },
    key: 'PRO-50',
    number: 50,
    dependsOn: [],
    blocks: [],
  }

  async function openBoardTask(task: TaskDetail = boardTask, options: Parameters<typeof renderSignedIn>[1] = {}) {
    const calls = mockTask(() => task)
    renderSignedIn('/tasks/PRO-50', options)
    await screen.findByRole('heading', { level: 1, name: 'Draft survey questions' })
    return calls
  }

  it('opens a board task by its key, with the board as its parent', async () => {
    const calls = await openBoardTask()

    expect(calls.refs).toEqual(['PRO-50'])
    expect(screen.getByRole('link', { name: 'Product feedback' })).toHaveAttribute('href', BOARD_URL)
    expect(within(detail('Board')).getByRole('link', { name: 'PRO Product feedback' })).toHaveAttribute('href', BOARD_URL)
    expect(details().queryByText('Program', { selector: 'dt' })).not.toBeInTheDocument()
  })

  it('names the program in Details for a program task', async () => {
    mockTask()
    await openTask()
    expect(within(detail('Program')).getByRole('link', { name: 'MKT Marketing Research' })).toHaveAttribute('href', PROGRAM_URL)
  })

  it('goes back to Boards when the task is on a deleted board', async () => {
    await openBoardTask({ ...boardTask, parent: { ...boardTask.parent, isActive: false } })

    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Boards' })).toHaveAttribute('href', '/boards')
    expect(detail('Board')).toHaveTextContent('PRO Product feedback (deleted)')
    expect(within(detail('Board')).queryByRole('link')).not.toBeInTheDocument()
  })

  it('redirects old program task links to /tasks/{taskRef}, whatever the program id', async () => {
    const calls = mockTask()
    renderSignedIn(`/programs/${marketing.id}/tasks/MKT-7`)
    await screen.findByRole('heading', { level: 1, name: 'Draft survey questions' })
    expect(currentUrl()).toBe(TASK_URL)
    expect(calls.refs).toEqual(['MKT-7'])
  })

  it('searches the same board for blockers', async () => {
    const queries: string[] = []
    server.use(
      http.get(api('/boards/:boardId/tasks'), ({ request, params }) => {
        queries.push(`${String(params.boardId)}?${new URL(request.url).search.slice(1)}`)
        return HttpResponse.json(emptyPage)
      }),
    )
    await openBoardTask()

    await userEvent.click(screen.getByRole('button', { name: 'Add blocker' }))
    expect(await screen.findByText('No other tasks in this board yet.')).toBeInTheDocument()
    expect(queries).toEqual([`${BOARD_ID}?limit=20&offset=0`])
  })

  it('edits a comment on a board task through /tasks/{taskId}/comments', async () => {
    const original: Comment = {
      id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
      createdAt: '2026-10-28T10:30:00.000Z',
      updatedAt: '2026-10-28T10:30:00.000Z',
      isActive: true,
      programId: null,
      boardId: BOARD_ID,
      taskId: boardTask.id,
      parentId: null,
      author: jane,
      body: 'Original',
      editedAt: null,
      mentions: [],
      replies: [],
    }
    const patched: string[] = []
    let body = original.body
    mockTask(() => boardTask)
    server.use(
      http.get(api('/tasks/:taskRef/comments'), () =>
        HttpResponse.json({ data: [{ ...original, body }], meta: { total: 1, limit: 20, offset: 0 } }),
      ),
      http.patch(api('/tasks/:taskRef/comments/:commentId'), async ({ request, params }) => {
        patched.push(`${String(params.taskRef)}/${String(params.commentId)}`)
        body = ((await request.json()) as { body: string }).body
        return HttpResponse.json({ data: { ...original, body, editedAt: '2026-10-28T11:00:00.000Z' } })
      }),
    )
    renderSignedIn('/tasks/PRO-50')

    await userEvent.click(within(await screen.findByRole('article', { name: 'Comment by Jane Doe' })).getByRole('button', { name: 'Edit' }))
    const form = screen.getByRole('form', { name: 'Edit comment' })
    await userEvent.type(within(form).getByRole('textbox', { name: 'Comment' }), ' text')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Comment updated')).toBeInTheDocument()
    expect(patched).toEqual([`${boardTask.id}/${original.id}`])
  })

  it('deletes a board task and goes back to the board', async () => {
    const deleted: string[] = []
    server.use(
      http.delete(api('/tasks/:taskRef'), ({ params }) => {
        deleted.push(String(params.taskRef))
        return new HttpResponse(null, { status: 204 })
      }),
      // The board page the user lands on.
      http.get(api('/boards/:boardId'), () => HttpResponse.json({ data: feedback })),
      http.get(api('/boards/:boardId/tasks'), () => HttpResponse.json(emptyPage)),
    )
    await openBoardTask(boardTask, { role: 'MANAGER' })

    await userEvent.click(screen.getByRole('button', { name: 'Delete task PRO-50' }))
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Delete PRO-50?' })).getByRole('button', { name: 'Delete task' }))

    expect(await screen.findByText('PRO-50 deleted')).toBeInTheDocument()
    await waitFor(() => expect(currentUrl()).toBe(BOARD_URL))
    expect(await screen.findByRole('heading', { level: 1, name: 'Product feedback' })).toBeInTheDocument()
    expect(deleted).toEqual(['PRO-50'])
  })
})
