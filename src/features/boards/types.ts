import type { components, paths } from '@/api/schema'

export type Board = components['schemas']['Board']
export type BoardList = components['schemas']['BoardListResponse']
export type BoardListParams = NonNullable<paths['/boards']['get']['parameters']['query']>
export type CreateBoardRequest = components['schemas']['CreateBoardRequest']
export type UpdateBoardRequest = components['schemas']['UpdateBoardRequest']
