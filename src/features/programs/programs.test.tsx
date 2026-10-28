import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { Team } from '@/features/teams'
import { api, currentUrl, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Program } from './types'

// The contract's Team and Program examples, plus a second of each.
const research: Team = {
  id: '3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23',
  createdAt: '2026-10-17T09:00:00.000Z',
  updatedAt: '2026-10-17T09:00:00.000Z',
  isActive: true,
  name: 'Research',
  description: 'User and market research',
  memberCount: 4,
}
const design: Team = { ...research, id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', name: 'Design', description: null, memberCount: 3 }

const marketing: Program = {
  id: '5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14',
  createdAt: '2026-10-17T09:30:00.000Z',
  updatedAt: '2026-10-17T09:30:00.000Z',
  isActive: true,
  key: 'MKT',
  name: 'Marketing Research',
  description: 'Q4 market research for the new product line',
  status: 'ACTIVE',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  ownerTeamId: research.id,
  completedAt: null,
  cancelledAt: null,
}
const hiring: Program = {
  ...marketing,
  id: '16fd2706-8baf-433b-82eb-8c7fada847da',
  createdAt: '2026-10-15T08:00:00.000Z',
  key: 'HIR',
  name: 'Hiring Drive',
  description: null,
  status: 'PLANNED',
  startDate: null,
  endDate: null,
  ownerTeamId: design.id,
}

const createdFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

// GET /teams with every team in one page (the directory), sorted by name like the backend.
function mockTeams(respond: () => Response | Team[]) {
  const calls = { count: 0 }
  server.use(
    http.get(api('/teams'), () => {
      calls.count += 1
      const result = respond()
      if (result instanceof Response) return result
      return HttpResponse.json({ data: result, meta: { total: result.length, limit: 100, offset: 0 } })
    }),
  )
  return calls
}

function mockPrograms(respond: (url: URL) => Response | Program[]) {
  const queries: string[] = []
  server.use(
    http.get(api('/programs'), ({ request }) => {
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
    http.post(api('/programs'), async ({ request }) => {
      calls.bodies.push(await request.json())
      return respond()
    }),
  )
  return calls
}

const createdResponse = (program: Program) => HttpResponse.json({ data: program }, { status: 201 })

async function openCreateDialog() {
  await userEvent.click(await screen.findByRole('button', { name: 'Create program' }))
  return screen.findByRole('dialog', { name: 'Create a program' })
}

const ownerSelect = (dialog: HTMLElement) => within(dialog).getByRole('combobox', { name: 'Owner team' })

async function selectOption(dialog: HTMLElement, field: string, option: string) {
  await userEvent.click(within(dialog).getByRole('combobox', { name: field }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('ProgramsPage', () => {
  it('lists programs with key, status, owner team and created date', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [marketing, hiring])
    renderSignedIn('/programs')

    // Wait for the data: the skeleton is a different table element.
    const marketingRow = (await screen.findByText('Marketing Research')).closest('tr')!
    const table = screen.getByRole('table', { name: 'Programs' })
    expect(within(marketingRow).getByText('MKT')).toBeInTheDocument()
    expect(within(marketingRow).getByText('Q4 market research for the new product line')).toBeInTheDocument()
    expect(within(marketingRow).getByText('Active')).toBeInTheDocument()
    expect(await within(marketingRow).findByText('Research')).toBeInTheDocument()
    expect(within(marketingRow).getByText(createdFormat.format(new Date(marketing.createdAt)))).toBeInTheDocument()

    const hiringRow = within(table).getByText('Hiring Drive').closest('tr')!
    expect(within(hiringRow).getByText('HIR')).toBeInTheDocument()
    expect(within(hiringRow).getByText('Planned')).toBeInTheDocument()
    expect(within(hiringRow).getByText('Design')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Programs' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists Programs first in the sidebar', async () => {
    mockPrograms(() => [marketing])
    renderSignedIn('/programs')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Programs', 'Boards', 'Overview', 'People', 'Teams'])
  })

  it('shows the start and end dates, or "Not set"', async () => {
    mockPrograms(() => [
      marketing,
      hiring,
      { ...hiring, id: 'b3b1c7a2-1f0e-4d8e-9a3b-2c1d0e9f8a7b', name: 'Only start', startDate: '2026-11-01' },
      { ...hiring, id: 'c4c2d8b3-2a1f-4e9f-8b4c-3d2e1f0a9b8c', name: 'Only end', endDate: '2027-01-31' },
    ])
    renderSignedIn('/programs')

    const row = async (name: string) => (await screen.findByText(name)).closest('tr')!
    // formatRange puts thin spaces around the dash; getByText collapses whitespace in the DOM text only.
    const range = dateFormat.formatRange(new Date('2026-10-01'), new Date('2026-12-31')).replace(/\s+/g, ' ')
    expect(within(await row('Marketing Research')).getByText(range)).toBeInTheDocument()
    expect(within(await row('Hiring Drive')).getByText('Not set')).toBeInTheDocument()
    expect(within(await row('Only start')).getByText(`From ${dateFormat.format(new Date('2026-11-01'))}`)).toBeInTheDocument()
    expect(within(await row('Only end')).getByText(`Until ${dateFormat.format(new Date('2027-01-31'))}`)).toBeInTheDocument()
  })

  it('links each program name to its page', async () => {
    mockPrograms(() => [marketing])
    renderSignedIn('/programs')
    expect(await screen.findByRole('link', { name: 'Marketing Research' })).toHaveAttribute('href', `/programs/${marketing.id}`)
  })

  it('shows "No owner team" for legacy programs and "Unknown team" for ids not in the directory', async () => {
    mockTeams(() => [research])
    mockPrograms(() => [{ ...marketing, ownerTeamId: null }, hiring])
    renderSignedIn('/programs')

    expect(await screen.findByText('No owner team')).toBeInTheDocument()
    const hiringRow = screen.getByText('Hiring Drive').closest('tr')!
    expect(await within(hiringRow).findByText('Unknown team')).toBeInTheDocument()
  })

  it('still lists programs when the team directory fails', async () => {
    mockTeams(() => HttpResponse.json({ error: 'Internal server error' }, { status: 500 }))
    mockPrograms(() => [marketing])
    renderSignedIn('/programs')

    expect(await screen.findByText('Marketing Research')).toBeInTheDocument()
    expect(await screen.findByText('Unknown team')).toBeInTheDocument()
  })

  it.each([
    ['MEMBER', false],
    ['MANAGER', true],
    ['ADMIN', true],
  ] as const)('as %s, the Create program button is shown: %s', async (role, shown) => {
    mockPrograms(() => [marketing])
    renderSignedIn('/programs', { role })
    await screen.findByText('Marketing Research')
    expect(screen.queryByRole('button', { name: 'Create program' }) !== null).toBe(shown)
  })

  it('shows the empty state without an action for MEMBER', async () => {
    mockPrograms(() => [])
    renderSignedIn('/programs', { role: 'MEMBER' })
    expect(await screen.findByText('No programs yet')).toBeInTheDocument()
    expect(screen.getByText('Ask an admin or manager to create one.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create program' })).not.toBeInTheDocument()
  })

  it('shows the empty state with a create action for MANAGER', async () => {
    mockPrograms(() => [])
    renderSignedIn('/programs', { role: 'MANAGER' })
    expect(await screen.findByText('No programs yet')).toBeInTheDocument()
    // One in the header, one in the empty state.
    expect(screen.getAllByRole('button', { name: 'Create program' })).toHaveLength(2)
    expect(screen.queryByText('Ask an admin or manager to create one.')).not.toBeInTheDocument()
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockPrograms(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : [marketing]))
    renderSignedIn('/programs')

    expect(await screen.findByText("Couldn't load programs")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Marketing Research')).toBeInTheDocument()
  })

  it('requests the page in the URL', async () => {
    const queries = mockPrograms(() =>
      HttpResponse.json({ data: [hiring], meta: { total: 21, limit: 20, offset: 20 } }),
    )
    renderSignedIn('/programs?offset=20')
    expect(await screen.findByText('Hiring Drive')).toBeInTheDocument()
    expect(queries).toEqual(['limit=20&offset=20'])
    expect(screen.getByText('Showing 21–21 of 21')).toBeInTheDocument()
  })
})

describe('ProgramsPage status filter', () => {
  const statusFilter = () => screen.getByRole('combobox', { name: 'Status' })

  it('filters by the picked status from the first page', async () => {
    const queries = mockPrograms((url) => (url.searchParams.get('status') === 'ACTIVE' ? [marketing] : [marketing, hiring]))
    renderSignedIn('/programs?offset=20')
    await screen.findByText('Hiring Drive')
    expect(statusFilter()).toHaveTextContent('All statuses')

    await userEvent.click(statusFilter())
    await userEvent.click(await screen.findByRole('option', { name: 'Active' }))

    await waitFor(() => expect(screen.queryByText('Hiring Drive')).not.toBeInTheDocument())
    expect(currentUrl()).toBe('/programs?status=ACTIVE')
    expect(queries).toEqual(['limit=20&offset=20', 'status=ACTIVE&limit=20&offset=0'])
  })

  it('requests the status and page in the URL', async () => {
    const queries = mockPrograms(() =>
      HttpResponse.json({
        data: [{ ...hiring, status: 'COMPLETED', completedAt: '2026-10-19T08:00:00.000Z' }],
        meta: { total: 21, limit: 20, offset: 20 },
      }),
    )
    renderSignedIn('/programs?status=COMPLETED&offset=20')
    expect(await screen.findByText('Hiring Drive')).toBeInTheDocument()
    expect(queries).toEqual(['status=COMPLETED&limit=20&offset=20'])
    expect(statusFilter()).toHaveTextContent('Completed')
  })

  it('says when no program has the status, and clears the filter', async () => {
    const queries = mockPrograms((url) => (url.searchParams.has('status') ? [] : [marketing]))
    renderSignedIn('/programs?status=COMPLETED', { role: 'MANAGER' })

    expect(await screen.findByText('No completed programs')).toBeInTheDocument()
    // The filter row's Clear filter, and the empty state's.
    const clear = screen.getAllByRole('button', { name: 'Clear filter' })
    expect(clear).toHaveLength(2)
    await userEvent.click(clear[1])

    expect(await screen.findByText('Marketing Research')).toBeInTheDocument()
    expect(currentUrl()).toBe('/programs')
    expect(queries).toEqual(['status=COMPLETED&limit=20&offset=0', 'limit=20&offset=0'])
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument()
  })

  it('clears the filter after creating a program the filter would hide', async () => {
    mockTeams(() => [design, research])
    mockPrograms((url) => (url.searchParams.get('status') === 'ACTIVE' ? [marketing] : [hiring, marketing]))
    mockCreate(() => createdResponse(hiring))
    renderSignedIn('/programs?status=ACTIVE', { me: { teamId: research.id } })
    await screen.findByText('Marketing Research')
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Hiring Drive')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    await waitFor(() => expect(currentUrl()).toBe('/programs'))
    expect(await screen.findByText('Hiring Drive')).toBeInTheDocument()
  })

  it('keeps the filter after creating a program with that status', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [marketing])
    mockCreate(() => createdResponse({ ...hiring, status: 'ACTIVE' }))
    renderSignedIn('/programs?status=ACTIVE&offset=20', { me: { teamId: research.id } })
    await screen.findByText('Marketing Research')
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Hiring Drive')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    await waitFor(() => expect(currentUrl()).toBe('/programs?status=ACTIVE'))
  })
})

describe('CreateProgramDialog', () => {
  it('suggests a key from the name and previews the task key prefix', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    renderSignedIn('/programs')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    expect(within(dialog).getByLabelText('Key')).toHaveValue('MR')
    // Task numbers are global (spec 15), so the hint doesn't promise MR-1, MR-2…
    expect(within(dialog).getByText("Task keys will start with MR-. The key can't be changed later.")).toBeInTheDocument()
  })

  it("keeps the user's own key, uppercased, and resumes suggesting once it's cleared", async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    renderSignedIn('/programs')
    const dialog = await openCreateDialog()
    const name = within(dialog).getByLabelText('Name')
    const key = within(dialog).getByLabelText('Key')

    await userEvent.type(name, 'Marketing Research')
    await userEvent.clear(key)
    await userEvent.type(key, 'mkt')
    expect(key).toHaveValue('MKT')

    await userEvent.type(name, ' Q4')
    expect(key).toHaveValue('MKT')

    await userEvent.clear(key)
    expect(within(dialog).getByText("2–10 letters or digits, starting with a letter. It can't be changed later.")).toBeInTheDocument()
    await userEvent.type(name, 'x')
    expect(key).toHaveValue('MRQ')
  })

  it("preselects the signed-in employee's own team", async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    expect(ownerSelect(dialog)).toBeEnabled()
  })

  it('requires an owner team when the employee has none', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    const calls = mockCreate(() => createdResponse(marketing))
    renderSignedIn('/programs')
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toBeEnabled())
    expect(ownerSelect(dialog)).toHaveTextContent('Pick a team')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await within(dialog).findByText('Pick the team that owns this program.')).toBeInTheDocument()
    expect(calls.bodies).toEqual([])
  })

  it('links to Teams when there are no teams at all', async () => {
    mockTeams(() => [])
    mockPrograms(() => [hiring])
    renderSignedIn('/programs')
    const dialog = await openCreateDialog()

    const link = await within(dialog).findByRole('link', { name: 'create a team' })
    expect(link).toHaveAttribute('href', '/teams')
    expect(ownerSelect(dialog)).toBeDisabled()

    await userEvent.click(link)
    await waitFor(() => expect(currentUrl()).toBe('/teams'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each(['1AB', 'A', 'MK-1'])('rejects the key %j without a request', async (value) => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    const calls = mockCreate(() => createdResponse(marketing))
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing')
    await userEvent.clear(within(dialog).getByLabelText('Key'))
    await userEvent.type(within(dialog).getByLabelText('Key'), value)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await within(dialog).findByText('Use 2–10 letters or digits, starting with a letter.')).toBeInTheDocument()
    expect(calls.bodies).toEqual([])
  })

  it('creates a program with the defaults, leaving out a blank description', async () => {
    mockTeams(() => [design, research])
    const queries = mockPrograms(() => [hiring])
    const calls = mockCreate(() => createdResponse({ ...marketing, key: 'MR', status: 'PLANNED', description: null }))
    renderSignedIn('/programs', { me: { teamId: research.id } })
    await screen.findByText('Hiring Drive')
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), '  Marketing Research ')
    await userEvent.type(within(dialog).getByLabelText('Description (optional)'), '   ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await screen.findByText('Program “Marketing Research” created')).toBeInTheDocument()
    expect(screen.getByText('Its task keys will start with MR-.')).toBeInTheDocument()
    expect(calls.bodies).toEqual([{ ownerTeamId: research.id, key: 'MR', name: 'Marketing Research', status: 'PLANNED' }])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(queries).toHaveLength(2))
  })

  it('sends the picked status, owner team and description', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    const calls = mockCreate(() => createdResponse(marketing))
    renderSignedIn('/programs')
    const dialog = await openCreateDialog()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await waitFor(() => expect(ownerSelect(dialog)).toBeEnabled())
    await selectOption(dialog, 'Owner team', 'Design')
    await selectOption(dialog, 'Status', 'Active')
    await userEvent.type(within(dialog).getByLabelText('Description (optional)'), 'Q4 research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    await screen.findByText('Program “Marketing Research” created')
    expect(calls.bodies).toEqual([
      { ownerTeamId: design.id, key: 'MR', name: 'Marketing Research', status: 'ACTIVE', description: 'Q4 research' },
    ])
  })

  it('sends the start and end dates when they are set', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    const calls = mockCreate(() => createdResponse(marketing))
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.type(within(dialog).getByLabelText('Start date (optional)'), '2026-10-01')
    await userEvent.type(within(dialog).getByLabelText('End date (optional)'), '2026-12-31')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    await screen.findByText('Program “Marketing Research” created')
    expect(calls.bodies).toEqual([
      {
        ownerTeamId: research.id,
        key: 'MR',
        name: 'Marketing Research',
        status: 'PLANNED',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
      },
    ])
  })

  it('shows INVALID_DATE_RANGE under End date', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    mockCreate(() =>
      HttpResponse.json({ error: 'endDate must be on or after startDate', code: 'INVALID_DATE_RANGE' }, { status: 400 }),
    )
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.type(within(dialog).getByLabelText('Start date (optional)'), '2026-12-31')
    await userEvent.type(within(dialog).getByLabelText('End date (optional)'), '2026-10-01')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await within(dialog).findByText('The end date must be on or after the start date.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('End date (optional)')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(within(dialog).getByLabelText('End date (optional)')).toHaveFocus())
  })

  it('goes to the first page after creating, where the new program is', async () => {
    mockTeams(() => [design, research])
    mockPrograms((url) =>
      url.searchParams.get('offset') === '20'
        ? HttpResponse.json({ data: [hiring], meta: { total: 21, limit: 20, offset: 20 } })
        : HttpResponse.json({ data: [marketing], meta: { total: 22, limit: 20, offset: 0 } }),
    )
    mockCreate(() => createdResponse(marketing))
    renderSignedIn('/programs?offset=20', { me: { teamId: research.id } })
    await screen.findByText('Hiring Drive')
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    await waitFor(() => expect(currentUrl()).toBe('/programs'))
    expect(await screen.findByText('Marketing Research')).toBeInTheDocument()
  })

  it('shows PROGRAM_KEY_EXISTS under Key and keeps the dialog open', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    mockCreate(() =>
      HttpResponse.json({ error: 'A program with key "MR" already exists', code: 'PROGRAM_KEY_EXISTS' }, { status: 409 }),
    )
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(
      await within(dialog).findByText(
        'Another program already uses this key. Keys of deleted programs stay taken too, so pick a different one.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(within(dialog).getByLabelText('Key')).toHaveFocus())
  })

  it('clears a deleted owner team on OWNER_TEAM_NOT_FOUND and refetches the teams', async () => {
    let teams = [design, research]
    const teamCalls = mockTeams(() => teams)
    mockPrograms(() => [hiring])
    mockCreate(() => {
      teams = [design]
      return HttpResponse.json(
        { error: 'Owner team not found or inactive', code: 'OWNER_TEAM_NOT_FOUND' },
        { status: 400 },
      )
    })
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    const callsBefore = teamCalls.count
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await within(dialog).findByText("The owner team doesn't exist or has been deleted.")).toBeInTheDocument()
    expect(ownerSelect(dialog)).toHaveTextContent('Pick a team')
    await waitFor(() => expect(ownerSelect(dialog)).toHaveFocus())
    await waitFor(() => expect(teamCalls.count).toBeGreaterThan(callsBefore))

    await userEvent.click(ownerSelect(dialog))
    expect(await screen.findByRole('option', { name: 'Design' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Research' })).not.toBeInTheDocument()
  })

  it.each([
    ['a field', [{ path: 'key', message: 'Key must start with a letter' }], 'Key must start with a letter'],
    ['the form', [{ path: '', message: 'Unrecognized key: "extra"' }], 'Unrecognized key: "extra"'],
  ])('puts 400 validation details on %s', async (_, details, text) => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    mockCreate(() => HttpResponse.json({ error: 'Validation failed', details }, { status: 400 }))
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await within(dialog).findByText(text)).toBeInTheDocument()
    if (details[0].path === 'key') expect(within(dialog).getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true')
    else expect(within(dialog).getByRole('alert')).toHaveTextContent(text)
  })

  it('shows a 403 in the dialog', async () => {
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    mockCreate(() => HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }))
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await within(dialog).findByText("You don't have permission to do that.")).toBeInTheDocument()
  })

  it("can't be closed while the request is pending", async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    mockTeams(() => [design, research])
    mockPrograms(() => [hiring])
    mockCreate(async () => {
      await held
      return createdResponse(marketing)
    })
    renderSignedIn('/programs', { me: { teamId: research.id } })
    const dialog = await openCreateDialog()

    await waitFor(() => expect(ownerSelect(dialog)).toHaveTextContent('Research'))
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Marketing Research')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create program' }))

    expect(await within(dialog).findByRole('button', { name: 'Creating program…' })).toBeDisabled()
    expect(within(dialog).getByLabelText('Name')).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Create a program' })).toBeInTheDocument()

    release()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
