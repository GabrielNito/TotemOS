"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Users,
  ShieldCheck,
  KeyRound,
  Sliders,
  Shield,
  Smartphone,
  WifiOff,
  Clock,
  MessageSquare,
  RefreshCw,
} from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getAuthToken, type UserSession } from "@/lib/auth"
import {
  ApiError,
  getConfiguracaoNegocio,
  updateConfiguracaoNegocio,
  validarPinApi,
} from "@/lib/api"
import { GerenciadorConfiguracaoOperacional } from "@/lib/configuracoes-operacionais"
import {
  ConfiguracaoOperacionalFormSchema,
  ValidarPinFormSchema,
} from "@/lib/schemas/configuracoes"
import type { ModoIdentificacao, Role } from "@/lib/types/models"
import { cn } from "@/lib/utils"

const cardClass = "rounded-3xl border border-border/40 bg-card p-6 shadow-xs"

const opcoesIdentificacao: Array<{
  id: ModoIdentificacao
  title: string
  desc: string
}> = [
  {
    id: "OPCIONAL",
    title: "Opcional (Padrão)",
    desc: "O cliente pode digitar o nome ou avançar direto com senha numérica.",
  },
  {
    id: "NOME",
    title: "Nome Obrigatório",
    desc: "Exige o nome do cliente no totem para chamada personalizada.",
  },
  {
    id: "CODIGO",
    title: "Código / Comanda",
    desc: "Exige digitação do código da comanda ou identificação física.",
  },
]

interface PainelProps {
  user: UserSession
  token: string
  onSessaoExpirada?: () => void
  sessaoAtual?: () => boolean
}

export default function ConfiguracoesPage() {
  const { user, isLoading, logout } = useAuth()
  const token = getAuthToken()

  React.useEffect(() => {
    if (!isLoading && (!user || !token)) {
      logout()
    }
  }, [isLoading, user, token, logout])

  if (isLoading) {
    return (
      <div role="status" aria-label="Validando sessão" className={cardClass}>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <span className="sr-only">Validando sessão</span>
      </div>
    )
  }

  if (
    !user ||
    !token ||
    !user.negocioId ||
    !["DONO", "GERENTE"].includes(user.role ?? "")
  ) {
    return (
      <div role="alert" className={cardClass}>
        Entre com uma conta administrativa para continuar.{" "}
        <Link href="/login" className="underline">
          Ir para login
        </Link>
      </div>
    )
  }

  return (
    <PainelConfiguracoes
      user={user}
      token={token}
      onSessaoExpirada={logout}
      sessaoAtual={() => getAuthToken() === token}
    />
  )
}

export function PainelConfiguracoes(props: PainelProps) {
  return (
    <PainelConfiguracoesSessao
      key={JSON.stringify([
        props.user.negocioId,
        props.user.id ?? props.user.sub,
        props.user.role,
        props.token,
      ])}
      {...props}
    />
  )
}

function PainelConfiguracoesSessao({
  user,
  token,
  onSessaoExpirada,
  sessaoAtual,
}: PainelProps) {
  const role: Role = user.role === "GERENTE" ? "GERENTE" : "DONO"
  const isDono = role === "DONO"

  const [gerenciador] = React.useState(
    () =>
      new GerenciadorConfiguracaoOperacional(
        user.negocioId!,
        role,
        (signal) => getConfiguracaoNegocio(token, signal),
        (input, signal) => updateConfiguracaoNegocio(input, token, signal),
        onSessaoExpirada,
        20000,
        sessaoAtual
      )
  )

  const snapshot = React.useSyncExternalStore(
    gerenciador.assinar,
    gerenciador.snapshot,
    gerenciador.snapshot
  )

  React.useEffect(() => {
    void gerenciador.carregar()
    return () => gerenciador.cancelar()
  }, [gerenciador])

  const [activeTab, setActiveTab] = React.useState("operacao")

  const dadosPersistidos = snapshot.leitura.dados
  const chaveServidor = dadosPersistidos
    ? `${dadosPersistidos.negocioId}:${dadosPersistidos.modoIdentificacao}:${dadosPersistidos.tempoPadraoPreparo}:${dadosPersistidos.mensagemBoasVindas ?? ""}`
    : null

  // Rascunho local indexado pela assinatura persistida no servidor
  const [rascunho, setRascunho] = React.useState<{
    chaveServidor: string
    modoIdentificacao: ModoIdentificacao
    tempoPreparo: string
    mensagemBoasVindas: string
  } | null>(null)
  const [pinConfirmacao, setPinConfirmacao] = React.useState("")
  const [erroValidacaoForm, setErroValidacaoForm] = React.useState<
    string | null
  >(null)

  const baseServidor = {
    modoIdentificacao: dadosPersistidos?.modoIdentificacao ?? "OPCIONAL",
    tempoPreparo: dadosPersistidos
      ? String(dadosPersistidos.tempoPadraoPreparo)
      : "15",
    mensagemBoasVindas: dadosPersistidos?.mensagemBoasVindas ?? "",
  }

  const rascunhoAtivo =
    rascunho && chaveServidor && rascunho.chaveServidor === chaveServidor
      ? rascunho
      : baseServidor

  const modoIdentificacao = rascunhoAtivo.modoIdentificacao
  const tempoPreparo = rascunhoAtivo.tempoPreparo
  const mensagemBoasVindas = rascunhoAtivo.mensagemBoasVindas

  const atualizarRascunho = (
    parcial: Partial<Omit<NonNullable<typeof rascunho>, "chaveServidor">>
  ) => {
    if (!chaveServidor) return
    setRascunho({
      chaveServidor,
      ...rascunhoAtivo,
      ...parcial,
    })
  }

  const recarregarDoServidor = () => {
    setRascunho(null)
    setErroValidacaoForm(null)
    void gerenciador.carregar()
  }

  // Estado da aba PIN & Segurança (validação pontual real via POST /auth/validar-pin)
  const [pinValidacao, setPinValidacao] = React.useState("")
  const [validandoPin, setValidandoPin] = React.useState(false)
  const [resultadoPin, setResultadoPin] = React.useState<{
    tipo: "sucesso" | "erro"
    mensagem: string
  } | null>(null)

  const handleSalvarConfiguracoes = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    if (!isDono) return

    setErroValidacaoForm(null)

    const validacao = ConfiguracaoOperacionalFormSchema.safeParse({
      modoIdentificacao,
      tempoPadraoPreparo: tempoPreparo,
      mensagemBoasVindas,
      pin: pinConfirmacao,
    })

    if (!validacao.success) {
      const primeiraMensagem =
        validacao.error.issues[0]?.message ??
        "Revise os campos do formulário antes de salvar."
      setErroValidacaoForm(primeiraMensagem)
      toast.error(primeiraMensagem)
      return
    }

    const ok = await gerenciador.salvar({
      pin: validacao.data.pin,
      modoIdentificacao: validacao.data.modoIdentificacao,
      tempoPadraoPreparo: validacao.data.tempoPadraoPreparo,
      mensagemBoasVindas: validacao.data.mensagemBoasVindas,
    })

    setPinConfirmacao("")

    if (ok) {
      setRascunho(null)
      toast.success("Configurações salvas no servidor.")
    } else if (gerenciador.snapshot().salvamento.mensagem) {
      toast.error(gerenciador.snapshot().salvamento.mensagem)
    }
  }

  const handleValidarPin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setResultadoPin(null)

    const parsed = ValidarPinFormSchema.safeParse({ pin: pinValidacao })
    if (!parsed.success) {
      setResultadoPin({
        tipo: "erro",
        mensagem:
          parsed.error.issues[0]?.message ??
          "Informe exatamente 4 dígitos numéricos.",
      })
      return
    }

    setValidandoPin(true)
    try {
      const resposta = await validarPinApi(parsed.data.pin, user.negocioId!)
      setPinValidacao("")
      if (resposta.valido) {
        setResultadoPin({
          tipo: "sucesso",
          mensagem: "PIN válido para este estabelecimento.",
        })
      } else {
        setResultadoPin({
          tipo: "erro",
          mensagem: "PIN não confere com o cadastrado para este negócio.",
        })
      }
    } catch (erro) {
      setPinValidacao("")
      if (erro instanceof ApiError && erro.statusCode === 401) {
        setResultadoPin({
          tipo: "erro",
          mensagem:
            "PIN incorreto ou sessão expirada (401). Verifique os dados.",
        })
      } else if (erro instanceof ApiError && erro.statusCode === 403) {
        setResultadoPin({
          tipo: "erro",
          mensagem: "Sem permissão para validar o PIN neste estabelecimento.",
        })
      } else {
        setResultadoPin({
          tipo: "erro",
          mensagem: "Não foi possível validar o PIN agora. Tente novamente.",
        })
      }
    } finally {
      setValidandoPin(false)
    }
  }

  const nomeSessao = user.nome || "Usuário autenticado"
  const emailSessao = user.email || "E-mail não informado"
  const iniciais =
    nomeSessao
      .split(/[\s@._]+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "US"

  if (snapshot.acessoNegado) {
    return (
      <div role="alert" className={cardClass}>
        <h1 className="text-xl font-semibold">
          Não foi possível validar o acesso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {snapshot.leitura.erro} Entre novamente para continuar.
        </p>
        {onSessaoExpirada ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={onSessaoExpirada}
          >
            Trocar conta
          </Button>
        ) : (
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 rounded-xl"
            )}
          >
            Ir para login
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Configurações do Estabelecimento
            </h1>
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              {isDono ? "Edição liberada (DONO)" : "Somente leitura (GERENTE)"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Parâmetros operacionais persistidos no backend para{" "}
            <strong className="font-semibold text-foreground">
              {user.negocioNome ?? user.negocioId}
            </strong>
            .
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={snapshot.leitura.status === "carregando"}
          onClick={recarregarDoServidor}
          className="gap-2 self-start rounded-xl text-xs font-semibold sm:self-auto"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Recarregar configurações
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-3 rounded-2xl border border-border/40 bg-card p-1 shadow-xs">
          <TabsTrigger
            value="operacao"
            className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-xs"
          >
            <Sliders className="size-3.5" />
            <span>Operação</span>
          </TabsTrigger>
          <TabsTrigger
            value="usuarios"
            className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-xs"
          >
            <Users className="size-3.5" />
            <span>Equipe</span>
          </TabsTrigger>
          <TabsTrigger
            value="seguranca"
            className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-xs"
          >
            <ShieldCheck className="size-3.5" />
            <span>PIN & Segurança</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: OPERAÇÃO & TOTEM ================= */}
        <TabsContent value="operacao" className="space-y-6">
          {snapshot.leitura.status === "carregando" && !dadosPersistidos ? (
            <div
              role="status"
              aria-label="Carregando configurações operacionais"
              className="space-y-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs"
            >
              <Skeleton className="h-6 w-64 rounded-xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <span className="sr-only">
                Carregando configurações operacionais
              </span>
            </div>
          ) : snapshot.leitura.status === "erro" && !dadosPersistidos ? (
            <div
              role="alert"
              className="space-y-4 rounded-3xl border border-destructive/40 bg-card p-6 shadow-xs"
            >
              <p className="text-sm font-semibold text-destructive">
                {snapshot.leitura.erro}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={recarregarDoServidor}
                className="rounded-xl text-xs font-semibold"
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <form
              data-testid="form-config-operacao"
              aria-labelledby="titulo-form-operacao"
              onSubmit={(e) => void handleSalvarConfiguracoes(e)}
            >
              <h2 id="titulo-form-operacao" className="sr-only">
                Configurações operacionais do estabelecimento
              </h2>

              <div className="grid gap-6">
                {!isDono && (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground"
                  >
                    <Shield className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span>
                      Perfil <strong>GERENTE</strong> em modo somente leitura.
                      Apenas um usuário <strong>DONO</strong> com o PIN de 4
                      dígitos pode alterar estas configurações.
                    </span>
                  </div>
                )}

                {/* Modo de Identificação */}
                <fieldset
                  disabled={
                    !isDono || snapshot.salvamento.status === "salvando"
                  }
                  className="space-y-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs"
                >
                  <legend className="sr-only">
                    Identificação do Cliente no Totem
                  </legend>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="size-4 text-primary" />
                      <h3 className="text-base font-bold text-foreground">
                        Identificação do Cliente no Totem
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Como o cliente se identifica ao finalizar o pedido para
                      emissão de senha.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {opcoesIdentificacao.map((item) => {
                      const selecionada = modoIdentificacao === item.id
                      const inputId = `modo-identificacao-${item.id.toLowerCase()}`
                      return (
                        <label
                          key={item.id}
                          htmlFor={inputId}
                          className={cn(
                            "flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all",
                            selecionada
                              ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                              : "border-border/60 hover:bg-muted/40",
                            !isDono && "cursor-not-allowed opacity-75"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {item.title}
                            </span>
                            <input
                              id={inputId}
                              type="radio"
                              name="modoIdentificacao"
                              value={item.id}
                              checked={selecionada}
                              disabled={
                                !isDono ||
                                snapshot.salvamento.status === "salvando"
                              }
                              onChange={() =>
                                atualizarRascunho({
                                  modoIdentificacao: item.id,
                                })
                              }
                              className="size-4 accent-primary"
                            />
                          </div>
                          <span className="text-[11px] leading-relaxed text-muted-foreground">
                            {item.desc}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                {/* Pagamento Offline (Não operacional no P0) & Tempo de Preparo */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <WifiOff className="size-4 text-muted-foreground" />
                          <h4 className="text-base font-bold text-foreground">
                            Pagamento Offline Emergencial
                          </h4>
                        </div>
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px] font-semibold"
                        >
                          Não operacional no P0
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O fluxo do P0 opera apenas online. Não há fila local de
                        pagamento offline nem reconciliação automática ativa.
                      </p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/40 bg-muted/20 p-4 text-[11px] leading-relaxed text-muted-foreground">
                      Status no servidor:{" "}
                      <strong className="text-foreground">Desativado</strong>. A
                      ativação desta opção permanece bloqueada até existir
                      serviço operacional homologado.
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-primary" />
                        <h4 className="text-base font-bold text-foreground">
                          Tempo Padrão de Preparo
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Estimativa padrão projetada aos dispositivos (1 a 120
                        minutos).
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/40 bg-muted/20 p-4">
                      <Label
                        htmlFor="tempoPadraoPreparo"
                        className="text-xs font-bold"
                      >
                        Minutos estimados:
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="tempoPadraoPreparo"
                          name="tempoPadraoPreparo"
                          type="number"
                          min={1}
                          max={120}
                          disabled={
                            !isDono || snapshot.salvamento.status === "salvando"
                          }
                          value={tempoPreparo}
                          onChange={(e) =>
                            atualizarRascunho({
                              tempoPreparo: e.target.value,
                            })
                          }
                          className="h-9 w-24 rounded-xl text-center text-xs font-bold"
                        />
                        <span className="text-xs text-muted-foreground">
                          min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mensagem de Boas-vindas + PIN do Dono */}
                <div className="space-y-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-primary" />
                        <Label
                          htmlFor="mensagemBoasVindas"
                          className="text-base font-bold text-foreground"
                        >
                          Mensagem de Boas-Vindas do Totem
                        </Label>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {mensagemBoasVindas.length}/200
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Texto exibido na tela inicial do totem de autoatendimento
                      (deixe vazio para remover).
                    </p>
                  </div>

                  <Input
                    id="mensagemBoasVindas"
                    name="mensagemBoasVindas"
                    maxLength={200}
                    disabled={
                      !isDono || snapshot.salvamento.status === "salvando"
                    }
                    value={mensagemBoasVindas}
                    onChange={(e) =>
                      atualizarRascunho({
                        mensagemBoasVindas: e.target.value,
                      })
                    }
                    placeholder="Ex: Toque para fazer seu pedido e bom apetite!"
                    className="h-11 rounded-2xl"
                  />

                  {(erroValidacaoForm ||
                    snapshot.salvamento.status === "erro") && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs font-medium text-destructive"
                    >
                      {erroValidacaoForm ?? snapshot.salvamento.mensagem}
                    </div>
                  )}

                  {snapshot.salvamento.status === "sucesso" &&
                    !erroValidacaoForm && (
                      <div
                        role="status"
                        className="rounded-2xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                      >
                        {snapshot.salvamento.mensagem}
                      </div>
                    )}

                  {isDono && (
                    <div className="flex flex-col justify-between gap-4 border-t border-border/30 pt-4 sm:flex-row sm:items-end">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="pinConfirmacaoConfig"
                          className="text-xs font-semibold text-foreground"
                        >
                          PIN do dono para confirmar alteração (4 dígitos)
                        </Label>
                        <Input
                          id="pinConfirmacaoConfig"
                          name="pinConfirmacaoConfig"
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={4}
                          placeholder="••••"
                          disabled={snapshot.salvamento.status === "salvando"}
                          value={pinConfirmacao}
                          onChange={(e) => setPinConfirmacao(e.target.value)}
                          className="h-10 w-36 rounded-xl text-center tracking-widest"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={snapshot.salvamento.status === "salvando"}
                        className="rounded-xl text-xs font-semibold shadow-xs"
                      >
                        {snapshot.salvamento.status === "salvando"
                          ? "Salvando..."
                          : "Salvar Alterações"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </TabsContent>

        {/* ================= TAB 2: EQUIPE & CONTA AUTENTICADA ================= */}
        <TabsContent value="usuarios" className="space-y-6">
          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
            <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Conta da Sessão Atual
                  </h3>
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px] font-semibold"
                  >
                    Indisponível no P0
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  O gerenciamento e criação de outros usuários da equipe não
                  possui endpoint na API P0. Apenas os dados da sessão
                  autenticada são exibidos abaixo.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Usuário</TableHead>
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-xs">Estabelecimento</TableHead>
                    <TableHead className="text-xs">Sessão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 rounded-xl">
                          <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-bold text-primary">
                            {iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground">
                            {nomeSessao}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {emailSessao}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={role === "DONO" ? "default" : "secondary"}
                        className="rounded-full text-[10px] font-semibold tracking-wider uppercase"
                      >
                        {role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.negocioNome ?? user.negocioId}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Autenticada
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 3: SEGURANÇA & PIN DO DONO ================= */}
        <TabsContent value="seguranca" className="space-y-6">
          <div className="max-w-xl space-y-5 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    PIN de Segurança do Dono
                  </h3>
                </div>
                <Badge
                  variant="secondary"
                  className="rounded-full text-[10px] font-semibold"
                >
                  Alteração indisponível no P0
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                A redefinição de PIN ainda não possui rota no backend P0. O PIN
                definido no cadastro do estabelecimento pode ser verificado
                abaixo via API.
              </p>
            </div>

            <form
              data-testid="form-validar-pin"
              onSubmit={(e) => void handleValidarPin(e)}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="pinValidacaoAtual"
                  className="text-xs font-semibold text-foreground"
                >
                  Verificar PIN atual do estabelecimento (4 dígitos)
                </Label>
                <Input
                  id="pinValidacaoAtual"
                  name="pinValidacaoAtual"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="••••"
                  disabled={validandoPin}
                  value={pinValidacao}
                  onChange={(e) => setPinValidacao(e.target.value)}
                  className="h-10 w-36 rounded-xl text-center tracking-widest"
                />
              </div>

              {resultadoPin && (
                <div
                  role={resultadoPin.tipo === "erro" ? "alert" : "status"}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-xs font-medium",
                    resultadoPin.tipo === "erro"
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
                  )}
                >
                  {resultadoPin.mensagem}
                </div>
              )}

              <div className="flex justify-end border-t border-border/30 pt-3">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={validandoPin}
                  className="rounded-xl text-xs font-semibold shadow-xs"
                >
                  {validandoPin ? "Validando..." : "Validar PIN no Servidor"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
