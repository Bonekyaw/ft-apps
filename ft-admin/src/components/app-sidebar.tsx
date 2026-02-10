import * as React from "react"
import { Link, useLocation } from "react-router"

import { NavUser } from "@/components/nav-user"
import { ROLE_LABELS } from "@/lib/admin-permissions"
import { useSession, canAccessUserManagement } from "@/lib/auth-client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { LayoutDashboardIcon, UsersIcon, ShieldCheckIcon, CommandIcon, DollarSignIcon } from "lucide-react"

function getNavMain(canAccessAdminManagement: boolean) {
  const items: { title: string; path: string; icon: React.ReactNode }[] = [
    { title: "Dashboard", path: "/", icon: <LayoutDashboardIcon className="size-4" /> },
    { title: "User Management", path: "/users", icon: <UsersIcon className="size-4" /> },
    { title: "Pricing", path: "/pricing", icon: <DollarSignIcon className="size-4" /> },
  ]
  if (canAccessAdminManagement) {
    items.push({ title: "Admin Management", path: "/admin-users", icon: <ShieldCheckIcon className="size-4" /> })
  }
  return items
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();
  const location = useLocation();
  const user = session?.user;
  const canAccessAdminManagement = canAccessUserManagement(user?.role as string | undefined);
  const navMain = getNavMain(canAccessAdminManagement);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:flex data-[slot=sidebar-menu-button]:flex-col data-[slot=sidebar-menu-button]:items-start data-[slot=sidebar-menu-button]:gap-0.5 data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/" className="w-full">
                <span className="flex items-center gap-2">
                  <CommandIcon className="size-5!" />
                  <span className="text-base font-semibold">Admin</span>
                </span>
                {user?.role && (
                  <Badge variant="secondary" className="text-muted-foreground mt-1 font-normal text-xs">
                    {ROLE_LABELS[(user.role as string).toUpperCase()] ?? (user.role as string)}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navMain.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.path}
                tooltip={item.title}
              >
                <Link to={item.path}>
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              name: user.name ?? "Admin",
              email: user.email ?? "",
              avatar: user.image ?? "",
            }}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
