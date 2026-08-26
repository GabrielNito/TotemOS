"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  UtensilsCrossed,
  BarChart3,
  TabletSmartphone,
  Settings,
  ChevronsUpDown,
  LogOut,
  Store,
} from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export const navItems = [
  {
    title: "Visão Geral",
    url: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Catálogo",
    url: "/admin/catalogo",
    icon: UtensilsCrossed,
    exact: false,
  },
  {
    title: "Relatórios",
    url: "/admin/relatorios",
    icon: BarChart3,
    exact: false,
  },
  {
    title: "Dispositivos",
    url: "/admin/dispositivos",
    icon: TabletSmartphone,
    exact: false,
  },
  {
    title: "Configurações",
    url: "/admin/configuracoes",
    icon: Settings,
    exact: false,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const storeName = user?.negocioNome || "TotemOS Lojista"
  const userName =
    user?.nome?.trim() ||
    (user?.email ? user.email.split("@")[0] : "Administrador")
  const userEmail = user?.email || ""
  const userRole = user?.role || "DONO"

  const initials =
    userName
      .split(/[\s@._]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AD"

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/40"
      {...props}
    >
      {/* Header: Estabelecimento / Marca */}
      <SidebarHeader className="p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-2.5 shadow-xs transition-all group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Store className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-bold text-foreground">
                  {storeName}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  Painel de Gestão
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content: Menus de Navegação */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase group-data-[collapsible=icon]:hidden">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = item.exact
                  ? pathname === item.url
                  : pathname.startsWith(item.url)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "h-10 rounded-xl px-3 transition-colors",
                        isActive
                          ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/15"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Link
                        href={item.url}
                        className="flex w-full items-center gap-3"
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="text-xs group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: Menu do Usuário */}
      <SidebarFooter className="p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full focus:outline-none">
                <div className="flex w-full items-center gap-2.5 rounded-2xl border border-border/40 bg-card p-2 text-left text-xs shadow-xs transition-all group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none hover:bg-muted/40">
                  <Avatar className="size-8 shrink-0 rounded-xl">
                    <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-bold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-foreground">
                      {userName}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {userRole}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 shrink-0 opacity-60 group-data-[collapsible=icon]:hidden" />
                </div>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="min-w-56 rounded-2xl border border-border/40 p-1.5 shadow-md backdrop-blur-xs"
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-1.5 font-normal">
                  <div className="flex items-center gap-2.5 text-left text-xs">
                    <Avatar className="size-8 rounded-xl">
                      <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-bold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-xs leading-tight">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-semibold">
                          {userName}
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-full px-1 py-0 text-[9px] uppercase"
                        >
                          {userRole}
                        </Badge>
                      </div>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {userEmail}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer rounded-xl text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 size-3.5" />
                  <span>Sair da conta</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
