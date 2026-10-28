import type { components } from '@/api/schema'

type EmployeeRole = components['schemas']['EmployeeRole']

// Display labels only; what each role may do is decided by the backend.
export const ROLE_LABELS: Record<EmployeeRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
}
