import type { components, paths } from '@/api/schema'

export type Employee = components['schemas']['Employee']
export type EmployeeRole = components['schemas']['EmployeeRole']
export type EmployeeList = components['schemas']['EmployeeListResponse']
export type EmployeeListParams = NonNullable<paths['/employees']['get']['parameters']['query']>
export type UpdateEmployeeRequest = components['schemas']['UpdateEmployeeRequest']
