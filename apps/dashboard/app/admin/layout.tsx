import * as React from "react"
import type { Metadata } from "next"
import { AuthProvider } from "@/contexts/auth-context"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AdminHeader } from "@/components/layout/admin-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export const metadata: Metadata = {
  title: "TotemOS — Painel de Gestão",
  description: "Gestão operacional de autoatendimento e cozinha do TotemOS",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-muted/25">
          <AdminHeader />
          <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  )
}
