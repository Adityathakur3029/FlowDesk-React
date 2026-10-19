// Public entry of the employees feature: other features import from here only.
// No pages here: PeoplePage imports @/features/teams, so exporting it would create an import cycle.
export { employeeKeys, useEmployeeSearch } from './api'
export { EmployeeMultiPicker } from './components/EmployeeMultiPicker'
export type { Employee } from './types'
