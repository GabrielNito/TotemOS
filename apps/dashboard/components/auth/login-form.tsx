"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoginSchema, type LoginFormValues } from "@/lib/schemas/auth"
import { loginApi, ApiError } from "@/lib/api"
import { setAuthToken, setCachedUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get("redirect") || "/admin"

  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      senhaPlana: "",
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true)
    setFormError(null)

    try {
      const response = await loginApi(values)
      setAuthToken(response.accessToken)
      setCachedUser(response.usuario)
      toast.success("Login realizado com sucesso", {
        description: `Bem-vindo de volta, ${response.usuario.nome || "Lojista"}!`,
      })
      router.replace(redirectPath)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          const msg = "E-mail ou senha incorretos. Verifique suas credenciais."
          setFormError(msg)
          toast.error("Falha na autenticação", { description: msg })
        } else if (err.statusCode === 429) {
          const msg =
            "Muitas tentativas de acesso. Aguarde 1 minuto para tentar novamente."
          setFormError(msg)
          toast.error("Bloqueio temporário", { description: msg })
        } else {
          setFormError(err.message)
          toast.error("Erro ao acessar a conta", { description: err.message })
        }
      } else {
        const msg =
          "Não foi possível conectar ao servidor. Verifique sua conexão."
        setFormError(msg)
        toast.error("Erro de conexão", { description: msg })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="rounded-3xl border border-border/40 bg-card shadow-xs backdrop-blur-xs">
      <CardHeader className="space-y-1.5 px-6 pt-7 pb-4 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Acessar sua conta
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Informe seu e-mail e senha para gerenciar seu restaurante no TotemOS
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-7">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4">
            {formError && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-center text-xs font-medium text-destructive">
                {formError}
              </div>
            )}

            <div className="grid gap-2">
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-foreground"
              >
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="carlos@seurestaurante.com.br"
                autoComplete="email"
                disabled={isLoading}
                {...register("email")}
                className={cn(
                  "h-11 rounded-2xl border-border/60 bg-muted/20 px-3.5 text-xs",
                  errors.email &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="senhaPlana"
                className="text-xs font-semibold text-foreground"
              >
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="senhaPlana"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  {...register("senhaPlana")}
                  className={cn(
                    "h-11 rounded-2xl border-border/60 bg-muted/20 pr-10 text-xs",
                    errors.senhaPlana &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Ocultar senha" : "Exibir senha"}
                  </span>
                </button>
              </div>
              {errors.senhaPlana && (
                <p className="text-xs text-destructive">
                  {errors.senhaPlana.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="active:scale-0.99 mt-2 h-11 w-full rounded-2xl text-xs font-semibold shadow-xs transition-all"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isLoading ? "Entrando..." : "Entrar no Painel"}
            </Button>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link
                href="/registrar"
                className="font-semibold text-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                Cadastre sua loja
              </Link>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
