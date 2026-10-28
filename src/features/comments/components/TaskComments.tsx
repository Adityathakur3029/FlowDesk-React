import { CommentSection } from './CommentSection'

// A task's comments (the task page), for a program task and a board task alike. taskId is the task's id;
// the contract also takes its key.
export function TaskComments({ taskId }: { taskId: string }) {
  return <CommentSection target={{ taskId }} subject="task" />
}
