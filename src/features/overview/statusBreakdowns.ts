import { PROGRAM_STATUS_LABELS, PROGRAM_STATUS_TONES } from '@/features/programs'
import { TASK_STATUS_LABELS, TASK_STATUS_TONES } from '@/features/tasks'
import type { BreakdownItem } from './components/StatusBreakdown'
import type { OverviewReport } from './types'

type ProgramStatusKey = keyof OverviewReport['programsByStatus']
type TaskStatusKey = keyof OverviewReport['tasksByStatus']

// Segment order: violet, amber, blue, green, red. Not the contract's enum order, which puts violet next to blue
// (ΔE 1.3 under deuteranopia); this order passes the dataviz checker (spec 14). Both lists share it.
const PROGRAM_STATUS_ORDER = ['PLANNED', 'ON_HOLD', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const satisfies readonly ProgramStatusKey[]
const TASK_STATUS_ORDER = ['DISCUSSION', 'ON_HOLD', 'IN_PROGRESS', 'DONE', 'DEPENDENT'] as const satisfies readonly TaskStatusKey[]

export const programStatusItems = (counts: OverviewReport['programsByStatus']): BreakdownItem[] =>
  PROGRAM_STATUS_ORDER.map((status) => ({
    key: status,
    label: PROGRAM_STATUS_LABELS[status],
    tone: PROGRAM_STATUS_TONES[status],
    count: counts[status],
  }))

export const taskStatusItems = (counts: OverviewReport['tasksByStatus']): BreakdownItem[] =>
  TASK_STATUS_ORDER.map((status) => ({
    key: status,
    label: TASK_STATUS_LABELS[status],
    tone: TASK_STATUS_TONES[status],
    count: counts[status],
  }))
