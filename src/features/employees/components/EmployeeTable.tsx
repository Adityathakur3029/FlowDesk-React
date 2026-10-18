import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROLE_LABELS } from '@/lib/roles'
import { cn } from '@/lib/utils'
import type { Employee } from '../types'

const joinedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const SKELETON_ROWS = 5

interface EmployeeTableProps {
  employees?: readonly Employee[]
  currentEmployeeId?: string
  // A newer page is loading while this one stays on screen.
  busy?: boolean
}

export function EmployeeTable({ employees, currentEmployeeId, busy = false }: EmployeeTableProps) {
  return (
    // The table scrolls sideways inside its container on narrow screens, never the page.
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-busy={busy || employees === undefined} className={cn(busy && 'opacity-60 transition-opacity')}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees === undefined
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{employee.name}</span>
                      {employee.id === currentEmployeeId && <Badge variant="outline">You</Badge>}
                      {!employee.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{employee.emailId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[employee.role]}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{joinedFormat.format(new Date(employee.createdAt))}</TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  )
}
