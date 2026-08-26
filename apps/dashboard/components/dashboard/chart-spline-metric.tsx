"use client"

import * as React from "react"
import { TrendingUp, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

type PeriodType = "dia" | "semana" | "mes" | "ano"

interface DataPoint {
  label: string
  value: number
  formatted: string
  growth: string
  isPositive: boolean
}

// Estrutura de datasets preparada para o backend (inicializada limpa/nula)
const EMPTY_DATASETS: Record<
  PeriodType,
  {
    title: string
    points: DataPoint[]
    targetPercentage: number
    targetDescription: string
  }
> = {
  dia: {
    title: "Faturamento de Hoje",
    targetPercentage: 0,
    targetDescription: "R$ 0,00 faturado da meta diária",
    points: [
      {
        label: "08h",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "11h",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "13h",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "15h",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "18h",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "20h",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "22h",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
    ],
  },
  semana: {
    title: "Faturamento Semanal",
    targetPercentage: 0,
    targetDescription: "R$ 0,00 faturado da meta",
    points: [
      {
        label: "Seg",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Ter",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Qua",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Qui",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Sex",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Sáb",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Dom",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
    ],
  },
  mes: {
    title: "Faturamento do Mês",
    targetPercentage: 0,
    targetDescription: "R$ 0,00 faturado da meta mensal",
    points: [
      {
        label: "Mai",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Jun",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Jul",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Ago",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Set",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Out",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "Nov",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
    ],
  },
  ano: {
    title: "Faturamento Anual",
    targetPercentage: 0,
    targetDescription: "R$ 0,00 faturado da meta anual",
    points: [
      {
        label: "2020",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "2021",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "2022",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "2023",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "2024",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "2025",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
      {
        label: "2026",
        value: 0,
        formatted: "R$ 0,00",
        growth: "0%",
        isPositive: true,
      },
    ],
  },
}

export function ChartSplineMetric() {
  const [periodo, setPeriodo] = React.useState<PeriodType>("mes")
  const dataset = EMPTY_DATASETS[periodo]

  // Ponto ativo selecionado
  const [selectedIndex, setSelectedIndex] = React.useState(5)

  // Dimensões do SVG
  const width = 460
  const height = 175
  const paddingX = 25
  const paddingBottom = 20
  const paddingTop = 25

  const points = dataset.points
  const values = points.map((p) => p.value)
  const maxVal = Math.max(...values, 100)
  const minVal = 0

  // Cálculo das coordenadas Bézier SVG
  const coords = points.map((p, i) => {
    const x = paddingX + (i * (width - 2 * paddingX)) / (points.length - 1)
    const normalizedY = (p.value - minVal) / (maxVal - minVal)
    const y =
      height -
      paddingBottom -
      normalizedY * (height - paddingTop - paddingBottom)
    return { x, y, ...p }
  })

  // Geração do caminho spline suave
  const generateSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return ""
    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const current = pts[i]
      const next = pts[i + 1]
      const controlX = (current.x + next.x) / 2
      d += ` C ${controlX},${current.y} ${controlX},${next.y} ${next.x},${next.y}`
    }
    return d
  }

  const curvePath = generateSmoothPath(coords)
  const areaPath = `${curvePath} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`

  const activePoint = coords[selectedIndex] || coords[coords.length - 1]

  const handlePeriodChange = (p: PeriodType) => {
    setPeriodo(p)
    setSelectedIndex(EMPTY_DATASETS[p].points.length - 2)
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect()
    const clickX = ((e.clientX - svgRect.left) / svgRect.width) * width

    let closestIdx = 0
    let minDiff = Infinity
    coords.forEach((coord, idx) => {
      const diff = Math.abs(coord.x - clickX)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = idx
      }
    })

    setSelectedIndex(closestIdx)
  }

  return (
    <div className="relative flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs transition-all hover:border-border/80">
      {/* Top Header & Period Selector */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {dataset.title}
            </span>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tight text-foreground tabular-nums transition-all duration-200">
                {activePoint.formatted}
              </h3>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                <TrendingUp className="size-3.5" />
                {activePoint.growth}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="size-4" />
          </button>
        </div>

        {/* Seletor de Período */}
        <div className="flex items-center gap-1">
          {(["dia", "semana", "mes", "ano"] as PeriodType[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-all",
                periodo === p
                  ? "bg-muted font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "dia"
                ? "Dia"
                : p === "semana"
                  ? "Semana"
                  : p === "mes"
                    ? "Mês"
                    : "Ano"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Spline Graph */}
      <div className="relative my-4 w-full cursor-crosshair">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full overflow-visible select-none"
          onMouseMove={handleMouseMove}
        >
          <defs>
            <linearGradient
              id="splineGradientInteractive"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="currentColor"
                stopOpacity="0.18"
                className="text-foreground"
              />
              <stop
                offset="80%"
                stopColor="currentColor"
                stopOpacity="0.02"
                className="text-foreground"
              />
              <stop
                offset="100%"
                stopColor="currentColor"
                stopOpacity="0"
                className="text-foreground"
              />
            </linearGradient>
          </defs>

          {/* Preenchimento de Área */}
          <path
            d={areaPath}
            fill="url(#splineGradientInteractive)"
            className="transition-all duration-300"
          />

          {/* Linha Vertical Conectora */}
          <line
            x1={activePoint.x}
            y1={activePoint.y}
            x2={activePoint.x}
            y2={height}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            className="text-muted-foreground/60 transition-all duration-150"
          />

          {/* Linha Spline */}
          <path
            d={curvePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground transition-all duration-300"
          />

          {/* Áreas invisíveis de hover */}
          {coords.map((c, i) => (
            <circle
              key={c.label}
              cx={c.x}
              cy={c.y}
              r="14"
              fill="transparent"
              onMouseEnter={() => setSelectedIndex(i)}
              className="cursor-pointer"
            />
          ))}

          {/* Marcador Circular Ativo */}
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="6"
            stroke="currentColor"
            strokeWidth="3"
            className="fill-background text-foreground transition-all duration-150"
          />
        </svg>

        {/* Eixo X com Labels */}
        <div className="mt-2 flex h-7 items-center justify-between px-1">
          {coords.map((c, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className="flex h-7 min-w-8 items-center justify-center rounded-full focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex h-6 min-w-7 items-center justify-center rounded-full px-2 text-[11px] tabular-nums transition-colors duration-150",
                    isSelected
                      ? "bg-foreground font-semibold text-background shadow-xs"
                      : "font-medium text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Widget de Meta Operacional Zerado */}
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-zinc-900 p-4 text-zinc-100 shadow-md dark:border dark:border-border/30 dark:bg-zinc-950">
        <div className="space-y-0.5">
          <span className="text-[11px] font-medium text-zinc-400">
            Meta Operacional (
            {periodo === "mes"
              ? "Mensal"
              : periodo === "dia"
                ? "Diária"
                : periodo === "semana"
                  ? "Semanal"
                  : "Anual"}
            )
          </span>
          <p className="text-sm font-semibold text-zinc-100">
            {dataset.targetPercentage}% Atingida
          </p>
          <span className="text-[10px] text-zinc-400">
            {dataset.targetDescription}
          </span>
        </div>

        {/* Donut Visual */}
        <div className="relative flex size-12 items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-zinc-800"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-zinc-100 transition-all duration-500"
              strokeDasharray={`${dataset.targetPercentage}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-zinc-100 tabular-nums">
            {dataset.targetPercentage}%
          </span>
        </div>
      </div>
    </div>
  )
}
