"use client"

import * as React from "react"
import Link from "next/link"
import {
  DollarSign,
  TrendingUp,
  Clock,
  TabletSmartphone,
  ChefHat,
  ArrowUpRight,
  UtensilsCrossed,
  Radio,
  Plus,
} from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChartSplineMetric } from "@/components/dashboard/chart-spline-metric"
import { ChartPillBars } from "@/components/dashboard/chart-pill-bars"
import type { Pedido, Dispositivo } from "@/lib/types/models"
import { cn } from "@/lib/utils"

export default function AdminDashboardPage() {
  const { user } = useAuth()

  // Estados dinâmicos preparados para receber dados reais do backend
  const [pedidos] = React.useState<Pedido[]>([])
  const [dispositivos] = React.useState<Dispositivo[]>([])
  const [vendasHoje] = React.useState(0)
  const [tempoMedioPreparo] = React.useState(0)

  const totensAtivosCount = dispositivos.filter(
    (d) => d.tipo === "TOTEM" && d.ativo
  ).length
  const totensTotalCount = dispositivos.filter((d) => d.tipo === "TOTEM").length

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header Banner com Saudação e Status do Ecossistema */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {user?.negocioNome || "Painel de Gestão"}
            </h1>
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              Operação Conectada
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Visão consolidada de vendas, fila de produção e status dos
            dispositivos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/catalogo"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 rounded-xl text-xs"
            )}
          >
            <UtensilsCrossed className="size-3.5" />
            Gerenciar Cardápio
          </Link>
          <Link
            href="/admin/dispositivos"
            className={cn(
              buttonVariants({ size: "sm" }),
              "gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
            )}
          >
            <TabletSmartphone className="size-3.5" />
            Totens & KDS
          </Link>
        </div>
      </div>

      {/* Bento Grid Principal */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ================= COLUNA PRINCIPAL ESQUERDA (8 COLUNAS) ================= */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Grade de 4 Métricas Bento */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Vendas Hoje */}
            <div className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-border/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Vendas Hoje
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="size-4" />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  R$ {vendasHoje.toFixed(2).replace(".", ",")}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <TrendingUp className="size-3" />
                  0%
                  <span className="font-normal text-muted-foreground">
                    vs ontem
                  </span>
                </span>
              </div>
            </div>

            {/* Card 2: Fila na Cozinha */}
            <div className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-border/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Fila na Cozinha
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <ChefHat className="size-4" />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {pedidos.length} pedidos
                </h3>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Tempo médio: <strong>{tempoMedioPreparo} min</strong>
                </span>
              </div>
            </div>

            {/* Card 3: Tempo no Totem */}
            <div className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-border/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tempo no Totem
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Clock className="size-4" />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  0s
                </h3>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Aguardando interações
                </span>
              </div>
            </div>

            {/* Card 4: Totens Online */}
            <div className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-border/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Totens Ativos
                </span>
                <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TabletSmartphone className="size-4" />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {totensAtivosCount} / {totensTotalCount}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      totensAtivosCount > 0
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/50"
                    )}
                  />
                  {totensTotalCount > 0
                    ? `${totensAtivosCount} conectados`
                    : "Nenhum pareado"}
                </span>
              </div>
            </div>
          </div>

          {/* Gráfico de Barras em Cápsulas (Horários de Pico) */}
          <ChartPillBars />

          {/* Tabela da Fila em Tempo Real do KDS */}
          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
            <div className="flex items-center justify-between pb-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ChefHat className="size-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Fila da Cozinha em Tempo Real
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pedidos emitidos nos totens aguardando ou em processo de
                  montagem.
                </p>
              </div>

              <Link
                href="/admin/relatorios"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "gap-1 text-xs text-muted-foreground hover:text-foreground"
                )}
              >
                Ver histórico
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            {/* Renderização Condicional da Fila de Pedidos */}
            {pedidos.length > 0 ? (
              <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40">
                {pedidos.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-muted font-mono text-xs font-bold text-foreground">
                        #{order.senha}
                      </span>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {order.nomeCliente || `Cliente #${order.senha}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            • {order.dispositivo?.nome || "Totem"}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {order.itens
                            .map((i) => `${i.quantidade}x ${i.nomeProduto}`)
                            .join(", ")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pl-13 sm:justify-end sm:pl-0">
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        R$ {order.valorTotal.toFixed(2).replace(".", ",")}
                      </span>

                      <Badge
                        variant={
                          order.status === "PRONTO"
                            ? "default"
                            : order.status === "EM_PREPARO"
                              ? "secondary"
                              : "outline"
                        }
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
                          order.status === "EM_PREPARO" &&
                            "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400",
                          order.status === "PRONTO" &&
                            "bg-emerald-500 text-white dark:bg-emerald-600"
                        )}
                      >
                        {order.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-8 text-center">
                <div className="mb-2.5 flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <ChefHat className="size-5" />
                </div>
                <span className="text-xs font-bold text-foreground">
                  Fila da cozinha vazia
                </span>
                <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                  Nenhum pedido aguardando preparo no momento. Pedidos
                  confirmados nos totens entrarão nesta lista automaticamente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUNA LATERAL DIREITA (4 COLUNAS) ================= */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Card Hero: Gráfico Spline Customizado (Estilo Imagem 5) */}
          <ChartSplineMetric />

          {/* Card de Status dos Dispositivos & Maquininhas */}
          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
            <div className="flex items-center justify-between pb-4">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-foreground">
                  Hardware & Terminais
                </h4>
                <p className="text-xs text-muted-foreground">
                  Status de conexão dos dispositivos pareados.
                </p>
              </div>
              <Radio
                className={cn(
                  "size-4",
                  dispositivos.length > 0
                    ? "animate-pulse text-emerald-500"
                    : "text-muted-foreground/40"
                )}
              />
            </div>

            {dispositivos.length > 0 ? (
              <div className="space-y-3 text-xs">
                {dispositivos.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between rounded-2xl border border-border/40 bg-muted/20 p-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "size-2 rounded-full",
                          dev.ativo
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/50"
                        )}
                      />
                      <div>
                        <span className="block font-semibold text-foreground">
                          {dev.nome}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {dev.mpPointDeviceId || "Terminal Mercado Pago"}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px]"
                    >
                      {dev.ativo ? "Online" : "Offline"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-6 text-center">
                <span className="text-xs font-bold text-foreground">
                  Nenhum dispositivo pareado
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Conecte seus totens e painéis para monitorar o status aqui.
                </p>
                <Link
                  href="/admin/dispositivos"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-3 gap-1.5 rounded-xl text-xs"
                  )}
                >
                  <Plus className="size-3" />
                  Parear Dispositivo
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
