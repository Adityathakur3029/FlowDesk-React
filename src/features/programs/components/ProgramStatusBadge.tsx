import { Badge } from '@/components/ui/badge'
import { PROGRAM_STATUS_LABELS, PROGRAM_STATUS_VARIANTS } from '../programStatus'
import type { ProgramStatus } from '../types'

// The label is always shown, so colour is never the only signal.
export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return <Badge variant={PROGRAM_STATUS_VARIANTS[status]}>{PROGRAM_STATUS_LABELS[status]}</Badge>
}
