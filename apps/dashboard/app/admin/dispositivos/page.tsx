"use client"

import * as React from "react"
import {
  Clock3,
  LoaderCircle,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  TabletSmartphone,
  Trash2,
  TriangleAlert,
  Tv,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import {
  ApiError,
  gerarCodigoPareamento,
  getDispositivos,
  revogarDispositivo,
  type GerarCodigoPareamentoResponse,
} from "@/lib/api"
import type { Dispositivo, TipoDispositivo } from "@/lib/types/models"

interface CodigoPareamentoAtivo extends GerarCodigoPareamentoResponse {
  nome: string
  tipo: TipoDispositivo
}

const gruposDispositivos: Array<{
  tipo: TipoDispositivo
  titulo: string
  descricao: string
}> = [
  {
    tipo: "TOTEM",
    titulo: "Totens de autoatendimento",
    descricao: "Equipamentos cadastrados para receber pedidos.",
  },
  {
    tipo: "PAINEL",
    titulo: "Painéis KDS",
    descricao: "Equipamentos cadastrados para acompanhar a produção.",
  },
]

function mensagemDeErro(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}

function formatarData(data: string): string {
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function formatarHorario(data: string): string {
  return new Date(data).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function IconeDispositivo({ tipo }: { tipo: TipoDispositivo }) {
  return tipo === "TOTEM" ? (
    <TabletSmartphone className="size-5" />
  ) : (
    <Tv className="size-5" />
  )
}

function CardDispositivo({
  dispositivo,
  podeRevogar,
  onRevogar,
}: {
  dispositivo: Dispositivo
  podeRevogar: boolean
  onRevogar: (dispositivo: Dispositivo) => void
}) {
  return (
    <div className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs transition-all hover:border-border/80">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-foreground">
            <IconeDispositivo tipo={dispositivo.tipo} />
          </div>
          <Badge
            variant="outline"
            className={
              dispositivo.ativo
                ? "rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                : "rounded-full border-border/60 bg-muted text-[10px] font-semibold text-muted-foreground"
            }
          >
            {dispositivo.ativo ? "ATIVO NO CADASTRO" : "REVOGADO"}
          </Badge>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            {dispositivo.nome}
          </h3>
          <p className="text-xs text-muted-foreground">
            Presença online não informada pelo backend.
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border border-border/40 bg-muted/20 p-3.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Tipo:</span>
            <span className="text-[11px] font-semibold text-foreground">
              {dispositivo.tipo === "TOTEM" ? "Totem" : "Painel KDS"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Status cadastral:</span>
            <span className="text-right text-[11px] font-semibold text-foreground">
              {dispositivo.ativo ? "Ativo" : "Revogado"}
            </span>
          </div>
          {!dispositivo.ativo && dispositivo.revogadoEm && (
            <div className="flex items-center justify-between gap-3">
              <span>Revogado em:</span>
              <span className="text-right text-[11px] text-foreground">
                {formatarData(dispositivo.revogadoEm)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/30 pt-3 text-xs text-muted-foreground">
        <span>
          Pareado em{" "}
          {formatarData(dispositivo.pareadoEm ?? dispositivo.createdAt)}
        </span>
        {podeRevogar && dispositivo.ativo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRevogar(dispositivo)}
            className="gap-1 rounded-xl text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3" />
            Revogar
          </Button>
        )}
      </div>
    </div>
  )
}

function SkeletonDispositivos() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="space-y-5 rounded-3xl border border-border/40 bg-card p-6 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="size-10 rounded-2xl" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DispositivosPage() {
  const { user } = useAuth()
  const [dispositivos, setDispositivos] = React.useState<Dispositivo[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [erro, setErro] = React.useState<string | null>(null)
  const [codigoPareamento, setCodigoPareamento] =
    React.useState<CodigoPareamentoAtivo | null>(null)
  const [dialogGerarAberto, setDialogGerarAberto] = React.useState(false)
  const [nomeDispositivo, setNomeDispositivo] = React.useState("")
  const [tipoDispositivo, setTipoDispositivo] =
    React.useState<TipoDispositivo>("TOTEM")
  const [erroFormulario, setErroFormulario] = React.useState<string | null>(
    null
  )
  const [isGerando, setIsGerando] = React.useState(false)
  const [dispositivoParaRevogar, setDispositivoParaRevogar] =
    React.useState<Dispositivo | null>(null)
  const [isRevogando, setIsRevogando] = React.useState(false)

  const podeGerenciar = user?.role === "DONO"

  const carregarDispositivos = React.useCallback(async () => {
    setIsLoading(true)
    setErro(null)

    try {
      const response = await getDispositivos()
      setDispositivos(response.dispositivos)
    } catch (error) {
      setErro(
        mensagemDeErro(
          error,
          "Não foi possível carregar os dispositivos deste negócio."
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void Promise.resolve().then(carregarDispositivos)
  }, [carregarDispositivos])

  const abrirDialogGerar = () => {
    setNomeDispositivo("")
    setTipoDispositivo("TOTEM")
    setErroFormulario(null)
    setDialogGerarAberto(true)
  }

  const gerarCodigo = async () => {
    const nome = nomeDispositivo.trim()

    if (!nome) {
      setErroFormulario("Informe um nome para identificar o dispositivo.")
      return
    }

    setIsGerando(true)
    setErroFormulario(null)

    try {
      const response = await gerarCodigoPareamento({
        nome,
        tipo: tipoDispositivo,
      })

      setCodigoPareamento({ ...response, nome, tipo: tipoDispositivo })
      setDialogGerarAberto(false)
      toast.success("Código de pareamento gerado pelo backend.")
    } catch (error) {
      setErroFormulario(
        mensagemDeErro(error, "Não foi possível gerar o código de pareamento.")
      )
    } finally {
      setIsGerando(false)
    }
  }

  const revogar = async () => {
    if (!dispositivoParaRevogar) return

    setIsRevogando(true)

    try {
      await revogarDispositivo(dispositivoParaRevogar.id)
      setDispositivos((current) =>
        current.map((dispositivo) =>
          dispositivo.id === dispositivoParaRevogar.id
            ? {
                ...dispositivo,
                ativo: false,
                revogadoEm: new Date().toISOString(),
              }
            : dispositivo
        )
      )
      setDispositivoParaRevogar(null)
      toast.success("Dispositivo revogado.")
    } catch (error) {
      toast.error(
        mensagemDeErro(error, "Não foi possível revogar o dispositivo.")
      )
    } finally {
      setIsRevogando(false)
    }
  }

  const totens = dispositivos.filter((device) => device.tipo === "TOTEM")
  const paineis = dispositivos.filter((device) => device.tipo === "PAINEL")
  const dispositivosAtivos = dispositivos.filter((device) => device.ativo)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dispositivos & Terminais
            </h1>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              {isLoading ? "..." : `${dispositivos.length} cadastrados`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gerencie o pareamento de totens e painéis KDS do negócio.
          </p>
        </div>

        {podeGerenciar ? (
          <Button
            onClick={abrirDialogGerar}
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            Gerar código de pareamento
          </Button>
        ) : (
          <span className="text-right text-xs text-muted-foreground">
            Apenas o dono pode gerar códigos ou revogar dispositivos.
          </span>
        )}
      </div>

      {codigoPareamento && (
        <div
          role="status"
          className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-xs sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <QrCode className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Código para {codigoPareamento.nome}
              </h2>
              <p className="text-xs text-muted-foreground">
                Válido por 15 minutos, até{" "}
                {formatarHorario(codigoPareamento.expiraEm)}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-2xl border border-primary/20 bg-background px-4 py-2 font-mono text-2xl font-bold tracking-widest text-primary tabular-nums shadow-xs">
              {codigoPareamento.codigo}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCodigoPareamento(null)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}

      {erro && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-3xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{erro}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void carregarDispositivos()}
            className="gap-1.5 self-start rounded-xl text-xs sm:self-auto"
          >
            <RefreshCw className="size-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Totens cadastrados
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TabletSmartphone className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {isLoading ? "..." : totens.length}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {totens.length === 0
                ? "Nenhum totem pareado"
                : "No cadastro do negócio"}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Painéis KDS
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Tv className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {isLoading ? "..." : paineis.length}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {paineis.length === 0
                ? "Nenhum painel pareado"
                : "No cadastro do negócio"}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Cadastros ativos
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {isLoading ? "..." : dispositivosAtivos.length}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Status cadastral
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Presença online
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock3 className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Não disponível
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Sem telemetria no contrato atual
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonDispositivos />
      ) : erro && dispositivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
          <TriangleAlert className="mb-3 size-8 text-destructive" />
          <h2 className="text-sm font-bold text-foreground">
            Não foi possível carregar os dispositivos
          </h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Verifique a conexão com a API e tente novamente.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {gruposDispositivos.map((grupo) => {
            const devices = dispositivos.filter(
              (dispositivo) => dispositivo.tipo === grupo.tipo
            )

            return (
              <section key={grupo.tipo} className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {grupo.titulo}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {grupo.descricao}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="w-fit rounded-full text-[10px]"
                  >
                    {devices.length} cadastrado{devices.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                {devices.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {devices.map((dispositivo) => (
                      <CardDispositivo
                        key={dispositivo.id}
                        dispositivo={dispositivo}
                        podeRevogar={podeGerenciar}
                        onRevogar={setDispositivoParaRevogar}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-8 text-center shadow-xs">
                    <IconeDispositivo tipo={grupo.tipo} />
                    <p className="mt-3 text-sm font-bold text-foreground">
                      Nenhum {grupo.tipo === "TOTEM" ? "totem" : "painel KDS"}{" "}
                      pareado
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {podeGerenciar
                        ? "Gere um código para conectar um novo dispositivo."
                        : "Peça ao dono do negócio para gerar um código de pareamento."}
                    </p>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <Dialog
        open={dialogGerarAberto}
        onOpenChange={(open) => {
          if (!isGerando) setDialogGerarAberto(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar código de pareamento</DialogTitle>
            <DialogDescription>
              O backend emitirá um código de 6 dígitos válido por 15 minutos. O
              dispositivo receberá o token persistente apenas durante a
              ativação.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void gerarCodigo()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="nome-dispositivo">Nome do dispositivo</Label>
              <Input
                id="nome-dispositivo"
                value={nomeDispositivo}
                onChange={(event) => setNomeDispositivo(event.target.value)}
                placeholder="Ex.: Totem entrada"
                maxLength={100}
                autoFocus
                disabled={isGerando}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-dispositivo">Tipo</Label>
              <select
                id="tipo-dispositivo"
                value={tipoDispositivo}
                onChange={(event) =>
                  setTipoDispositivo(event.target.value as TipoDispositivo)
                }
                disabled={isGerando}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="TOTEM">Totem de autoatendimento</option>
                <option value="PAINEL">Painel KDS</option>
              </select>
            </div>

            {erroFormulario && (
              <p role="alert" className="text-xs text-destructive">
                {erroFormulario}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogGerarAberto(false)}
                disabled={isGerando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isGerando}>
                {isGerando ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <QrCode />
                )}
                Gerar código
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(dispositivoParaRevogar)}
        onOpenChange={(open) => {
          if (!open && !isRevogando) setDispositivoParaRevogar(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar dispositivo?</DialogTitle>
            <DialogDescription>
              O dispositivo {dispositivoParaRevogar?.nome} deixará de ser um
              cadastro ativo e não poderá acessar as rotas protegidas pelo
              deviceToken atual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDispositivoParaRevogar(null)}
              disabled={isRevogando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void revogar()}
              disabled={isRevogando}
            >
              {isRevogando && <LoaderCircle className="animate-spin" />}
              Confirmar revogação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
