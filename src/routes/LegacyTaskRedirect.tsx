import { Navigate, useLocation, useParams } from 'react-router'
import { taskPath } from './paths'

// /programs/:programId/tasks/:taskRef → /tasks/:taskRef, replacing the old entry. The key alone finds the task,
// so a wrong programId doesn't matter: the task page shows the task's real parent.
export function LegacyTaskRedirect() {
  const { taskRef = '' } = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={`${taskPath(taskRef)}${search}${hash}`} replace />
}
