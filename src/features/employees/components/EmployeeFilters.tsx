import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { TeamDirectory } from '@/features/teams'
import { ROLE_LABELS } from '@/lib/roles'
import { DEFAULT_EMPLOYEE_SEARCH, hasEmployeeFilters, type EmployeeSearch } from '../searchParams'
import type { EmployeeRole } from '../types'

const ALL = 'ALL'
const NO_TEAM = 'none' // GET /employees?teamId=none: people not in any team
const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'MEMBER'] as const

interface EmployeeFiltersProps {
  search: EmployeeSearch
  teams?: TeamDirectory
  onChange: (search: EmployeeSearch) => void
}

// Every filter change goes back to the first page.
export function EmployeeFilters({ search, teams, onChange }: EmployeeFiltersProps) {
  // Keep a team id from the URL visible even when it isn't (or isn't yet) in the directory.
  const unknownTeam =
    search.teamId !== undefined && search.teamId !== NO_TEAM && !teams?.byId.has(search.teamId)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="people-role-filter">Role</Label>
        <Select
          value={search.role ?? ALL}
          onValueChange={(value) =>
            onChange({ ...search, role: value === ALL ? undefined : (value as EmployeeRole), offset: 0 })
          }
        >
          <SelectTrigger id="people-role-filter" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {ROLE_OPTIONS.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="people-team-filter">Team</Label>
        <Select
          value={search.teamId ?? ALL}
          onValueChange={(value) => onChange({ ...search, teamId: value === ALL ? undefined : value, offset: 0 })}
        >
          <SelectTrigger id="people-team-filter" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All teams</SelectItem>
            <SelectItem value={NO_TEAM}>No team</SelectItem>
            {unknownTeam && <SelectItem value={search.teamId!}>Unknown team</SelectItem>}
            {teams?.teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
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
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_EMPLOYEE_SEARCH)}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
