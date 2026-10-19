import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { Team } from '@/features/teams'
import { api, currentUrl, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Program, UpdateProgramRequest } from './types'

// The contract's Team and Program examples.
const research: Team = {
  id: '3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23',
  createdAt: '2026-10-17T09:00:00.000Z',
  updatedAt: '2026-10-17T09:00:00.000Z',
  isActive: true,
  name: 'Research',
  description: 'User and market research',
  memberCount: 4,
}
const marketing: Program = {
  id: '5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14',
  createdAt: '2026-10-17T09:30:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
  isActive: true,
  key: 'MKT',
  name: 'Marketing Research',
  description: 'Q4 market research\nfor the new product line',
  status: 'ACTIVE',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  ownerTeamId: research.id,
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function mockProgram(respond: () => Response | Program) {
  const calls = { tasks: [] as string[], comments: 0 }
  server.use(
    http.get(api('/programs/:programId'), () => {
      const result = respond()
      return result instanceof Response ? result : HttpResponse.json({ data: result })
    }),
    http.get(api('/teams'), () => HttpResponse.json({ data: [research], meta: { total: 1, limit: 100, offset: 0 } })),
    http.get(api('/programs/:programId/tasks'), ({ request }) => {
      calls.tasks.push(new URL(request.url).search.slice(1))
      return HttpResponse.json({ data: [], meta: { total: 0, limit: 20, offset: 0 } })
    }),
    http.get(api('/programs/:programId/comments'), () => {
      calls.comments += 1
      return HttpResponse.json({ data: [], meta: { total: 0, limit: 20, offset: 0 } })
    }),
  )
  return calls
}

const tab = (name: string) => within(screen.getByRole('tablist', { name: 'Program sections' })).getByRole('tab', { name })

const details = () => within(screen.getByRole('complementary', { name: 'Program details' }))

function detail(label: string) {
  const term = details().getByText(label, { selector: 'dt' })
  return term.nextElementSibling as HTMLElement
}

describe('ProgramPage', () => {
  it('shows the program, its details, the Tasks tab and the analytics placeholder', async () => {
    const calls = mockProgram(() => marketing)
    renderSignedIn(`/programs/${marketing.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Marketing Research' })).toBeInTheDocument()
    expect(screen.getByText('MKT')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/Q4 market research/)).toHaveTextContent('Q4 market research for the new product line')

    await waitFor(() => expect(detail('Owner team')).toHaveTextContent('Research'))
    expect(detail('Start date')).toHaveTextContent(dateFormat.format(new Date('2026-10-01')))
    expect(detail('End date')).toHaveTextContent(dateFormat.format(new Date('2026-12-31')))
    expect(detail('Created')).toHaveTextContent(timestampFormat.format(new Date(marketing.createdAt)))
    expect(detail('Updated')).toHaveTextContent(timestampFormat.format(new Date(marketing.updatedAt)))

    expect(screen.getByRole('heading', { name: 'Analytics & reports' })).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()

    // Tasks is the default tab; comments only load once their tab is opened.
    expect(tab('Tasks')).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument()
    expect(calls.tasks).toEqual(['limit=20&offset=0'])
    expect(calls.comments).toBe(0)
    expect(screen.queryByRole('heading', { name: 'Comments' })).not.toBeInTheDocument()

    // The sidebar keeps Programs active on a program's page.
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Programs' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('opens the Comments tab and keeps the task filters in the URL', async () => {
    const calls = mockProgram(() => marketing)
    renderSignedIn(`/programs/${marketing.id}?status=DONE`)
    await screen.findByText('No tasks match these filters')

    await userEvent.click(tab('Comments'))
    expect(await screen.findByText('No comments yet')).toBeInTheDocument()
    expect(tab('Comments')).toHaveAttribute('aria-selected', 'true')
    expect(calls.comments).toBe(1)
    expect(currentUrl()).toBe(`/programs/${marketing.id}?status=DONE&tab=comments`)

    await userEvent.click(tab('Tasks'))
    expect(await screen.findByText('No tasks match these filters')).toBeInTheDocument()
    expect(currentUrl()).toBe(`/programs/${marketing.id}?status=DONE`)
  })

  it('opens on the Comments tab from ?tab=comments', async () => {
    const calls = mockProgram(() => marketing)
    renderSignedIn(`/programs/${marketing.id}?tab=comments`)

    expect(await screen.findByText('No comments yet')).toBeInTheDocument()
    expect(tab('Comments')).toHaveAttribute('aria-selected', 'true')
    expect(calls.tasks).toEqual([])
  })

  it('shows "Not set" and "No description." for empty fields', async () => {
    mockProgram(() => ({ ...marketing, description: null, startDate: null, endDate: null }))
    renderSignedIn(`/programs/${marketing.id}`)

    expect(await screen.findByText('No description.')).toBeInTheDocument()
    expect(detail('Start date')).toHaveTextContent('Not set')
    expect(detail('End date')).toHaveTextContent('Not set')
  })

  it('opens from the Programs list', async () => {
    mockProgram(() => marketing)
    server.use(
      http.get(api('/programs'), () => HttpResponse.json({ data: [marketing], meta: { total: 1, limit: 20, offset: 0 } })),
    )
    renderSignedIn('/programs')

    await userEvent.click(await screen.findByRole('link', { name: 'Marketing Research' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Marketing Research' })).toBeInTheDocument()
    expect(currentUrl()).toBe(`/programs/${marketing.id}`)

    await userEvent.click(screen.getByRole('link', { name: 'Programs', current: false }))
    await waitFor(() => expect(currentUrl()).toBe('/programs'))
  })

  it.each([
    ['404', () => HttpResponse.json({ error: 'Program not found' }, { status: 404 })],
    [
      '400 (not a UUID)',
      () => HttpResponse.json({ error: 'Validation failed', details: [{ path: 'programId', message: 'Invalid UUID' }] }, { status: 400 }),
    ],
  ])('shows "Program not found" on a %s', async (_, respond) => {
    mockProgram(respond)
    renderSignedIn('/programs/nope')
    expect(await screen.findByText('Program not found')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Comments' })).not.toBeInTheDocument()
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockProgram(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : marketing))
    renderSignedIn(`/programs/${marketing.id}`)

    expect(await screen.findByText("Couldn't load the program")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Marketing Research' })).toBeInTheDocument()
  })
})

// PATCH /programs/{programId}: answers with the program merged with the body, or a given error.
function mockPatch(respond: (body: UpdateProgramRequest) => Response | Program = (body) => ({ ...marketing, ...body })) {
  const bodies: UpdateProgramRequest[] = []
  server.use(
    http.patch(api('/programs/:programId'), async ({ request }) => {
      const body = (await request.json()) as UpdateProgramRequest
      bodies.push(body)
      const result = respond(body)
      return result instanceof Response ? result : HttpResponse.json({ data: result })
    }),
  )
  return bodies
}

describe('ProgramPage editing', () => {
  const openPage = async (role: 'ADMIN' | 'MANAGER' | 'MEMBER' = 'MANAGER') => {
    renderSignedIn(`/programs/${marketing.id}`, { role })
    await screen.findByRole('heading', { level: 1, name: 'Marketing Research' })
  }

  it('renames the program in place', async () => {
    mockProgram(() => marketing)
    const bodies = mockPatch()
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(input).toHaveFocus()
    expect(input).toHaveValue('Marketing Research')
    await userEvent.clear(input)
    await userEvent.type(input, '  Market Study {Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Market Study' })).toBeInTheDocument()
    expect(bodies).toEqual([{ name: 'Market Study' }])
    expect(await screen.findByText('Name updated')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit name' })).toHaveFocus())
  })

  it('closes without a request when nothing changed, and Escape discards changes', async () => {
    mockProgram(() => marketing)
    const bodies = mockPatch()
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Marketing Research' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' draft{Escape}')
    expect(screen.getByRole('heading', { level: 1, name: 'Marketing Research' })).toBeInTheDocument()
    expect(bodies).toEqual([])
  })

  it('changes the status from the badge menu', async () => {
    mockProgram(() => marketing)
    const bodies = mockPatch()
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: 'Status: Active. Change status' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'On hold' }))

    expect(await screen.findByText('Status changed to On hold')).toBeInTheDocument()
    expect(bodies).toEqual([{ status: 'ON_HOLD' }])
    expect(screen.getByRole('button', { name: 'Status: On hold. Change status' })).toBeInTheDocument()
  })

  it('edits and clears the description', async () => {
    mockProgram(() => marketing)
    const bodies = mockPatch()
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }))
    const box = screen.getByRole('textbox', { name: 'Description' })
    expect(box).toHaveValue(marketing.description)
    await userEvent.clear(box)
    await userEvent.type(box, 'New scope{Control>}{Enter}{/Control}')
    expect(await screen.findByText('New scope')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('No description.')).toBeInTheDocument()
    expect(bodies).toEqual([{ description: 'New scope' }, { description: null }])
    expect(screen.getByRole('button', { name: 'Add description' })).toBeInTheDocument()
  })

  it('changes and clears a date', async () => {
    mockProgram(() => marketing)
    const bodies = mockPatch()
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: `Edit start date, ${dateFormat.format(new Date('2026-10-01'))}` }))
    const input = screen.getByLabelText('Start date')
    await userEvent.clear(input)
    await userEvent.type(input, '2026-10-15')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(detail('Start date')).toHaveTextContent(dateFormat.format(new Date('2026-10-15'))))

    await userEvent.click(screen.getByRole('button', { name: /^Edit end date/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear date' }))
    await waitFor(() => expect(detail('End date')).toHaveTextContent('Not set'))
    expect(bodies).toEqual([{ startDate: '2026-10-15' }, { endDate: null }])
  })

  it('shows INVALID_DATE_RANGE under the end date and keeps the editor open', async () => {
    mockProgram(() => marketing)
    mockPatch(() => HttpResponse.json({ error: 'endDate must be on or after startDate', code: 'INVALID_DATE_RANGE' }, { status: 400 }))
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: /^Edit end date/ }))
    const input = screen.getByLabelText('End date')
    await userEvent.clear(input)
    await userEvent.type(input, '2026-09-01')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The end date must be on or after the start date.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(input).toHaveFocus())
  })

  it('shows a 403 in the editor and keeps the text', async () => {
    mockProgram(() => marketing)
    mockPatch(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' 2{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have permission to do that.")
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Marketing Research 2')
  })

  it('shows the field error from a 400 validation response', async () => {
    mockProgram(() => marketing)
    mockPatch(() =>
      HttpResponse.json({ error: 'Validation failed', details: [{ path: 'name', message: 'Too long from the server' }] }, { status: 400 }),
    )
    await openPage()

    await userEvent.click(screen.getByRole('button', { name: 'Edit name' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), ' 2{Enter}')

    expect(await screen.findByText('Too long from the server')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true')
  })

  it("doesn't offer editing to a MEMBER", async () => {
    mockProgram(() => marketing)
    await openPage('MEMBER')

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit name' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Change status/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit description' })).not.toBeInTheDocument()
    expect(within(detail('Start date')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(detail('End date')).queryByRole('button')).not.toBeInTheDocument()
  })
})
