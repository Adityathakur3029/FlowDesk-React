import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { Employee } from '@/features/employees'
import { api, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Team } from './types'

// The contract's Team example, plus a second team.
const design: Team = {
  id: '3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23',
  createdAt: '2026-10-17T09:00:00.000Z',
  updatedAt: '2026-10-17T09:00:00.000Z',
  isActive: true,
  name: 'Design',
  description: 'Brand, product and web design',
  memberCount: 3,
}
const research: Team = { ...design, id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', name: 'Research', description: null, memberCount: 1 }
const created: Team = { ...design, id: '16fd2706-8baf-433b-82eb-8c7fada847da', name: 'Platform', description: null, memberCount: 0 }

const ravi: Employee = { ...janeDoe, id: '0f8b6c1e-2a3d-4e5f-8a9b-1c2d3e4f5a6b', name: 'Ravi Kumar', emailId: 'ravi.kumar@saajha.org', role: 'MEMBER', teamId: design.id }
const priya: Employee = { ...janeDoe, id: '9b2f4c1a-3d5e-4f60-8a7b-2c3d4e5f6a7b', name: 'Priya Shah', emailId: 'priya.shah@saajha.org', role: 'MEMBER' }

const teamPage = (data: Team[], meta: { total: number; offset?: number; limit?: number }) =>
  HttpResponse.json({ data, meta: { limit: 20, offset: 0, ...meta } })

function mockTeams(respond: (url: URL) => Response) {
  server.use(http.get(api('/teams'), ({ request }) => respond(new URL(request.url))))
}

// GET /employees?q=… answers with everyone whose name contains q (the test's stand-in for the backend search).
function mockSearch(people: Employee[]) {
  const queries: string[] = []
  server.use(
    http.get(api('/employees'), ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.search.slice(1))
      const q = url.searchParams.get('q')?.toLowerCase() ?? ''
      const data = people.filter((p) => p.name.toLowerCase().includes(q))
      return HttpResponse.json({ data, meta: { total: data.length, limit: 20, offset: 0 } })
    }),
  )
  return queries
}

// POST /teams answers with `respond`; PUT …/members/{id} answers 200 unless `failPut` names the employee.
function mockCreate(respond: () => Response, failPut: string[] = []) {
  const calls = { body: undefined as unknown, posts: 0, puts: [] as string[] }
  server.use(
    http.post(api('/teams'), async ({ request }) => {
      calls.posts += 1
      calls.body = await request.json()
      return respond()
    }),
    http.put(api('/teams/:teamId/members/:employeeId'), ({ params }) => {
      calls.puts.push(`${params.teamId}/${params.employeeId}`)
      if (failPut.includes(String(params.employeeId))) {
        return HttpResponse.json({ error: 'Employee not found' }, { status: 404 })
      }
      return HttpResponse.json({ data: { employee: ravi, previousTeamId: null } })
    }),
  )
  return calls
}

async function openCreateDialog() {
  await userEvent.click(await screen.findByRole('button', { name: 'Create team' }))
  return screen.findByRole('dialog', { name: 'Create a team' })
}

async function pickMember(dialog: HTMLElement, query: string, name: string) {
  await userEvent.type(within(dialog).getByRole('combobox', { name: 'Members' }), query)
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

describe('TeamsPage', () => {
  it('lists teams with member counts and links to their people', async () => {
    mockTeams(() => teamPage([design, research], { total: 2 }))
    renderSignedIn('/teams')

    // Wait for the data: the skeleton is a different list element.
    const designRow = (await screen.findByRole('link', { name: 'Design' })).closest('li')!
    const list = screen.getByRole('list', { name: 'Teams' })
    expect(within(designRow).getByText('3 members')).toBeInTheDocument()
    expect(within(designRow).getByText('Brand, product and web design')).toBeInTheDocument()
    expect(within(designRow).getByRole('link', { name: 'Design' })).toHaveAttribute('href', `/people?teamId=${design.id}`)
    const researchRow = within(list).getByRole('link', { name: 'Research' }).closest('li')!
    expect(within(researchRow).getByText('1 member')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['MEMBER', false],
    ['MANAGER', true],
    ['ADMIN', true],
  ] as const)('as %s, the Create team button is shown: %s', async (role, shown) => {
    mockTeams(() => teamPage([design], { total: 1 }))
    renderSignedIn('/teams', { role })
    await screen.findByRole('link', { name: 'Design' })
    expect(screen.queryByRole('button', { name: 'Create team' }) !== null).toBe(shown)
  })

  it('shows the empty state, with the create action only for roles that may create', async () => {
    renderSignedIn('/teams', { role: 'MEMBER' })
    expect(await screen.findByText('No teams yet')).toBeInTheDocument()
    expect(screen.getByText('Ask an admin or manager to create one.')).toBeInTheDocument()
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockTeams(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : teamPage([design], { total: 1 })))
    renderSignedIn('/teams')

    expect(await screen.findByText("Couldn't load teams")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: 'Design' })).toBeInTheDocument()
  })
})

describe('CreateTeamDialog', () => {
  it('creates a team without members, sending only a trimmed name', async () => {
    const calls = mockCreate(() => HttpResponse.json({ data: created }, { status: 201 }))
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), '  Platform ')
    await userEvent.type(within(dialog).getByLabelText('Description (optional)'), '   ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    expect(await screen.findByText('Team “Platform” created')).toBeInTheDocument()
    expect(screen.getByText('No members yet.')).toBeInTheDocument()
    expect(calls.body).toEqual({ name: 'Platform' })
    expect(calls.puts).toEqual([])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds each picked member to the new team', async () => {
    mockTeams(() => teamPage([design], { total: 1 }))
    const queries = mockSearch([ravi, priya])
    const calls = mockCreate(() => HttpResponse.json({ data: created }, { status: 201 }))
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Platform')
    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Members' }), 'ra')
    // A member of another team carries a hint: adding them moves them.
    const raviOption = await screen.findByRole('option', { name: /Ravi Kumar/ })
    expect(within(raviOption).getByText('In Design')).toBeInTheDocument()
    expect(queries).toEqual(['q=ra&limit=20'])
    await userEvent.click(raviOption)
    await pickMember(dialog, 'pri', 'Priya Shah')

    const chips = within(dialog).getByRole('list', { name: 'Selected members' })
    expect(within(chips).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ravi Kumar', 'Priya Shah'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    expect(await screen.findByText('2 members added.')).toBeInTheDocument()
    expect(calls.puts.sort()).toEqual([`${created.id}/${priya.id}`, `${created.id}/${ravi.id}`].sort())
  })

  it('reports members that could not be added and still closes', async () => {
    mockSearch([ravi, priya])
    mockCreate(() => HttpResponse.json({ data: created }, { status: 201 }), [priya.id])
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Platform')
    await pickMember(dialog, 'ra', 'Ravi Kumar')
    await pickMember(dialog, 'pri', 'Priya Shah')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    expect(await screen.findByText('Team “Platform” created, but 1 of 2 people weren\'t added')).toBeInTheDocument()
    expect(screen.getByText(/Priya Shah \(Employee not found\)\. Add them from People with Edit\./)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows TEAM_NAME_EXISTS under the name and keeps the dialog open', async () => {
    mockCreate(() => HttpResponse.json({ error: 'A team named "Design" already exists', code: 'TEAM_NAME_EXISTS' }, { status: 409 }))
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'design')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))

    expect(await within(dialog).findByText('A team with this name already exists.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Name')).toHaveValue('design')
  })

  it.each([
    [{ error: 'Validation failed', details: [{ path: 'name', message: 'Too long' }] }, 400, 'Too long'],
    [{ error: 'Forbidden', code: 'FORBIDDEN' }, 403, "You don't have permission to do that."],
  ])('shows a %#: server error in the dialog', async (body, status, text) => {
    mockCreate(() => HttpResponse.json(body, { status }))
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Platform')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create team' }))
    expect(await within(dialog).findByText(text)).toBeInTheDocument()
  })
})

describe('EmployeeMultiPicker', () => {
  it('picks with the keyboard without submitting, and hides people already picked', async () => {
    mockSearch([ravi, priya])
    const calls = mockCreate(() => HttpResponse.json({ data: created }, { status: 201 }))
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()
    const input = within(dialog).getByRole('combobox', { name: 'Members' })

    await userEvent.type(input, 'ra')
    await screen.findByRole('option', { name: /Ravi Kumar/ })
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}')

    expect(within(dialog).getByRole('button', { name: 'Remove Ravi Kumar' })).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    // Enter picked; it didn't submit the (still unnamed) form.
    expect(within(dialog).queryByText('Enter a team name.')).not.toBeInTheDocument()
    expect(calls.posts).toBe(0)

    await userEvent.type(input, 'ra')
    expect(await screen.findByText('No one matches “ra”.')).toBeInTheDocument()
  })

  it('removes chips with × and with Backspace', async () => {
    mockSearch([ravi, priya])
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await pickMember(dialog, 'ra', 'Ravi Kumar')
    await pickMember(dialog, 'pri', 'Priya Shah')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Ravi Kumar' }))
    expect(within(dialog).queryByRole('button', { name: 'Remove Ravi Kumar' })).not.toBeInTheDocument()

    await userEvent.keyboard('{Backspace}')
    expect(within(dialog).queryByRole('list', { name: 'Selected members' })).not.toBeInTheDocument()
  })

  it('closes the suggestions on Escape before closing the dialog', async () => {
    mockSearch([ravi])
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Members' }), 'ra')
    await screen.findByRole('option', { name: /Ravi Kumar/ })
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says so when the search fails', async () => {
    server.use(http.get(api('/employees'), () => HttpResponse.json({ error: 'Internal server error' }, { status: 500 })))
    renderSignedIn('/teams')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByRole('combobox', { name: 'Members' }), 'ra')
    expect(await screen.findByText("Couldn't search people. Try again.")).toBeInTheDocument()
  })
})
