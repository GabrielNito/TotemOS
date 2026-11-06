"use client"

import * as React from "react"
import {
  Calendar,
  ChefHat,
  ClipboardList,
  Clock,
  DollarSign,
  Eye,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
  Zap,
} from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDispositivos, getPedidoDetalhe, getPedidos } from "@/lib/api"
import {
  STATUS_PEDIDO_OPCOES,
  calcularMetricasPedidos,
  calcularSubtotalItemSnapshot,
  descreverOrigemPedido,
  formatarMoeda,
  formatarSenhaPedido,
  formatarStatusPedido,
} from "@/lib/pedidos"
import type { StatusPedido } from "@/lib/types/models"
import { cn } from "@/lib/utils"
import { getAuthToken, type UserSession } from "@/lib/auth"
import { HistoricoPedidosConsulta } from "@/lib/historico-pedidos-consulta"

function formatarDataHora(data: string): string {
  return new Date(data).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  })
}

export function StatusPedidoBadge({ status }: { status: StatusPedido }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        status === "AGUARDANDO_PAGAMENTO" &&
          "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
        status === "PENDENTE" &&
          "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
        status === "EM_PREPARO" &&
          "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
        status === "PRONTO" &&
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        status === "ENTREGUE" &&
          "border-emerald-600/30 bg-emerald-600 text-white dark:bg-emerald-600",
        (status === "CANCELADO" || status === "CANCELADO_AGUARDANDO_ESTORNO") &&
          "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {formatarStatusPedido(status)}
    </Badge>
  )
}

export default function PedidosPage() {
  const { user, logout, isLoading } = useAuth()
  const token = getAuthToken()
  if (isLoading) return <PedidosSkeleton />
  if (
    !token ||
    !user?.negocioId ||
    !["DONO", "GERENTE"].includes(user.role ?? "")
  )
    return (
      <p role="alert">
        Acesso restrito a DONO ou GERENTE.{" "}
        <Button onClick={logout}>Autenticar novamente</Button>
      </p>
    )
  return (
    <HistoricoPedidosPage
      key={user.negocioId + ":" + (user.id ?? user.sub) + ":" + token}
      user={user}
      token={token}
      logout={logout}
    />
  )
}

export function HistoricoPedidosPage({
  user,
  token,
  logout,
}: {
  user: UserSession
  token: string
  logout: () => void
}) {
  const [statusFiltro, setStatusFiltro] = React.useState<
    "TODOS" | StatusPedido
  >("TODOS")
  const [dataInicial, setDataInicial] = React.useState("")
  const [dataFinal, setDataFinal] = React.useState("")
  const [busca, setBusca] = React.useState("")
  const filtros = React.useMemo(
    () => ({
      status: statusFiltro === "TODOS" ? undefined : statusFiltro,
      criadoEmInicio: dataInicial || undefined,
      criadoEmFim: dataFinal || undefined,
    }),
    [statusFiltro, dataInicial, dataFinal]
  )
  const [consulta] = React.useState(
    () =>
      new HistoricoPedidosConsulta(user.negocioId ?? "", {
        listar: (f, s) => getPedidos(f, token, s),
        dispositivos: async (s) =>
          (await getDispositivos(token, s)).dispositivos,
        detalhe: (id, s) => getPedidoDetalhe(id, token, s),
      })
  )
  const estado = React.useSyncExternalStore(
    consulta.assinar,
    consulta.snapshot,
    consulta.snapshot
  )
  React.useEffect(() => {
    let ativa = true
    void Promise.resolve().then(() => {
      if (ativa) void consulta.carregar(filtros)
    })
    return () => {
      ativa = false
      consulta.cancelarConsultas()
    }
  }, [consulta, filtros])
  React.useEffect(() => () => consulta.cancelar(), [consulta])
  const filtroAtual = estado.filtro === JSON.stringify(filtros)
  const pedidos = React.useMemo(
    () => (filtroAtual ? (estado.pedidos.dados ?? []) : []),
    [filtroAtual, estado.pedidos.dados]
  )
  const dispositivos = estado.dispositivos.dados ?? []
  const pedidosDisponiveis = filtroAtual && estado.pedidos.dados !== null
  const isLoading =
    !filtroAtual || (estado.pedidos.carregando && !pedidosDisponiveis)
  const isRefetching =
    filtroAtual && estado.pedidos.carregando && pedidosDisponiveis
  const erro = filtroAtual ? estado.pedidos.erro : null
  const erroDetalhe = estado.detalhe.erro
  const pedidoDetalhe = estado.detalhe.dados
  const isLoadingDetalhe = estado.detalhe.carregando
  const pedidoSelecionadoId = estado.selecionadoId
  const setPedidoSelecionadoId = (id: string | null) => {
    if (id) void consulta.abrirDetalhe(id)
    else consulta.fecharDetalhe()
  }
  const abrirDetalhePedido = (id: string) => consulta.abrirDetalhe(id)
  const carregarPedidos = (silencioso = false) =>
    consulta.carregar(filtros, silencioso)
  const medido = (valor: React.ReactNode) =>
    pedidosDisponiveis ? valor : isLoading ? "..." : "Indisponível"

  const pedidosFiltrados = React.useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return pedidos

    return pedidos.filter((p) => {
      const senhaStr = p.senha !== null ? String(p.senha) : ""
      const cliente = (p.nomeCliente || p.codigoCliente || "").toLowerCase()
      const itens = p.itens.map((i) => i.nomeProduto.toLowerCase()).join(" ")
      return (
        p.id.toLowerCase().includes(termo) ||
        senhaStr.includes(termo) ||
        (p.senha !== null && formatarSenhaPedido(p.senha).includes(termo)) ||
        cliente.includes(termo) ||
        itens.includes(termo)
      )
    })
  }, [pedidos, busca])

  const metricas = React.useMemo(
    () => calcularMetricasPedidos(pedidosFiltrados),
    [pedidosFiltrados]
  )

  const limparFiltros = () => {
    setStatusFiltro("TODOS")
    setDataInicial("")
    setDataFinal("")
    setBusca("")
  }

  const temFiltroAtivo =
    statusFiltro !== "TODOS" ||
    Boolean(dataInicial) ||
    Boolean(dataFinal) ||
    Boolean(busca.trim())

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header Banner */}
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Gestão & Histórico de Pedidos
            </h1>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              {pedidosDisponiveis
                ? `${pedidosFiltrados.length} registros`
                : isLoading
                  ? "..."
                  : "Indisponível"}
            </Badge>
            {user?.role && (
              <Badge
                variant="secondary"
                className="rounded-full text-[10px] font-semibold uppercase"
              >
                Acesso {user.role}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Consulta real do estabelecimento com valores snapshot do servidor e
            acompanhamento operacional sem comandos administrativos indevidos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading || isRefetching}
            onClick={() => void carregarPedidos(true)}
            className="gap-1.5 rounded-xl text-xs font-semibold"
          >
            <RefreshCw
              className={cn("size-3.5", isRefetching && "animate-spin")}
            />
            {isRefetching ? "Atualizando..." : "Atualizar pedidos"}
          </Button>
        </div>
      </header>

      {estado.dispositivos.erro && (
        <p role="status" className="text-xs text-muted-foreground">
          Identificação da origem limitada: falha no cadastro de dispositivos (
          {estado.dispositivos.erro.codigo ?? "rede/timeout"}).{" "}
          {estado.dispositivos.dados
            ? "Cadastro anterior desatualizado."
            : "Cadastro indisponível."}
        </p>
      )}
      {estado.pedidos.atualizadoEm && filtroAtual && (
        <p className="text-xs text-muted-foreground">
          Última consulta de pedidos:{" "}
          {formatarDataHora(estado.pedidos.atualizadoEm)} (America/Sao_Paulo).{" "}
          {erro || isRefetching
            ? "Dados desatualizados: último snapshot preservado."
            : "Atualização manual."}
        </p>
      )}
      {/* Cards de Métricas do Servidor */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Pedidos Consultados
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {medido(metricas.totalPedidos)}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {medido(metricas.pedidosEntregues)} entregues •{" "}
              {medido(metricas.pedidosCancelados)} cancelados
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Ativos na Cozinha (KDS)
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ChefHat className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {medido(metricas.pedidosAtivosNaFila)}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Pendentes, em preparo ou prontos
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Valor nominal comercial
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {medido(formatarMoeda(metricas.valorNominalComercial))}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Inclui aguardando pagamento; sem DEMO ou cancelados. Não é receita
              recebida. Faturamento indisponível.
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Aguardando / Modo DEMO
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {medido(metricas.pedidosAguardandoPagamento)} retidos
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Valor DEMO sem cancelados:{" "}
              {medido(formatarMoeda(metricas.valorDemoOperacional))}
            </span>
          </div>
        </div>
      </section>

      {/* Barra de Filtros por Status, Período e Busca */}
      <section className="flex flex-col gap-4 rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Filter className="size-3.5 text-primary" />
            <span>Filtros de criação (America/Sao_Paulo)</span>
          </div>
          {temFiltroAtivo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={limparFiltros}
              className="h-7 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-status" className="text-xs">
              Status do Pedido
            </Label>
            <select
              id="filtro-status"
              value={statusFiltro}
              onChange={(e) =>
                setStatusFiltro(e.target.value as "TODOS" | StatusPedido)
              }
              className="h-9 w-full rounded-xl border border-input bg-transparent px-3 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {STATUS_PEDIDO_OPCOES.map((opt) => (
                <option key={opt.valor} value={opt.valor}>
                  {opt.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-data-inicio" className="text-xs">
              Criado a partir de (inclusivo)
            </Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filtro-data-inicio"
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="h-9 rounded-xl pl-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-data-fim" className="text-xs">
              Criado antes de (exclusivo)
            </Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filtro-data-fim"
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="h-9 rounded-xl pl-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-busca" className="text-xs">
              Buscar (Senha, Cliente ou Item)
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filtro-busca"
                placeholder="Ex.: #014, João, Burger..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 rounded-xl pl-9 text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Estados de Loading, Erro, Vazio e Listagem Real */}
      {isLoading ? (
        <PedidosSkeleton />
      ) : erro ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-3xl border border-destructive/30 bg-destructive/5 p-10 text-center shadow-xs"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            {erro.codigo === 401 || erro.codigo === 403 ? (
              <ShieldAlert className="size-6" />
            ) : (
              <TriangleAlert className="size-6" />
            )}
          </div>
          <h2 className="text-sm font-bold text-foreground">{erro.titulo}</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            {erro.detalhe}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void carregarPedidos(false)}
              className="gap-1.5 rounded-xl text-xs"
            >
              <RefreshCw className="size-3.5" />
              Tentar novamente
            </Button>
            {erro.codigo === 401 && (
              <Button
                type="button"
                size="sm"
                onClick={logout}
                className="rounded-xl text-xs"
              >
                Autenticar novamente
              </Button>
            )}
          </div>
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ClipboardList className="size-6" />
          </div>
          <h2 className="text-sm font-bold text-foreground">
            {temFiltroAtivo
              ? "Nenhum pedido encontrado para os filtros aplicados"
              : "Nenhum pedido registrado neste estabelecimento"}
          </h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {temFiltroAtivo
              ? "Ajuste o período ou o status selecionado para visualizar outros registros reais do servidor."
              : "Assim que os clientes realizarem pedidos nos totens de autoatendimento, eles aparecerão aqui com seus respectivos snapshots."}
          </p>
          {temFiltroAtivo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limparFiltros}
              className="mt-4 rounded-xl text-xs"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-border/40 bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="px-4 text-xs">
                  Senha / Data operacional
                </TableHead>
                <TableHead className="px-4 text-xs">
                  Criação (São Paulo)
                </TableHead>
                <TableHead className="px-4 text-xs">Cliente</TableHead>
                <TableHead className="px-4 text-xs">Origem</TableHead>
                <TableHead className="px-4 text-xs">
                  Itens & Snapshots
                </TableHead>
                <TableHead className="px-4 text-xs">Status</TableHead>
                <TableHead className="px-4 text-right text-xs">
                  Valor Servidor
                </TableHead>
                <TableHead className="px-4 text-right text-xs">
                  Detalhes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosFiltrados.map((pedido) => {
                const origem = descreverOrigemPedido(pedido, dispositivos)
                return (
                  <TableRow
                    key={pedido.id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <TableCell className="px-4">
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "font-mono text-xs font-bold",
                            pedido.senha !== null
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatarSenhaPedido(pedido.senha)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {pedido.senha === null
                            ? "Sem data operacional"
                            : pedido.dataOperacional || pedido.dataSequencial}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-4 text-xs text-muted-foreground">
                      {formatarDataHora(pedido.createdAt)}
                    </TableCell>

                    <TableCell className="px-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">
                          {pedido.nomeCliente ||
                            pedido.codigoCliente ||
                            "Não identificado"}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ID: {pedido.id.slice(0, 8)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">
                            {origem.rotulo}
                          </span>
                          {origem.isDemo && (
                            <Badge
                              variant="outline"
                              className="rounded-full border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold text-amber-700 dark:text-amber-400"
                            >
                              DEMO
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {origem.subtitulo}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="max-w-xs px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-xs text-foreground">
                          {pedido.itens
                            .map(
                              (item) =>
                                `${item.quantidade}x ${item.nomeProduto}${
                                  item.variacaoNome
                                    ? ` (${item.variacaoNome})`
                                    : ""
                                }`
                            )
                            .join(", ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {pedido.itens.length}{" "}
                          {pedido.itens.length === 1 ? "item" : "itens"} com
                          preço congelado
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-4">
                      <div className="flex items-center gap-1.5">
                        <StatusPedidoBadge status={pedido.status} />
                        {pedido.preparoZero && (
                          <Badge
                            variant="outline"
                            title="Todos os itens com Preparo Zero"
                            className="gap-0.5 rounded-full border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] text-emerald-700 dark:text-emerald-400"
                          >
                            <Zap className="size-2.5" />0 min
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 text-right font-mono text-xs font-bold text-foreground tabular-nums">
                      {formatarMoeda(pedido.valorTotal)}
                    </TableCell>

                    <TableCell className="px-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void abrirDetalhePedido(pedido.id)}
                        className="gap-1.5 rounded-xl text-xs"
                      >
                        <Eye className="size-3.5" />
                        Inspecionar
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Dialog Somente Leitura para Detalhes e Snapshots do Pedido */}
      <Dialog
        open={Boolean(pedidoSelecionadoId)}
        onOpenChange={(open) => {
          if (!open) {
            setPedidoSelecionadoId(null)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <span>Detalhes do Pedido</span>
              {pedidoDetalhe && (
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-bold"
                >
                  {formatarSenhaPedido(pedidoDetalhe.senha)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Visualização somente leitura sincronizada com o banco de dados do
              servidor (`GET /pedidos/:id`). Os valores abaixo correspondem aos
              snapshots gravados no momento da compra.
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetalhe ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <LoaderCircle className="mb-2 size-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Consultando detalhes do pedido no servidor...
              </span>
            </div>
          ) : erroDetalhe ? (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"
            >
              <p className="font-bold">{erroDetalhe.titulo}</p>
              <p className="mt-1">{erroDetalhe.detalhe}</p>
              {pedidoSelecionadoId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void abrirDetalhePedido(pedidoSelecionadoId)}
                  className="mt-3 gap-1.5 rounded-xl text-xs"
                >
                  <RefreshCw className="size-3" />
                  Recarregar detalhe
                </Button>
              )}
            </div>
          ) : pedidoDetalhe ? (
            <div className="space-y-4 text-xs">
              {/* Resumo Geral */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/40 bg-muted/20 p-4 sm:grid-cols-3">
                <div>
                  <span className="block text-[10px] text-muted-foreground uppercase">
                    Status Atual
                  </span>
                  <div className="mt-1">
                    <StatusPedidoBadge status={pedidoDetalhe.status} />
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground uppercase">
                    Senha KDS
                  </span>
                  <span className="mt-1 block font-mono text-sm font-bold text-foreground">
                    {formatarSenhaPedido(pedidoDetalhe.senha)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground uppercase">
                    Valor Total Servidor
                  </span>
                  <span className="mt-1 block font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatarMoeda(pedidoDetalhe.valorTotal)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground uppercase">
                    Cliente
                  </span>
                  <span className="mt-0.5 block font-semibold text-foreground">
                    {pedidoDetalhe.nomeCliente ||
                      pedidoDetalhe.codigoCliente ||
                      "Não informado"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground uppercase">
                    Origem / Canal
                  </span>
                  <span className="mt-0.5 block font-semibold text-foreground">
                    {descreverOrigemPedido(pedidoDetalhe, dispositivos).rotulo}
                    {pedidoDetalhe.demo ? " (DEMO)" : ""}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground uppercase">
                    Criado em
                  </span>
                  <span className="mt-0.5 block text-foreground">
                    {formatarDataHora(pedidoDetalhe.createdAt)}
                  </span>
                </div>
              </div>

              {pedidoDetalhe.observacoes && (
                <div className="rounded-2xl border border-border/40 bg-muted/15 p-3.5">
                  <span className="block text-[10px] font-semibold text-muted-foreground uppercase">
                    Observações do Pedido
                  </span>
                  <p className="mt-1 text-foreground">
                    {pedidoDetalhe.observacoes}
                  </p>
                </div>
              )}

              {/* Lista de Itens com Preço Snapshot */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                  Itens e Snapshots Imutáveis ({pedidoDetalhe.itens.length})
                </h3>
                <div className="divide-y divide-border/40 rounded-2xl border border-border/40">
                  {pedidoDetalhe.itens.map((item) => {
                    const subtotal = calcularSubtotalItemSnapshot(item)
                    return (
                      <div key={item.id} className="space-y-1.5 p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-foreground">
                              {item.quantidade}x {item.nomeProduto}
                            </span>
                            {item.variacaoNome && (
                              <Badge
                                variant="secondary"
                                className="ml-2 rounded-full text-[10px]"
                              >
                                {item.variacaoNome}
                              </Badge>
                            )}
                            <span className="block text-[11px] text-muted-foreground">
                              Snapshot unitário:{" "}
                              {formatarMoeda(item.precoNoMomento)}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {formatarMoeda(subtotal)}
                          </span>
                        </div>

                        {item.adicionais && item.adicionais.length > 0 && (
                          <div className="space-y-0.5 pl-3 text-[11px] text-muted-foreground">
                            {item.adicionais.map((adic) => (
                              <div
                                key={adic.id}
                                className="flex items-center justify-between"
                              >
                                <span>
                                  + {adic.quantidade}x {adic.nomeAdicional}
                                </span>
                                <span className="font-mono">
                                  {formatarMoeda(
                                    adic.precoNoMomento * adic.quantidade
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {item.escolhas && item.escolhas.length > 0 && (
                          <div className="space-y-0.5 pl-3 text-[11px] text-muted-foreground">
                            {item.escolhas.map((esc) => (
                              <div
                                key={esc.id}
                                className="flex items-center justify-between"
                              >
                                <span>• {esc.nomeItem}</span>
                                <span className="font-mono">
                                  {esc.deltaNoMomento > 0
                                    ? `+ ${formatarMoeda(esc.deltaNoMomento)}`
                                    : "Incluso"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {item.observacao && (
                          <p className="text-[11px] text-muted-foreground italic">
                            Obs: {item.observacao}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Registros Financeiros / Autorização */}
              <div className="rounded-2xl border border-border/40 bg-muted/20 p-3.5">
                <span className="block text-[10px] font-semibold text-muted-foreground uppercase">
                  Estado Financeiro / Autorização Operacional
                </span>
                {pedidoDetalhe.demo ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Pedido marcado como <strong>DEMO</strong> (
                    {pedidoDetalhe.demoAmbiente || "ambiente de ensaio"}). Não
                    gera transação financeira comercial.
                  </p>
                ) : pedidoDetalhe.pagamentos &&
                  pedidoDetalhe.pagamentos.length > 0 ? (
                  <div className="mt-1.5 space-y-1">
                    {pedidoDetalhe.pagamentos.map((pag) => (
                      <div
                        key={pag.id}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <span>
                          {pag.meio || "Pagamento"} • Status:{" "}
                          <strong>{pag.status}</strong>
                        </span>
                        <span className="font-mono font-semibold">
                          {formatarMoeda(pag.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Nenhuma transação financeira registrada para este pedido até
                    o momento.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PedidosSkeleton() {
  return (
    <div className="space-y-3 rounded-3xl border border-border/40 bg-card p-6 shadow-xs">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 border-b border-border/30 pb-3 last:border-none last:pb-0"
        >
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      ))}
    </div>
  )
}
