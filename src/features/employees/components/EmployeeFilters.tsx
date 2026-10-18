import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ROLE_LABELS } from '@/lib/roles'
import { hasEmployeeFilters, type EmployeeSearch } from '../searchParams'
import type { EmployeeRole } from '../types'

const ALL_ROLES = 'ALL'
const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'MEMBER'] as const

interface EmployeeFiltersProps {
  search: EmployeeSearch
  onChange: (search: EmployeeSearch) => void
}

// Every filter change goes back to the first page.
export function EmployeeFilters({ search, onChange }: EmployeeFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="people-role-filter">Role</Label>
        <Select
          value={search.role ?? ALL_ROLES}
          onValueChange={(value) =>
            onChange({ ...search, role: value === ALL_ROLES ? undefined : (value as EmployeeRole), offset: 0 })
          }
        >
          <SelectTrigger id="people-role-filter" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ROLES}>All roles</SelectItem>
            {ROLE_OPTIONS.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="people-include-inactive"
          checked={search.includeInactive}
          onCheckedChange={(checked) => onChange({ ...search, includeInactive: checked, offset: 0 })}
        />
        <Label htmlFor="people-include-inactive">Include inactive</Label>
      </div>

      {hasEmployeeFilters(search) && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ includeInactive: false, offset: 0 })}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
