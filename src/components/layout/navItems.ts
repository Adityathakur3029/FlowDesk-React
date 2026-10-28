import { ChartColumn, FolderKanban, SquareKanban, Users, UsersRound, type LucideIcon } from 'lucide-react'
import type { Role } from '@/auth/types'
import { paths } from '@/routes/paths'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  // Omitted = every signed-in role. UX only: each page still handles a 403.
  roles?: readonly Role[]
}

// Add a section by appending here; AppSidebar needs no change.
export const navItems: NavItem[] = [
  { label: 'Programs', to: paths.programs, icon: FolderKanban },
  // Any active employee may read boards (GET /boards) and work on their tasks, so no roles.
  { label: 'Boards', to: paths.boards, icon: SquareKanban },
  // Any active employee may read the report (GET /reports/overview), so no roles.
  { label: 'Overview', to: paths.overview, icon: ChartColumn },
  { label: 'People', to: paths.people, icon: Users },
  { label: 'Teams', to: paths.teams, icon: UsersRound },
]

export function visibleNavItems(items: readonly NavItem[], role: Role | undefined): NavItem[] {
  return items.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)))
}
