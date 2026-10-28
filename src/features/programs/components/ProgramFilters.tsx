import { ToneDot } from '@/components/data/ToneBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PROGRAM_STATUSES, PROGRAM_STATUS_LABELS, PROGRAM_STATUS_TONES } from '../programStatus'
import { DEFAULT_PROGRAM_SEARCH, hasProgramFilters, type ProgramSearch } from '../searchParams'
import type { ProgramStatus } from '../types'

const ALL = 'ALL'

interface ProgramFiltersProps {
  search: ProgramSearch
  onChange: (search: ProgramSearch) => void
}

// Every filter change goes back to the first page. GET /programs takes one status, so it's a single select.
export function ProgramFilters({ search, onChange }: ProgramFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="programs-status-filter">Status</Label>
        <Select
          value={search.status ?? ALL}
          onValueChange={(value) =>
            onChange({ ...search, status: value === ALL ? undefined : (value as ProgramStatus), offset: 0 })
          }
        >
          <SelectTrigger id="programs-status-filter" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {PROGRAM_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <ToneDot tone={PROGRAM_STATUS_TONES[status]} />
                {PROGRAM_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasProgramFilters(search) && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_PROGRAM_SEARCH)}>
          Clear filter
        </Button>
      )}
    </div>
  )
}
