"use client"

import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"

import type { HoraPedidos } from "@/lib/indicadores"

export function ChartPillBars({
  data,
  descricao,
}: {
  data: HoraPedidos[]
  descricao: string
}) {
  const peakItem = data.find(
    (item) => item.orders === Math.max(...data.map((d) => d.orders))
  )

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs transition-all hover:border-border/80">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              Horários de pico
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>

        <Badge
          variant="secondary"
          className="gap-1 rounded-full text-[11px] font-medium"
        >
          {peakItem
            ? `Pico: ${peakItem.time} (${peakItem.orders} pedidos)`
            : "Sem pedidos registrados"}
        </Badge>
      </div>

      {data.length === 0 && (
        <p className="py-8 text-sm text-muted-foreground">
          Nenhum pedido registrado no período
        </p>
      )}
      {/* Pill Bars Container */}
      <div className="flex items-end justify-between gap-2.5 overflow-x-auto pt-4 pb-2">
        {data.map((item) => (
          <div
            key={item.time}
            tabIndex={0}
            aria-label={`${item.time}: ${item.orders} pedidos`}
            className="group flex min-w-7 flex-1 flex-col items-center gap-2"
          >
            {/* Value tooltip on hover */}
            <span className="text-[10px] font-semibold text-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              {item.orders}
            </span>

            {/* Vertical Pill Capsule Slot */}
            <div className="relative h-36 w-full max-w-7 overflow-hidden rounded-full bg-muted/40 p-1">
              <div
                className="absolute inset-x-1 bottom-1 rounded-full bg-muted-foreground/30 transition-all duration-500"
                style={{
                  height: `${item.percentage}%`,
                }}
              />
            </div>

            {/* Hour Label */}
            <span className="text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
