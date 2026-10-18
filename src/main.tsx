import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { onUnauthorized } from '@/api/authEvents'
import { clearSession } from '@/auth/tokenStorage'
import { queryClient } from '@/lib/queryClient'
import './index.css'
import App from './App.tsx'

// Interim 401 handling until the auth provider (spec 03) takes over and adds the redirect.
onUnauthorized(() => {
  clearSession()
  queryClient.clear()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
