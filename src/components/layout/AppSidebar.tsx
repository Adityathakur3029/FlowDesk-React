import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link, NavLink, useMatch } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { SaajhaLogo } from '@/components/brand/SaajhaLogo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { paths } from '@/routes/paths'
import { navItems as defaultNavItems, visibleNavItems, type NavItem } from './navItems'
import { SidebarUserMenu } from './SidebarUserMenu'

interface AppSidebarProps {
  items?: readonly NavItem[]
}

export function AppSidebar({ items = defaultNavItems }: AppSidebarProps) {
  const { employee } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="FlowDesk">
              <Link to={paths.home} onClick={closeOnMobile}>
                <SaajhaLogo size={32} />
                <span className="truncate font-semibold">FlowDesk</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Main">
              <SidebarMenu>
                {visibleNavItems(items, employee?.role).map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <NavItemLink item={item} onNavigate={closeOnMobile} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* The phone sheet closes by tapping outside it, so it has no collapse button. */}
          {!isMobile && (
            <SidebarMenuItem>
              <CollapseButton />
            </SidebarMenuItem>
          )}
          <SidebarUserMenu />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

// The active item comes from the URL (the item's path or anything under it); NavLink sets aria-current="page".
function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const isActive = useMatch({ path: item.to, end: false }) !== null
  return (
    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
      <NavLink to={item.to} onClick={onNavigate}>
        <item.icon aria-hidden="true" />
        <span>{item.label}</span>
      </NavLink>
    </SidebarMenuButton>
  )
}

// Desktop's sidebar toggle, now that there's no header. The label is the accessible name, and the tooltip when collapsed.
function CollapseButton() {
  const { open, toggleSidebar } = useSidebar()
  const label = open ? 'Collapse sidebar' : 'Expand sidebar'
  const Icon = open ? PanelLeftClose : PanelLeftOpen
  return (
    <SidebarMenuButton type="button" tooltip={label} onClick={toggleSidebar} className="text-muted-foreground">
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </SidebarMenuButton>
  )
}
