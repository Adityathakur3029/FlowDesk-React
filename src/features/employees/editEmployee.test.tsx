import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Role } from '@/auth/types'
import type { Team } from '@/features/teams'
import { api, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Employee } from './types'

const design: Team = {
  id: '3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23',
  createdAt: '2026-10-17T09:00:00.000Z',
  updatedAt: '2026-10-17T09:00:00.000Z',
  isActive: true,
  name: 'Design',
  description: null,
  memberCount: 1,
}
const research: Team = { ...design, id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', name: 'Research' }

const ravi: Employee = {
  ...janeDoe,
  id: '0f8b6c1e-2a3d-4e5f-8a9b-1c2d3e4f5a6b',
  name: 'Ravi Kumar',
  emailId: 'ravi.kumar@saajha.org',
  role: 'MEMBER',
  teamId: design.id,
}

beforeEach(() => {
  server.use(
    http.get(api('/employees'), () => HttpResponse.json({ data: [janeDoe, ravi], meta: { total: 2, limit: 20, offset: 0 } })),
    http.get(api('/teams'), () => HttpResponse.json({ data: [design, research], meta: { total: 2, limit: 100, offset: 0 } })),
  )
})

// Records PATCH /employees/{id} and the membership calls. `patch` / `put` override the answer;
// returning null (or leaving them out) means the normal 200.
function mockSaves({ patch, put }: { patch?: () => Response | null; put?: () => Response | null } = {}) {
  const calls = { patches: [] as unknown[], puts: [] as string[], deletes: [] as string[] }
  server.use(
    http.patch(api('/employees/:id'), async ({ request }) => {
      const body = (await request.json()) as Partial<Employee>
      calls.patches.push(body)
      return patch?.() ?? HttpResponse.json({ data: { ...ravi, ...body } })
    }),
    http.put(api('/teams/:teamId/members/:employeeId'), ({ params }) => {
      calls.puts.push(`${params.teamId}/${params.employeeId}`)
      return put?.() ?? HttpResponse.json({ data: { employee: ravi, previousTeamId: design.id } })
    }),
    http.delete(api('/teams/:teamId/members/:employeeId'), ({ params }) => {
      calls.deletes.push(`${params.teamId}/${params.employeeId}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

async function openEdit(name: string, role: Role = 'ADMIN') {
  renderSignedIn('/people', { role })
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }))
  const dialog = await screen.findByRole('dialog', { name: `Edit ${name}` })
  // The team select is enabled once the directory has loaded.
  await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Team' })).toBeEnabled())
  return dialog
}

async function choose(dialog: HTMLElement, field: string, option: string) {
  await userEvent.click(within(dialog).getByRole('combobox', { name: field }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

const save = (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

describe('EditEmployeeDialog', () => {
  it('shows each row\'s team, and Edit only to ADMIN and MANAGER', async () => {
    renderSignedIn('/people', { role: 'MEMBER' })
    const raviRow = (await screen.findByText('ravi.kumar@saajha.org')).closest('tr')!
    expect(await within(raviRow).findByText('Design')).toBeInTheDocument()
    const janeRow = screen.getByText('jane.doe@saajha.org').closest('tr')!
    expect(within(janeRow).getByText('No team')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
  })

  it('as ADMIN, sends only the changed details', async () => {
    const calls = mockSaves()
    const dialog = await openEdit('Ravi Kumar')
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeDisabled()

    const name = within(dialog).getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, ' Ravi K ')
    await choose(dialog, 'Role', 'Manager')
    await save(dialog)

    expect(await screen.findByText('Saved changes to Ravi K')).toBeInTheDocument()
    expect(calls.patches).toEqual([{ name: 'Ravi K', role: 'MANAGER' }])
    expect(calls.puts).toEqual([])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('changes only the team with a PUT, and clears it with a DELETE', async () => {
    const calls = mockSaves()
    let dialog = await openEdit('Ravi Kumar')
    await choose(dialog, 'Team', 'Research')
    await save(dialog)
    expect(await screen.findByText('Saved changes to Ravi Kumar')).toBeInTheDocument()
    expect(calls.patches).toEqual([])
    expect(calls.puts).toEqual([`${research.id}/${ravi.id}`])

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Edit Ravi Kumar' }))
    dialog = await screen.findByRole('dialog', { name: 'Edit Ravi Kumar' })
    await choose(dialog, 'Team', 'No team')
    await save(dialog)
    await waitFor(() => expect(calls.deletes).toEqual([`${design.id}/${ravi.id}`]))
  })

  it('as MANAGER, only the team can be changed', async () => {
    const dialog = await openEdit('Ravi Kumar', 'MANAGER')
    expect(within(dialog).getByLabelText('Name')).toBeDisabled()
    expect(within(dialog).getByRole('combobox', { name: 'Role' })).toBeDisabled()
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeDisabled()
    expect(within(dialog).getAllByText('Only admins can change this.').length).toBeGreaterThan(0)
    expect(within(dialog).getByRole('combobox', { name: 'Team' })).toBeEnabled()
  })

  it('on their own row, an ADMIN can rename but not change role or status', async () => {
    const dialog = await openEdit('Jane Doe')
    expect(within(dialog).getByLabelText('Name')).toBeEnabled()
    expect(within(dialog).getByRole('combobox', { name: 'Role' })).toBeDisabled()
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeDisabled()
  })

  it('locks the team while the employee is set inactive', async () => {
    const dialog = await openEdit('Ravi Kumar')
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
    expect(within(dialog).getByRole('combobox', { name: 'Team' })).toBeDisabled()
    expect(within(dialog).getByText('Reactivate them to change their team.')).toBeInTheDocument()
  })

  it.each([
    ['LAST_ADMIN', 'There has to be at least one active admin. Make someone else an admin first.'],
    ['SELF_LOCKOUT', "You can't change your own role or deactivate yourself."],
  ])('shows 409 %s in the dialog', async (code, text) => {
    mockSaves({ patch: () => HttpResponse.json({ error: 'Conflict', code }, { status: 409 }) })
    const dialog = await openEdit('Ravi Kumar')
    await choose(dialog, 'Role', 'Admin')
    await save(dialog)
    expect(await within(dialog).findByText(text)).toBeInTheDocument()
  })

  it('keeps saved details when the team change fails, and retries only the team', async () => {
    let failPut = true
    const calls = mockSaves({
      put: () => (failPut ? HttpResponse.json({ error: 'Team not found' }, { status: 404 }) : null),
    })
    const dialog = await openEdit('Ravi Kumar')
    const name = within(dialog).getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Ravi K')
    await choose(dialog, 'Team', 'Research')
    await save(dialog)

    expect(
      await within(dialog).findByText("Saved Ravi K's details, but their team couldn't be changed: Team not found"),
    ).toBeInTheDocument()

    failPut = false
    await save(dialog)
    expect(await screen.findByText('Saved changes to Ravi K')).toBeInTheDocument()
    expect(calls.patches).toHaveLength(1)
    expect(calls.puts).toHaveLength(2)
  })
})
