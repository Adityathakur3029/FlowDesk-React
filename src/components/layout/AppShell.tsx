import { Outlet, useLocation } from 'react-router'
import { RouteErrorBoundary } from '@/components/feedback/RouteErrorBoundary'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'
import type { NavItem } from './navItems'

// shadcn's SidebarProvider writes this cookie on every toggle but never reads it (it expects a server to).
// Reading it here makes the collapsed/expanded choice survive a reload. A UI preference only, no session data.
function readSidebarOpen(): boolean {
  return !document.cookie.split('; ').includes('sidebar_state=false')
}

interface AppShellProps {
  navItems?: readonly NavItem[]
}

export function AppShell({ navItems }: AppShellProps) {
  const { pathname } = useLocation()

  return (
    // One provider for every tooltip inside the app (the collapsed sidebar's labels among them).
    <TooltipProvider>
      <SidebarProvider defaultOpen={readSidebarOpen()}>
        <AppSidebar items={navItems} />
        <SidebarInset>
          <Header />
          <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {/* key resets the boundary on navigation, so a crashed page doesn't stick. */}
            <RouteErrorBoundary key={pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
