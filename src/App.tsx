import { BrowserRouter } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { Toaster } from '@/components/ui/sonner'
import { AppRoutes } from '@/routes/router'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
      <Toaster richColors closeButton position="top-right" />
    </BrowserRouter>
  )
}

export default App
