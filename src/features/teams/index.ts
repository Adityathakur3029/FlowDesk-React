// Public entry of the teams feature: other features import from here only.
// No pages here: TeamsPage imports @/features/employees, so exporting it would create an import cycle.
export { teamKeys, useSetEmployeeTeam, useTeamDirectory, type TeamDirectory } from './api'
export type { Team } from './types'
