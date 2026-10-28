import type { Tone } from '@/lib/tones'
import type { ProgramStatus } from './types'

// Contract enum order, which is also the Status select's order. Any status can move to any other.
export const PROGRAM_STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const satisfies readonly ProgramStatus[]

// Display only.
export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

// Same meaning as the task statuses' colours (lib/tones.ts).
export const PROGRAM_STATUS_TONES: Record<ProgramStatus, Tone> = {
  PLANNED: 'violet',
  ACTIVE: 'blue',
  ON_HOLD: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
}
