import { Skeleton } from '@/components/ui/skeleton'
import type { TeamDirectory } from '@/features/teams'

interface OwnerTeamNameProps {
  teamId: string | null
  // undefined while the team directory loads or after it failed; a failed load shows "Unknown team".
  teams?: TeamDirectory
  loading: boolean
}

// Program only carries ownerTeamId, so the name comes from the team directory (contract note 1).
export function OwnerTeamName({ teamId, teams, loading }: OwnerTeamNameProps) {
  // Only programs created before teams existed have no owner team (contract).
  if (teamId === null) return <span className="text-muted-foreground">No owner team</span>
  if (loading) return <Skeleton className="h-5 w-24" />
  return <>{teams?.byId.get(teamId)?.name ?? <span className="text-muted-foreground">Unknown team</span>}</>
}
