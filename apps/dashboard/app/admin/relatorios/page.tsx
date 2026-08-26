"use client"

import * as React from "react"
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  QrCode,
  ShoppingBag,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChartSplineMetric } from "@/components/dashboard/chart-spline-metric"

interface TopProductItem {
  nome: string
  categoria: string
  pedidos: number
  total: string
  percentual: number
}

export default function RelatoriosPage() {
  // Estados dinâmicos preparados para receber dados reais do backend
  const [topProducts] = React.useState<TopProductItem[]>([])
  const [faturamentoTotal] = React.useState(0)
  const [totalPedidos] = React.useState(0)
  const [ticketMedio] = React.useState(0)
  const [pixPercentual] = React.useState(0)

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header Banner com Ações e Filtro de Período */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Relatórios Financeiros & Vendas
            </h1>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              Mês Atual
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Métricas de faturamento, ticket médio, produtos campeões e
            distribuição de pagamentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs"
          >
            <Calendar className="size-3.5" />
            Últimos 30 dias
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Download className="size-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Grade de 4 Métricas Bento */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Faturamento Consolidado
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              R$ {faturamentoTotal.toFixed(2).replace(".", ",")}
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <TrendingUp className="size-3" />
              0%
              <span className="font-normal text-muted-foreground">
                vs mês anterior
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total de Pedidos
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {totalPedidos}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Pedidos finalizados
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Ticket Médio
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BarChart3 className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              R$ {ticketMedio.toFixed(2).replace(".", ",")}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Por pedido faturado
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Preferência Pix Point
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <QrCode className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {pixPercentual}%
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Volume no visor Mercado Pago
            </span>
          </div>
        </div>
      </div>

      {/* Bento Grid Principal: Gráfico + Tabela de Produtos Mais Vendidos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna do Gráfico Spline Interativo (5 colunas) */}
        <div className="lg:col-span-5">
          <ChartSplineMetric />
        </div>

        {/* Coluna da Tabela de Produtos Mais Vendidos (7 colunas) */}
        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs lg:col-span-7">
          <div className="space-y-1 pb-4">
            <h3 className="text-base font-bold text-foreground">
              Produtos Campeões de Faturamento
            </h3>
            <p className="text-xs text-muted-foreground">
              Participação de cada item no faturamento consolidado da loja.
            </p>
          </div>

          {topProducts.length > 0 ? (
            <>
              <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/40">
                {topProducts.map((item, idx) => (
                  <div
                    key={item.nome}
                    className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-muted font-mono text-xs font-bold text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <div className="space-y-0.5">
                        <span className="block text-xs font-semibold text-foreground">
                          {item.nome}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.pedidos} pedidos ({item.percentual}% do total)
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-foreground tabular-nums">
                      {item.total}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divisão dos Meios de Pagamento na Base */}
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-border/40 bg-muted/20 p-4 text-xs">
                <div>
                  <span className="block text-[11px] text-muted-foreground">
                    Pix no Visor
                  </span>
                  <span className="font-bold text-foreground">0%</span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground">
                    Cartão de Débito
                  </span>
                  <span className="font-bold text-foreground">0%</span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground">
                    Cartão de Crédito
                  </span>
                  <span className="font-bold text-foreground">0%</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-8 text-center">
              <span className="text-xs font-bold text-foreground">
                Nenhum dado consolidado no período
              </span>
              <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                Os produtos mais vendidos e a participação dos meios de
                pagamento aparecerão aqui automaticamente conforme os pedidos
                forem finalizados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
