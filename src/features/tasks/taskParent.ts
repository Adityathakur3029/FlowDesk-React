import { boardPath, paths, programPath } from '@/routes/paths'
import type { TaskParent } from './types'

// "program" or "board", for copy such as "No other tasks in this board yet."
export const parentNoun = (parent: Pick<TaskParent, 'type'>) => (parent.type === 'BOARD' ? 'board' : 'program')

// Where the task's parent lives. A deleted board's page is 404 while its tasks stay live (contract), so those
// go to the Boards list. A deleted program's tasks are 404 themselves, so a program is always active here.
export function parentPath(parent: TaskParent): string {
  if (parent.type === 'PROGRAM') return programPath(parent.id)
  return parent.isActive ? boardPath(parent.id) : paths.boards
}
