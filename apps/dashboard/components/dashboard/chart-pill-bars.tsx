"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface HourlyData {
  time: string
  orders: number
  percentage: number
  isPeak?: boolean
}

// Estrutura de horários zerada pronta para agregação do backend
const EMPTY_HOURLY_ORDERS: HourlyData[] = [
  { time: "11h", orders: 0, percentage: 0 },
  { time: "12h", orders: 0, percentage: 0 },
  { time: "13h", orders: 0, percentage: 0 },
  { time: "14h", orders: 0, percentage: 0 },
  { time: "15h", orders: 0, percentage: 0 },
  { time: "18h", orders: 0, percentage: 0 },
  { time: "19h", orders: 0, percentage: 0 },
  { time: "20h", orders: 0, percentage: 0 },
  { time: "21h", orders: 0, percentage: 0 },
  { time: "22h", orders: 0, percentage: 0 },
]

export function ChartPillBars() {
  const [data] = React.useState<HourlyData[]>(EMPTY_HOURLY_ORDERS)

  const peakItem = data.find((item) => item.isPeak)

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs transition-all hover:border-border/80">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              Horários de Pico (Hoje)
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Volume de pedidos distribuído por horário de operação.
          </p>
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

      {/* Pill Bars Container */}
      <div className="flex items-end justify-between gap-2.5 pt-4 pb-2">
        {data.map((item) => (
          <div
            key={item.time}
            className="group flex flex-1 flex-col items-center gap-2"
          >
            {/* Value tooltip on hover */}
            <span className="text-[10px] font-semibold text-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
              {item.orders}
            </span>

            {/* Vertical Pill Capsule Slot */}
            <div className="relative h-36 w-full max-w-7 overflow-hidden rounded-full bg-muted/40 p-1">
              <div
                className="absolute inset-x-1 bottom-1 rounded-full bg-muted-foreground/30 transition-all duration-500"
                style={{
                  height: `${item.percentage > 0 ? Math.max(item.percentage - 6, 8) : 4}%`,
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
