import { ChevronsUpDown, LogOut } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { initials } from '@/lib/initials'
import { ROLE_LABELS } from '@/lib/roles'

// The account button at the bottom of the sidebar; collapsed, only the avatar shows. It has no tooltip:
// SidebarMenuButton's would wrap it in a Tooltip, which drops the props DropdownMenuTrigger passes down.
export function SidebarUserMenu() {
  const { employee, signOut } = useAuth()
  const { isMobile } = useSidebar()
  if (!employee) return null

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            aria-label={`Account menu for ${employee.name}`}
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar>
              <AvatarFallback>{initials(employee.name)}</AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate font-medium">{employee.name}</span>
              <span className="truncate text-xs text-muted-foreground">{ROLE_LABELS[employee.role]}</span>
            </span>
            <ChevronsUpDown className="ml-auto text-muted-foreground" aria-hidden="true" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        {/* Beside the sidebar on desktop; in the phone sheet there's no room beside it, so above. */}
        <DropdownMenuContent side={isMobile ? 'top' : 'right'} align="end" sideOffset={4} className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
            <span className="truncate font-medium text-foreground">{employee.name}</span>
            <span className="truncate text-xs text-muted-foreground">{employee.emailId}</span>
            <Badge variant="secondary" className="mt-1">
              {ROLE_LABELS[employee.role]}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
