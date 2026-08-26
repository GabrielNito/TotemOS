import * as React from "react"
import Link from "next/link"
import { UtensilsCrossed } from "lucide-react"
import { ThemeToggle } from "@/components/layout/theme-toggle"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-muted/30 p-4 sm:p-6 md:p-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-105 flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-3 self-center text-xl font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <UtensilsCrossed className="size-4.5" />
          </div>
          <span>TotemOS</span>
        </Link>

        {children}

        <p className="px-6 text-center text-[11px] leading-relaxed text-muted-foreground/80">
          Ao continuar, você concorda com os Termos de Serviço e Política de
          Privacidade do TotemOS.
        </p>
      </div>
    </div>
  )
}
