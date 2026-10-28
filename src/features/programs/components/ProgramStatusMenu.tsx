import { ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/api/errors'
import { ToneBadge, ToneDot } from '@/components/data/ToneBadge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateProgram } from '../api'
import { PROGRAM_STATUSES, PROGRAM_STATUS_LABELS, PROGRAM_STATUS_TONES } from '../programStatus'
import type { Program, ProgramStatus } from '../types'

// Jira-style: the status badge opens a menu, and picking a status saves it right away (PATCH { status }).
// Any status can move to any other (contract). The page only shows this to ADMIN and MANAGER.
export function ProgramStatusMenu({ program }: { program: Program }) {
  const update = useUpdateProgram(program.id)
  // Shows the picked status while it saves; a failed save falls back to the stored one.
  const status = update.isPending ? (update.variables.status ?? program.status) : program.status
  const label = PROGRAM_STATUS_LABELS[status]

  function change(value: string) {
    const next = value as ProgramStatus
    if (next === program.status) return
    update.mutate(
      { status: next },
      {
        onSuccess: (saved) => toast.success(`Status changed to ${PROGRAM_STATUS_LABELS[saved.status]}`),
        onError: (error) =>
          // A 404 means it was deleted meanwhile; the page refetches it and shows "Program not found".
          toast.error(isApiError(error) && error.status === 404 ? 'This program has been deleted.' : getErrorMessage(error)),
      },
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={update.isPending}
          aria-label={`Status: ${label}. Change status`}
          className="rounded-4xl outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress"
        >
          <ToneBadge tone={PROGRAM_STATUS_TONES[status]}>
            {label}
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </ToneBadge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel>Change status</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={change}>
          {PROGRAM_STATUSES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              <ToneDot tone={PROGRAM_STATUS_TONES[option]} className="size-2" />
              {PROGRAM_STATUS_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
