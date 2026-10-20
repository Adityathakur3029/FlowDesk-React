import { CommentSection } from './CommentSection'

// A task's comments (the task page). taskId is the task's id; the contract also takes its key.
export function TaskComments({ programId, taskId }: { programId: string; taskId: string }) {
  return <CommentSection target={{ programId, taskId }} subject="task" />
}
