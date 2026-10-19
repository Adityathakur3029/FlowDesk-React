import type { components, paths } from '@/api/schema'

export type Program = components['schemas']['Program']
export type ProgramStatus = components['schemas']['ProgramStatus']
export type ProgramList = components['schemas']['ProgramListResponse']
export type ProgramListParams = NonNullable<paths['/programs']['get']['parameters']['query']>
export type CreateProgramRequest = components['schemas']['CreateProgramRequest']
export type UpdateProgramRequest = components['schemas']['UpdateProgramRequest']
