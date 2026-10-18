import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import './App.css'

// Temporary API status screen (spec 01). Replaced by the app layout in spec 04.
function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => unwrap(apiClient.GET('/health-check', { signal })),
  })

  return (
    <main className="status">
      <h1>FlowDesk</h1>
      {health.isPending && <p>Checking API…</p>}
      {health.isSuccess && (
        <p className="status-ok">
          API ok · database time {new Date(health.data.dbTime).toLocaleString()}
        </p>
      )}
      {health.isError && (
        <div className="status-error" role="alert">
          <p>{getErrorMessage(health.error)}</p>
          <button type="button" onClick={() => health.refetch()} disabled={health.isFetching}>
            {health.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
    </main>
  )
}

export default App
