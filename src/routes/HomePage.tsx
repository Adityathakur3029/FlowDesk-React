import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { apiClient, unwrap } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { SaajhaLogo } from '@/components/brand/SaajhaLogo'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

// Temporary landing page (specs 02/03). Replaced by the AppShell in spec 04.
export function HomePage() {
  const { employee, signOut } = useAuth()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => unwrap(apiClient.GET('/health-check', { signal })),
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-brand/5 p-4">
      <Card className="w-full max-w-md border-t-4 border-t-brand">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SaajhaLogo size={40} />
            <div>
              <CardTitle>
                <h1 className="text-lg font-semibold">Welcome, {employee?.name}</h1>
              </CardTitle>
              <CardDescription>{employee?.emailId}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Role</span>
            <Badge>{employee?.role}</Badge>
          </div>
          <Separator />
          {health.isPending && <Skeleton className="h-5 w-56" />}
          {health.isSuccess && (
            <Badge variant="outline">API ok · database time {new Date(health.data.dbTime).toLocaleString()}</Badge>
          )}
          {health.isError && (
            <ErrorState error={health.error} title="API unavailable" onRetry={() => health.refetch()} retrying={health.isFetching} />
          )}
        </CardContent>

        <CardFooter>
          <Button type="button" variant="outline" onClick={signOut}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
