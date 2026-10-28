import type { components } from '@/api/schema'

export type Employee = components['schemas']['Employee']
export type Role = Employee['role']
export type LoginResult = components['schemas']['LoginResponse']['data']
