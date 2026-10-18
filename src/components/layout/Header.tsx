import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { UserMenu } from './UserMenu'

// The page title isn't here: each page renders its own PageHeader, so the title has one source.
export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="h-5" />
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  )
}
