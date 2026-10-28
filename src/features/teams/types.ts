import type { components, paths } from '@/api/schema'

export type Team = components['schemas']['Team']
export type TeamList = components['schemas']['TeamListResponse']
export type TeamListParams = NonNullable<paths['/teams']['get']['parameters']['query']>
export type CreateTeamRequest = components['schemas']['CreateTeamRequest']
