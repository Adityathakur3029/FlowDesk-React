import type { ComponentProps } from 'react'
import type { Badge } from '@/components/ui/badge'
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

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

export const PROGRAM_STATUS_VARIANTS: Record<ProgramStatus, BadgeVariant> = {
  PLANNED: 'outline',
  ACTIVE: 'default',
  ON_HOLD: 'secondary',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
}
