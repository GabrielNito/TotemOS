import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { Loader2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Login — TotemOS",
  description: "Acesse o painel de gestão do seu estabelecimento",
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
