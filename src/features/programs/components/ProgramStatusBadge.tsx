import { ToneBadge } from '@/components/data/ToneBadge'
import { PROGRAM_STATUS_LABELS, PROGRAM_STATUS_TONES } from '../programStatus'
import type { ProgramStatus } from '../types'

// The label is always shown, so colour is never the only signal.
export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return <ToneBadge tone={PROGRAM_STATUS_TONES[status]}>{PROGRAM_STATUS_LABELS[status]}</ToneBadge>
}
