"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { coordenadasSerie, type PontoSerie } from "@/lib/indicadores"
export function ChartSplineMetric({
  data,
  descricao = "Pedidos registrados",
}: {
  data?: PontoSerie[]
  descricao?: string
}) {
  const [selection, setSelectedIndex] = React.useState(0)
  const coords = coordenadasSerie(data ?? []).map((p) => ({
    ...p,
    formatted: p.value + " pedidos",
  }))
  const selectedIndex = Math.min(selection, Math.max(0, coords.length - 1))
  const width = 460,
    height = 175
  const activePoint = coords[selectedIndex]
  let curvePath = coords.length ? "M " + coords[0].x + "," + coords[0].y : ""
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i],
      next = coords[i + 1],
      controlX = (current.x + next.x) / 2
    curvePath +=
      " C " +
      controlX +
      "," +
      current.y +
      " " +
      controlX +
      "," +
      next.y +
      " " +
      next.x +
      "," +
      next.y
  }
  const areaPath = coords.length
    ? curvePath +
      " L " +
      coords[coords.length - 1].x +
      "," +
      height +
      " L " +
      coords[0].x +
      "," +
      height +
      " Z"
    : ""
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const x = ((e.clientX - rect.left) / rect.width) * width
    let closest = 0
    coords.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(coords[closest].x - x)) closest = i
    })
    setSelectedIndex(closest)
  }
  return (
    <div className="relative flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs transition-all hover:border-border/80">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Pedidos registrados</h3>
        <p className="text-xs text-muted-foreground">{descricao}</p>
        {activePoint && (
          <p aria-live="polite" className="text-3xl font-bold tabular-nums">
            {activePoint.formatted}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {activePoint.label}
            </span>
          </p>
        )}
      </div>
      {!activePoint ? (
        <p className="py-12 text-sm text-muted-foreground">
          {data
            ? "Nenhum pedido registrado no período"
            : "Indicador indisponível"}
        </p>
      ) : (
        <>
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
            <div className="mt-2 flex h-7 items-center justify-between gap-2 overflow-x-auto px-1">
              {coords.map((c, idx) => {
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-label={`${c.label}: ${c.value} pedidos`}
                    aria-pressed={idx === selectedIndex}
                    onClick={() => setSelectedIndex(idx)}
                    className="flex h-7 min-w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
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
        </>
      )}
    </div>
  )
}
