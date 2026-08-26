"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  UtensilsCrossed,
  Coffee,
  Pizza,
  Beer,
  IceCream,
  Fish,
  Store,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  UserCheck,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Layers,
  ChefHat,
  MonitorCheck,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { registrarApi, ApiError } from "@/lib/api"
import { setAuthToken, setCachedUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

export const BUSINESS_TYPES = [
  {
    id: "hamburgueria",
    name: "Hamburgueria & Lanches",
    description: "Combos, adicionais, pontos de carne e acompanhamentos",
    icon: UtensilsCrossed,
    tag: "Mais Popular",
  },
  {
    id: "pizzaria",
    name: "Pizzaria & Massas",
    description: "Sabores meio a meio, bordas recheadas e tamanhos",
    icon: Pizza,
  },
  {
    id: "cafeteria",
    name: "Cafeteria & Padaria",
    description: "Bebidas personalizadas, combos matinais e salgados",
    icon: Coffee,
  },
  {
    id: "restaurante",
    name: "Restaurante & Buffet",
    description: "Pratos à la carte, executivos e guarnições",
    icon: ChefHat,
  },
  {
    id: "acai",
    name: "Açaí & Sobremesas",
    description: "Montagem de copos, camadas de adicionais e caldas",
    icon: IceCream,
  },
  {
    id: "bar",
    name: "Bar, Choperia & Pub",
    description: "Bebidas, drinks autorais e porções para compartilhar",
    icon: Beer,
  },
  {
    id: "japonesa",
    name: "Culinária Japonesa & Poke",
    description: "Combinados, temakis e personalização de bowls",
    icon: Fish,
  },
  {
    id: "outro",
    name: "Outro Estabelecimento",
    description: "Cardápio customizável para qualquer modelo gastronômico",
    icon: Store,
  },
]

function generateCleanSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")

  const randomSuffix = Math.floor(100 + Math.random() * 900)
  return `${base || "loja"}-${randomSuffix}`
}

export function RegistrarMultiStep() {
  const router = useRouter()

  const [currentStep, setCurrentStep] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadingMessage, setLoadingMessage] = React.useState("")

  // Form State
  const [segmento, setSegmento] = React.useState("hamburgueria")
  const [nomeNegocio, setNomeNegocio] = React.useState("")
  const [pinDono, setPinDono] = React.useState("")
  const [confirmarPin, setConfirmarPin] = React.useState("")
  const [nomeUsuario, setNomeUsuario] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [senhaPlana, setSenhaPlana] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)

  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const selectedBusiness = BUSINESS_TYPES.find((b) => b.id === segmento)

  const validateStep1 = () => {
    const errs: Record<string, string> = {}
    if (!nomeNegocio.trim() || nomeNegocio.trim().length < 3) {
      errs.nomeNegocio =
        "O nome do estabelecimento deve ter no mínimo 3 caracteres"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep2 = () => {
    const errs: Record<string, string> = {}
    if (!/^\d{4}$/.test(pinDono)) {
      errs.pinDono = "Preencha o PIN com os 4 dígitos numéricos"
    }
    if (pinDono !== confirmarPin) {
      errs.confirmarPin = "A confirmação do PIN não confere com o digitado"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep3 = () => {
    const errs: Record<string, string> = {}
    if (!nomeUsuario.trim() || nomeUsuario.trim().length < 2) {
      errs.nomeUsuario = "Informe seu nome completo"
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      errs.email = "Informe um endereço de e-mail válido"
    }
    if (!senhaPlana || senhaPlana.length < 6) {
      errs.senhaPlana = "A senha deve ter no mínimo 6 caracteres"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return
    if (currentStep === 2 && !validateStep2()) return
    if (currentStep === 3 && !validateStep3()) return

    setCurrentStep((prev) => Math.min(prev + 1, 4))
  }

  const handleBack = () => {
    setErrors({})
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleFinalSubmit = async () => {
    setIsLoading(true)
    setLoadingMessage("Criando seu estabelecimento no TotemOS...")

    const slug = generateCleanSlug(nomeNegocio)

    try {
      const response = await registrarApi({
        nomeNegocio: nomeNegocio.trim(),
        slugNegocio: slug,
        pinDono,
        nomeUsuario: nomeUsuario.trim(),
        email: email.trim(),
        senhaPlana,
      })

      setLoadingMessage("Preparando seu painel de controle...")
      setAuthToken(response.accessToken)
      setCachedUser(response.usuario)

      toast.success("Estabelecimento configurado com sucesso!", {
        description: `Bem-vindo ao TotemOS, ${response.usuario.nome || "Lojista"}!`,
      })

      router.replace("/admin")
      router.refresh()
    } catch (err) {
      setIsLoading(false)
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          toast.error("E-mail já cadastrado", {
            description:
              "Já existe uma conta associada a este e-mail. Faça login ou use outro.",
          })
          setCurrentStep(3)
        } else {
          toast.error("Falha no cadastro", { description: err.message })
        }
      } else {
        toast.error("Erro de conexão", {
          description:
            "Verifique sua conexão com a internet e tente novamente.",
        })
      }
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-12">
      {/* Lado Esquerdo: Showcase & Visão de Valor */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r bg-muted/30 p-10 text-foreground lg:col-span-5 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-radial-[at_top_left] from-primary/5 via-transparent to-transparent" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <UtensilsCrossed className="size-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">TotemOS</span>
            <p className="text-xs text-muted-foreground">
              Plataforma de Autoatendimento & KDS
            </p>
          </div>
        </div>

        {/* Dynamic Interactive Preview Card */}
        <div className="relative z-10 my-auto space-y-6">
          <div className="space-y-5 rounded-3xl border border-border/40 bg-card/90 p-6 shadow-xs backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {selectedBusiness?.icon && (
                    <selectedBusiness.icon className="size-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {nomeNegocio.trim() || "Seu Restaurante"}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedBusiness?.name}
                  </span>
                </div>
              </div>
              <Badge
                variant="outline"
                className="rounded-full font-mono text-[10px] uppercase"
              >
                Preview Totem
              </Badge>
            </div>

            <Separator />

            {/* Feature Highlights */}
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 text-muted-foreground">
                <MonitorCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong>Totens de Autoatendimento</strong> com catálogo
                  interativo e pagamentos via Mercado Pago Point.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-muted-foreground">
                <ChefHat className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong>Painel da Cozinha (KDS)</strong> em tempo real com
                  emissão sequencial diária de senhas.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-muted-foreground">
                <Layers className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong>Operação Offline Resiliente:</strong> seus totens
                  continuam vendendo mesmo sem conexão à nuvem.
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card px-4 py-3 text-xs text-muted-foreground">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span>
              Configuração rápida em menos de 2 minutos. Sem fidelidade.
            </span>
          </div>
        </div>

        {/* Bottom Status */}
        <div className="relative z-10 flex items-center justify-between text-xs text-muted-foreground">
          <span>TotemOS v1.0</span>
          <span>Suporte 24/7 para sua operação</span>
        </div>
      </div>

      {/* Lado Direito: Formulário Multietapas */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-7 lg:p-12">
        {/* Header com Navegação e Tema */}
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UtensilsCrossed className="size-4" />
            </div>
            <span className="text-lg font-bold">TotemOS</span>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-xs font-medium text-muted-foreground">
              Etapa {currentStep} de 4
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-xs"
              )}
            >
              Já tenho conta
            </Link>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="mx-auto mb-8 w-full max-w-xl">
          <div className="grid grid-cols-4 gap-2">
            {[
              { step: 1, label: "Estabelecimento" },
              { step: 2, label: "Segurança" },
              { step: 3, label: "Responsável" },
              { step: 4, label: "Ativação" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col gap-1.5">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    currentStep >= s.step ? "bg-primary" : "bg-muted"
                  )}
                />
                <span
                  className={cn(
                    "hidden text-[11px] font-medium transition-colors sm:block",
                    currentStep >= s.step
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content Container */}
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-4">
          {/* ==================== ETAPA 1 ==================== */}
          {currentStep === 1 && (
            <div className="animate-in space-y-6 duration-200 fade-in-50">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">
                  Qual é o tipo do seu negócio?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Selecione o segmento para adaptarmos o cardápio e fluxo de
                  pedidos.
                </p>
              </div>

              {/* Business Segment Grid com scrollbar estilizada e espaçamento lateral seguro */}
              <div className="custom-scrollbar grid max-h-85 grid-cols-1 gap-3.5 overflow-y-auto p-1.5 pr-5 sm:grid-cols-2">
                {BUSINESS_TYPES.map((type) => {
                  const Icon = type.icon
                  const isSelected = segmento === type.id
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSegmento(type.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                          : "border-border hover:border-border/80 hover:bg-muted/40"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-4.5" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs leading-none font-semibold">
                            {type.name}
                          </span>
                          {type.tag && (
                            <Badge
                              variant="secondary"
                              className="h-4 shrink-0 px-1.5 py-0 text-[9px]"
                            >
                              {type.tag}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="nomeNegocio" className="text-sm font-semibold">
                  Nome do Estabelecimento
                </Label>
                <Input
                  id="nomeNegocio"
                  placeholder="Ex: Burger Bros Artesanal"
                  value={nomeNegocio}
                  onChange={(e) => setNomeNegocio(e.target.value)}
                  className={cn(
                    "h-11",
                    errors.nomeNegocio &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {errors.nomeNegocio ? (
                  <p className="text-xs text-destructive">
                    {errors.nomeNegocio}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Este é o nome que seus clientes verão na tela do totem e no
                    cupom de senha.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ==================== ETAPA 2 (PIN com Input OTP) ==================== */}
          {currentStep === 2 && (
            <div className="animate-in space-y-6 duration-200 fade-in-50">
              <div className="space-y-1 text-center sm:text-left">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="size-3.5" />
                  <span>Segurança Operacional</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Defina o PIN de Segurança do Dono
                </h2>
                <p className="text-sm text-muted-foreground">
                  Um código de 4 dígitos para autorizar ações restritas no totem
                  e no painel da cozinha.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <KeyRound className="size-4 text-primary" />
                  Para que serve o PIN do Dono?
                </span>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Liberar cancelamentos ou estornos de pedidos na cozinha.
                  </li>
                  <li>
                    Acessar configurações de rede e pareamento nos totens
                    físicos.
                  </li>
                  <li>Autorizar pagamentos offline emergenciais.</li>
                </ul>
              </div>

              <div className="flex flex-col items-center justify-around gap-6 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row">
                <div className="flex flex-col items-center gap-2">
                  <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    PIN do Dono (4 dígitos)
                  </Label>
                  <InputOTP
                    maxLength={4}
                    value={pinDono}
                    onChange={(val) => setPinDono(val)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={0}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                      <InputOTPSlot
                        index={1}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                      <InputOTPSlot
                        index={2}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                      <InputOTPSlot
                        index={3}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                    </InputOTPGroup>
                  </InputOTP>
                  {errors.pinDono && (
                    <p className="text-xs font-medium text-destructive">
                      {errors.pinDono}
                    </p>
                  )}
                </div>

                <Separator
                  orientation="vertical"
                  className="hidden h-12 sm:block"
                />
                <Separator className="w-full sm:hidden" />

                <div className="flex flex-col items-center gap-2">
                  <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Confirmar PIN
                  </Label>
                  <InputOTP
                    maxLength={4}
                    value={confirmarPin}
                    onChange={(val) => setConfirmarPin(val)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={0}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                      <InputOTPSlot
                        index={1}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                      <InputOTPSlot
                        index={2}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                      <InputOTPSlot
                        index={3}
                        mask
                        className="size-9.5 text-sm font-semibold"
                      />
                    </InputOTPGroup>
                  </InputOTP>
                  {errors.confirmarPin && (
                    <p className="text-xs font-medium text-destructive">
                      {errors.confirmarPin}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== ETAPA 3 ==================== */}
          {currentStep === 3 && (
            <div className="animate-in space-y-6 duration-200 fade-in-50">
              <div className="space-y-1">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <UserCheck className="size-3.5" />
                  <span>Acesso do Administrador</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Crie sua conta de Administrador
                </h2>
                <p className="text-sm text-muted-foreground">
                  Estas credenciais darão acesso total ao Painel de Gestão da
                  sua loja.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="nomeUsuario"
                    className="text-sm font-semibold"
                  >
                    Seu Nome Completo
                  </Label>
                  <Input
                    id="nomeUsuario"
                    placeholder="Ex: Carlos Eduardo"
                    value={nomeUsuario}
                    onChange={(e) => setNomeUsuario(e.target.value)}
                    className={cn(
                      "h-11",
                      errors.nomeUsuario && "border-destructive"
                    )}
                  />
                  {errors.nomeUsuario && (
                    <p className="text-xs text-destructive">
                      {errors.nomeUsuario}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">
                    E-mail de Acesso
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="carlos@burgerbros.com.br"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn("h-11", errors.email && "border-destructive")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senhaPlana" className="text-sm font-semibold">
                    Senha de Acesso
                  </Label>
                  <div className="relative">
                    <Input
                      id="senhaPlana"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      value={senhaPlana}
                      onChange={(e) => setSenhaPlana(e.target.value)}
                      className={cn(
                        "h-11 pr-10",
                        errors.senhaPlana && "border-destructive"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {errors.senhaPlana && (
                    <p className="text-xs text-destructive">
                      {errors.senhaPlana}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== ETAPA 4 ==================== */}
          {currentStep === 4 && (
            <div className="animate-in space-y-6 duration-200 fade-in-50">
              <div className="space-y-1">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" />
                  <span>Tudo Pronto para Ativar</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Confirme as configurações da sua loja
                </h2>
                <p className="text-sm text-muted-foreground">
                  Revise os dados antes de inicializar o seu ecossistema no
                  TotemOS.
                </p>
              </div>

              {/* Review Summary Card */}
              <div className="space-y-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      {selectedBusiness?.icon && (
                        <selectedBusiness.icon className="size-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-bold">{nomeNegocio}</h4>
                      <p className="text-xs text-muted-foreground">
                        {selectedBusiness?.name}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full text-xs">
                    Plano Gratuito
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="mb-0.5 block text-muted-foreground">
                      Responsável:
                    </span>
                    <span className="font-medium text-foreground">
                      {nomeUsuario}
                    </span>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-muted-foreground">
                      E-mail:
                    </span>
                    <span className="font-medium text-foreground">{email}</span>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-muted-foreground">
                      PIN do Dono:
                    </span>
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Lock className="size-3 text-muted-foreground" />4 dígitos
                      configurados
                    </span>
                  </div>
                  <div>
                    <span className="mb-0.5 block text-muted-foreground">
                      Perfil de Acesso:
                    </span>
                    <span className="font-medium text-foreground">
                      DONO (Acesso Total)
                    </span>
                  </div>
                </div>
              </div>

              {isLoading && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs font-medium text-primary">
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  <span>{loadingMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer com Botões de Navegação */}
        <div className="mx-auto flex w-full max-w-xl items-center justify-between border-t pt-6">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="gap-2 text-xs"
            >
              <ArrowLeft className="size-3.5" />
              Voltar
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="gap-2 text-xs"
            >
              Avançar
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isLoading}
              className="gap-2 bg-primary px-6 text-xs font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Inicializando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Ativar Estabelecimento
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
