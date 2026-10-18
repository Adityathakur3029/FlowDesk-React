import { Users, UsersRound, type LucideIcon } from 'lucide-react'
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
  { label: 'People', to: paths.people, icon: Users },
  { label: 'Teams', to: paths.teams, icon: UsersRound },
]

export function visibleNavItems(items: readonly NavItem[], role: Role | undefined): NavItem[] {
  return items.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)))
}
