import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, currentUrl, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'
import { formatRange } from './format'
import type { OverviewReport } from './types'

// The contract's OverviewReport example (GET /reports/overview, 200).
const trendValues: [string, string, number, number][] = [
  ['2026-07-22', '2026-07-26', 3, 1],
  ['2026-07-27', '2026-08-02', 4, 2],
  ['2026-08-03', '2026-08-09', 5, 3],
  ['2026-08-10', '2026-08-16', 4, 2],
  ['2026-08-17', '2026-08-23', 6, 3],
  ['2026-08-24', '2026-08-30', 3, 2],
  ['2026-08-31', '2026-09-06', 4, 3],
  ['2026-09-07', '2026-09-13', 5, 3],
  ['2026-09-14', '2026-09-20', 4, 2],
  ['2026-09-21', '2026-09-27', 5, 4],
  ['2026-09-28', '2026-10-04', 4, 3],
  ['2026-10-05', '2026-10-11', 5, 4],
  ['2026-10-12', '2026-10-18', 4, 3],
  ['2026-10-19', '2026-10-20', 2, 2],
]
const research = { id: '3f2c8b1e-6d4a-4b7e-9c21-5a8e7d0f1b23', name: 'Research' }
const operations = { id: '7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Operations' }
const report: OverviewReport = {
  period: { from: '2026-07-22', to: '2026-10-20', days: 91, granularity: 'week' },
  previousPeriod: { from: '2026-04-22', to: '2026-07-21', days: 91 },
  asOf: '2026-10-20',
  totals: {
    programs: 4,
    programsCompleted: 1,
    programsAtRisk: 1,
    tasksCreated: 58,
    tasksCreatedPrevious: 41,
    tasksCompleted: 37,
    tasksCompletedPrevious: 30,
    tasksCompletedWithDueDate: 29,
    tasksCompletedOnTime: 22,
    openTasks: 44,
    overdueTasks: 7,
  },
  programsByStatus: { PLANNED: 1, ACTIVE: 2, ON_HOLD: 0, COMPLETED: 1, CANCELLED: 0 },
  tasksByStatus: { DISCUSSION: 9, ON_HOLD: 4, IN_PROGRESS: 21, DONE: 37, DEPENDENT: 10 },
  openTasksByPriority: { HIGHEST: 3, HIGH: 11, MEDIUM: 20, LOW: 8, LOWEST: 2 },
  trend: trendValues.map(([start, end, created, completed]) => ({ start, end, created, completed })),
  teams: [
    { teamId: operations.id, name: operations.name, programs: 1, tasksCompleted: 10, openTasks: 18, overdueTasks: 3 },
    { teamId: research.id, name: research.name, programs: 2, tasksCompleted: 27, openTasks: 18, overdueTasks: 4 },
    { teamId: null, name: null, programs: 1, tasksCompleted: 0, openTasks: 8, overdueTasks: 0 },
  ],
  programs: [
    {
      id: '5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14',
      key: 'MKT',
      name: 'Marketing Research',
      status: 'ACTIVE',
      ownerTeam: research,
      startDate: '2026-07-01',
      endDate: '2026-10-15',
      completedAt: null,
      tasksTotal: 40,
      tasksDone: 22,
      tasksCompletedInPeriod: 18,
      openTasks: 18,
      overdueTasks: 4,
      atRisk: true,
    },
    {
      id: 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f',
      key: 'OPS',
      name: 'Operations Revamp',
      status: 'ACTIVE',
      ownerTeam: operations,
      startDate: '2026-08-01',
      endDate: '2026-12-31',
      completedAt: null,
      tasksTotal: 30,
      tasksDone: 12,
      tasksCompletedInPeriod: 10,
      openTasks: 18,
      overdueTasks: 3,
      atRisk: false,
    },
    {
      id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
      key: 'ONB',
      name: 'Onboarding Guide',
      status: 'PLANNED',
      ownerTeam: null,
      startDate: null,
      endDate: null,
      completedAt: null,
      tasksTotal: 8,
      tasksDone: 0,
      tasksCompletedInPeriod: 0,
      openTasks: 8,
      overdueTasks: 0,
      atRisk: false,
    },
    {
      id: '1e2d3c4b-5a69-4788-9a0b-c1d2e3f4a5b6',
      key: 'SRV',
      name: 'Survey Program',
      status: 'COMPLETED',
      ownerTeam: research,
      startDate: '2026-06-01',
      endDate: '2026-09-30',
      completedAt: '2026-09-29T16:20:00.000Z',
      tasksTotal: 9,
      tasksDone: 9,
      tasksCompletedInPeriod: 9,
      openTasks: 0,
      overdueTasks: 0,
      atRisk: false,
    },
  ],
}

const emptyReport: OverviewReport = {
  ...report,
  totals: Object.fromEntries(Object.keys(report.totals).map((key) => [key, 0])) as OverviewReport['totals'],
  programsByStatus: { PLANNED: 0, ACTIVE: 0, ON_HOLD: 0, COMPLETED: 0, CANCELLED: 0 },
  tasksByStatus: { DISCUSSION: 0, ON_HOLD: 0, IN_PROGRESS: 0, DONE: 0, DEPENDENT: 0 },
  openTasksByPriority: { HIGHEST: 0, HIGH: 0, MEDIUM: 0, LOW: 0, LOWEST: 0 },
  trend: report.trend.map((bucket) => ({ ...bucket, created: 0, completed: 0 })),
  teams: [],
  programs: [],
}

// GET /reports/overview: records each query string and answers with `respond`.
function mockOverview(respond: (url: URL) => Response | OverviewReport | Promise<Response | OverviewReport> = () => report) {
  const queries: string[] = []
  server.use(
    http.get(api('/reports/overview'), async ({ request }) => {
      const url = new URL(request.url)
      queries.push(url.search.slice(1))
      const result = await respond(url)
      return result instanceof Response ? result : HttpResponse.json({ data: result })
    }),
  )
  return queries
}

async function openOverview(path = '/overview') {
  renderSignedIn(path)
  await screen.findByRole('heading', { level: 1, name: 'Overview' })
}

const tile = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement as HTMLElement
const legendRows = (name: string) =>
  within(screen.getByRole('list', { name })).getAllByRole('listitem').map((item) => item.textContent)

// "Today" is 20 Oct 2026 in the browser's zone. Only Date is faked; timers stay real for MSW and user-event.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 20, 12))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('OverviewPage', () => {
  it('is in the sidebar, below Programs', async () => {
    mockOverview()
    await openOverview()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Programs', 'Overview', 'People', 'Teams'])
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })

  it('reports the last 12 months by default, with the headline numbers', async () => {
    const queries = mockOverview()
    await openOverview()

    expect(await screen.findByText('Programs running', { selector: 'dt' })).toBeInTheDocument()
    expect(queries).toEqual(['from=2025-10-21&to=2026-10-20'])
    expect(screen.getByText(`How the organisation is doing, ${formatRange('2025-10-21', '2026-10-20')}.`)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent('Last 12 months')

    expect(tile('Programs running')).toHaveTextContent('42 active now')
    expect(tile('Programs completed')).toHaveTextContent('1In this period')
    expect(tile('Tasks created')).toHaveTextContent('58Up 41% vs the previous period')
    expect(tile('Tasks completed')).toHaveTextContent('37Up 23% vs the previous period')
    expect(tile('On-time delivery')).toHaveTextContent('76%22 of 29 with a due date')
    expect(tile('Overdue now')).toHaveTextContent('71 program at risk · 44 open')
  })

  it('breaks programs and tasks down by status, in the validated colour order', async () => {
    mockOverview()
    await openOverview()
    await screen.findByRole('list', { name: 'Programs by status' })

    expect(legendRows('Programs by status')).toEqual(['Planned125%', 'On hold00%', 'Active250%', 'Completed125%', 'Cancelled00%'])
    expect(legendRows('Tasks by status')).toEqual(['Discussion911%', 'On hold45%', 'In progress2126%', 'Done3746%', 'Dependent1012%'])
    expect(legendRows('Open tasks by priority')).toEqual([
      'Highest3 open tasks',
      'High11 open tasks',
      'Medium20 open tasks',
      'Low8 open tasks',
      'Lowest2 open tasks',
    ])
  })

  it('shows the trend as a table, with totals', async () => {
    mockOverview()
    await openOverview()
    await userEvent.click(await screen.findByRole('button', { name: 'Show table' }))

    const table = screen.getByRole('table', { name: 'Tasks created and completed per week' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(16) // header, 14 weeks, total
    expect(rows[1]).toHaveTextContent(`${formatRange('2026-07-22', '2026-07-26')}31`)
    expect(rows[15]).toHaveTextContent('Total5837')
    expect(screen.getByRole('button', { name: 'Show chart' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists teams and programs in the server order', async () => {
    mockOverview()
    await openOverview()

    const teams = within(await screen.findByRole('list', { name: 'By team' })).getAllByRole('listitem')
    expect(teams.map((team) => team.textContent)).toEqual([
      'Operations1 program · 18 open · 3 overdue10 tasks completed',
      'Research2 programs · 18 open · 4 overdue27 tasks completed',
      'No owner team1 program · 8 open · 0 overdue0 tasks completed',
    ])

    const programs = within(screen.getByRole('table', { name: 'Programs that ran in the period' })).getAllByRole('row').slice(1)
    expect(programs).toHaveLength(4)
    expect(within(programs[0]).getByRole('link', { name: 'MKT Marketing Research' })).toHaveAttribute(
      'href',
      '/programs/5b1f6a3e-8c1d-4f8e-9a51-2a7c3d9e0b14',
    )
    expect(programs[0]).toHaveTextContent('22 of 40 tasks done')
    expect(within(programs[0]).getByText('At risk')).toBeInTheDocument()
    expect(programs[2]).toHaveTextContent('No owner team')
    expect(programs[2]).toHaveTextContent('Not set')
    expect(within(programs[3]).getByText('Completed')).toBeInTheDocument()
  })

  it('keeps the last report, dimmed, while the next period loads', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const queries = mockOverview(async (url) => {
      if (url.searchParams.get('from') === '2026-07-21') await gate
      return report
    })
    await openOverview()
    await screen.findByText('Programs running', { selector: 'dt' })

    await userEvent.click(screen.getByRole('combobox', { name: 'Period' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Last 3 months' }))

    await waitFor(() => expect(currentUrl()).toBe('/overview?period=3m'))
    expect(queries).toEqual(['from=2025-10-21&to=2026-10-20', 'from=2026-07-21&to=2026-10-20'])
    const content = tile('Programs running').closest('[aria-busy]')
    expect(content).toHaveAttribute('aria-busy', 'true')
    release()
    await waitFor(() => expect(content).toHaveAttribute('aria-busy', 'false'))
  })

  it('applies a custom range, prefilled with the current dates', async () => {
    const queries = mockOverview()
    await openOverview()
    await screen.findByText('Programs running', { selector: 'dt' })

    await userEvent.click(screen.getByRole('combobox', { name: 'Period' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Custom range' }))
    const from = screen.getByLabelText('From')
    const to = screen.getByLabelText('To')
    expect(from).toHaveValue('2025-10-21')
    expect(to).toHaveValue('2026-10-20')

    fireEvent.change(from, { target: { value: '2026-01-01' } })
    fireEvent.change(to, { target: { value: '2026-03-31' } })
    expect(queries).toHaveLength(1) // nothing sent before Apply
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(currentUrl()).toBe('/overview?period=custom&from=2026-01-01&to=2026-03-31'))
    expect(queries).toEqual(['from=2025-10-21&to=2026-10-20', 'from=2026-01-01&to=2026-03-31'])
    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent('Custom range')
  })

  it("doesn't send a range that ends before it starts", async () => {
    const queries = mockOverview()
    await openOverview('/overview?period=custom&from=2026-01-01&to=2026-03-31')
    await screen.findByText('Programs running', { selector: 'dt' })

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-04-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(screen.getByRole('alert')).toHaveTextContent('The start date must be on or before the end date.')
    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true')
    expect(queries).toEqual(['from=2026-01-01&to=2026-03-31'])
  })

  it('shows DATE_RANGE_TOO_LONG under the custom range', async () => {
    mockOverview(() =>
      HttpResponse.json(
        { error: 'The date range can be at most 1096 days', code: 'DATE_RANGE_TOO_LONG' },
        { status: 400 },
      ),
    )
    await openOverview('/overview?period=custom&from=2020-01-01&to=2026-10-20')

    expect(await screen.findByRole('alert')).toHaveTextContent('The period can be at most three years.')
    expect(screen.getByText('No report for these dates')).toBeInTheDocument()
    expect(screen.getByLabelText('From')).toHaveValue('2020-01-01')
  })

  it('says when there is nothing to report', async () => {
    mockOverview(() => emptyReport)
    await openOverview('/overview?period=1m')

    expect(await screen.findByText('Nothing to report for this period')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Programs' })).toHaveAttribute('href', '/programs')
  })

  it('shows an error with retry on a 500', async () => {
    let fail = true
    mockOverview(() => (fail ? HttpResponse.json({ error: 'Internal server error' }, { status: 500 }) : report))
    await openOverview()

    expect(await screen.findByText("Couldn't load the overview", {}, { timeout: 10_000 })).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Programs running', { selector: 'dt' })).toBeInTheDocument()
  })
})
