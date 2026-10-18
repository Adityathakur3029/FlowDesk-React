import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, currentUrl, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import type { Employee } from './types'

const ravi: Employee = {
  ...janeDoe,
  id: '0f8b6c1e-2a3d-4e5f-8a9b-1c2d3e4f5a6b',
  emailId: 'ravi.kumar@saajha.org',
  name: 'Ravi Kumar',
  role: 'MEMBER',
  isActive: false,
}

const page = (data: Employee[], meta: { total: number; offset?: number }) =>
  HttpResponse.json({ data, meta: { limit: 20, offset: 0, ...meta } })

// Answers GET /employees with `respond` and records each request's query string.
function mockEmployees(respond: (url: URL) => Response) {
  const queries: string[] = []
  server.use(
    http.get(api('/employees'), ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.search.slice(1))
      return respond(url)
    }),
  )
  return queries
}

describe('PeoplePage', () => {
  it('lists employees with role, joined date and badges', async () => {
    mockEmployees(() => page([janeDoe, ravi], { total: 2 }))
    renderSignedIn('/people')

    const janeRow = (await screen.findByText('jane.doe@saajha.org')).closest('tr')!
    expect(within(janeRow).getByText('Jane Doe')).toBeInTheDocument()
    expect(within(janeRow).getByText('You')).toBeInTheDocument()
    expect(within(janeRow).getByText('Manager')).toBeInTheDocument()
    expect(within(janeRow).getByText(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(janeDoe.createdAt)))).toBeInTheDocument()

    const raviRow = screen.getByText('ravi.kumar@saajha.org').closest('tr')!
    expect(within(raviRow).getByText('Inactive')).toBeInTheDocument()
    expect(within(raviRow).queryByText('You')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('sends the URL filters and page to the API', async () => {
    const queries = mockEmployees(() => page([ravi], { total: 21, offset: 20 }))
    renderSignedIn('/people?role=MEMBER&includeInactive=true&offset=20')
    await screen.findByText('ravi.kumar@saajha.org')
    expect(queries).toEqual(['role=MEMBER&includeInactive=true&limit=20&offset=20'])
  })

  it('resets to the first page when a filter changes', async () => {
    mockEmployees(() => page([janeDoe], { total: 25, offset: 20 }))
    renderSignedIn('/people?offset=20')
    await screen.findByText('jane.doe@saajha.org')

    await userEvent.click(screen.getByRole('switch', { name: 'Include inactive' }))
    expect(currentUrl()).toBe('/people?includeInactive=true')

    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Admin' }))
    expect(currentUrl()).toBe('/people?role=ADMIN&includeInactive=true')
  })

  it('pages through results', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => ({ ...ravi, id: `id-${i}`, emailId: `p${i}@saajha.org` }))
    mockEmployees((url) => {
      const offset = Number(url.searchParams.get('offset'))
      return page(offset === 40 ? twenty.slice(0, 5) : twenty, { total: 45, offset })
    })
    renderSignedIn('/people?offset=20')

    expect(await screen.findByText('Showing 21–40 of 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Showing 41–45 of 45')).toBeInTheDocument()
    expect(currentUrl()).toBe('/people?offset=40')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('offers to clear filters when nothing matches', async () => {
    mockEmployees((url) => (url.searchParams.has('role') ? page([], { total: 0 }) : page([janeDoe], { total: 1 })))
    renderSignedIn('/people?role=ADMIN')

    expect(await screen.findByText('No people match these filters')).toBeInTheDocument()
    // Two "Clear filters" buttons: the filter bar's and the empty state's.
    const buttons = screen.getAllByRole('button', { name: 'Clear filters' })
    await userEvent.click(buttons[buttons.length - 1])
    expect(currentUrl()).toBe('/people')
    expect(await screen.findByText('jane.doe@saajha.org')).toBeInTheDocument()
  })

  it('offers the first page when the requested page is past the end', async () => {
    mockEmployees((url) => (url.searchParams.get('offset') === '200' ? page([], { total: 3, offset: 200 }) : page([janeDoe], { total: 3 })))
    renderSignedIn('/people?offset=200')

    expect(await screen.findByText('This page is empty')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to first page' }))
    expect(currentUrl()).toBe('/people')
    expect(await screen.findByText('jane.doe@saajha.org')).toBeInTheDocument()
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockEmployees(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : page([janeDoe], { total: 1 })))
    renderSignedIn('/people')

    expect(await screen.findByText("Couldn't load people")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('jane.doe@saajha.org')).toBeInTheDocument()
  })

  it.each([
    ['MEMBER', false],
    ['MANAGER', true],
    ['ADMIN', true],
  ] as const)('as %s, the Invite member button is shown: %s', async (role, shown) => {
    mockEmployees(() => page([janeDoe], { total: 1 }))
    renderSignedIn('/people', { role })
    await screen.findByText('jane.doe@saajha.org')
    expect(screen.queryByRole('button', { name: 'Invite member' }) !== null).toBe(shown)
  })
})
