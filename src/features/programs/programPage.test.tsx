import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { Team } from '@/features/teams'
import { api, currentUrl, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Program } from './types'

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
  const calls = { count: 0 }
  server.use(
    http.get(api('/programs/:programId'), () => {
      calls.count += 1
      const result = respond()
      return result instanceof Response ? result : HttpResponse.json({ data: result })
    }),
    http.get(api('/teams'), () => HttpResponse.json({ data: [research], meta: { total: 1, limit: 100, offset: 0 } })),
    http.get(api('/programs/:programId/comments'), () =>
      HttpResponse.json({ data: [], meta: { total: 0, limit: 20, offset: 0 } }),
    ),
  )
  return calls
}

const details = () => within(screen.getByRole('complementary', { name: 'Program details' }))

function detail(label: string) {
  const term = details().getByText(label, { selector: 'dt' })
  return term.nextElementSibling as HTMLElement
}

describe('ProgramPage', () => {
  it('shows the program, its details, comments and the analytics placeholder', async () => {
    mockProgram(() => marketing)
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
    expect(screen.getByRole('heading', { name: 'Comments' })).toBeInTheDocument()
    expect(await screen.findByText('No comments yet')).toBeInTheDocument()

    // The sidebar keeps Programs active on a program's page.
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Programs' })).toHaveAttribute(
      'aria-current',
      'page',
    )
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
