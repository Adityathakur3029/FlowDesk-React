import { Link } from 'react-router'
import { SaajhaLogo } from '@/components/brand/SaajhaLogo'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { paths } from '@/routes/paths'

// Phones only: the sidebar is a slide-out sheet there, and this is the button that opens it. Desktop has no top
// bar (the sidebar footer collapses it). Hidden with CSS rather than useIsMobile, which is false on the first
// render, so the bar would flash in on phones. md is useIsMobile's breakpoint (768 px).
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <Link to={paths.home} className="flex items-center gap-2 font-semibold">
        <SaajhaLogo size={24} />
        FlowDesk
      </Link>
    </header>
  )
}
