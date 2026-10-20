import type { components } from '@/api/schema'

export type Comment = components['schemas']['Comment']
export type CommentReply = components['schemas']['CommentReply']
export type CommentList = components['schemas']['CommentListResponse']
export type CreateCommentRequest = components['schemas']['CreateCommentRequest']
export type EmployeeSummary = components['schemas']['EmployeeSummary']
// Someone picked from the @-mention list: all a mention token needs.
export type MentionedPerson = Pick<EmployeeSummary, 'id' | 'name'>
// What the comments are on: the program itself, or one of its tasks.
export interface CommentTarget {
  programId: string
  taskId?: string
}
