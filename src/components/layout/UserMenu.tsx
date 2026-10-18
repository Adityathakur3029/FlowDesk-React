import { LogOut } from 'lucide-react'
import { useAuth } from '@/auth/useAuth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS } from '@/lib/roles'

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export function UserMenu() {
  const { employee, signOut } = useAuth()
  if (!employee) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label={`Account menu for ${employee.name}`}>
          <Avatar>
            <AvatarFallback>{initials(employee.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
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
  )
}
