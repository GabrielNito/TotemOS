"use client"

import * as React from "react"
import {
  UtensilsCrossed,
  Plus,
  Search,
  Clock,
  Zap,
  Tag,
  Layers,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Produto, Categoria } from "@/lib/types/models"
import { cn } from "@/lib/utils"

export default function CatalogoPage() {
  // Estados dinâmicos preparados para receber dados reais do backend
  const [products] = React.useState<Produto[]>([])
  const [categories] = React.useState<Categoria[]>([])
  const [selectedCategory, setSelectedCategory] = React.useState("Todos")
  const [search, setSearch] = React.useState("")

  const categoryNames = ["Todos", ...categories.map((c) => c.nome)]

  const filteredProducts = products.filter((prod) => {
    const matchesCategory =
      selectedCategory === "Todos" || prod.categoria?.nome === selectedCategory
    const matchesSearch = prod.nome.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const preparoZeroCount = products.filter(
    (p) => p.tempoEstimadoPreparo === 0
  ).length

  const tempoMedio =
    products.length > 0
      ? (
          products.reduce((acc, p) => acc + p.tempoEstimadoPreparo, 0) /
          products.length
        ).toFixed(1)
      : "0"

  const combosEAdicionaisCount = products.reduce(
    (acc, p) => acc + (p.adicionais?.length || 0),
    0
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header Banner com Ações Rápidas */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Catálogo de Produtos & Cardápio
            </h1>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              {products.length} Itens Ativos
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gerencie itens, categorias, adicionais e regras de preparo
            instantâneo nos totens.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs"
          >
            <Tag className="size-3.5" />
            Nova Categoria
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      {/* Grade de 4 Métricas Bento do Cardápio */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total de Produtos
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UtensilsCrossed className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {products.length}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Em {categories.length} categorias ativas
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Preparo Imediato (Zero)
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Zap className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {preparoZeroCount} itens
            </h3>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {preparoZeroCount > 0
                ? "Avançam direto para PRONTO"
                : "Nenhum cadastrado"}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tempo Médio Estimado
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {tempoMedio} min
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Base de preparo na cozinha
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Adicionais & Modificadores
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {combosEAdicionaisCount}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Configurados no catálogo
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categoryNames.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
                selectedCategory === cat
                  ? "bg-foreground font-semibold text-background shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl pl-9 text-xs"
          />
        </div>
      </div>

      {/* Grid de Cards de Produtos ou Empty State */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-border/80"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className="rounded-full text-[10px]"
                  >
                    {prod.categoria?.nome || "Geral"}
                  </Badge>

                  {prod.tempoEstimadoPreparo === 0 ? (
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      <Zap className="size-2.5" />
                      Preparo Zero
                    </Badge>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {prod.tempoEstimadoPreparo} min
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-foreground">
                    {prod.nome}
                  </h4>
                  {prod.descricao && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {prod.descricao}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
                <span className="text-base font-bold text-foreground tabular-nums">
                  R$ {prod.precoBase.toFixed(2).replace(".", ",")}
                </span>

                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {prod.ativo ? "Disponível" : "Pausado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <UtensilsCrossed className="size-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Nenhum produto cadastrado no cardápio
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Cadastre os itens do seu estabelecimento para que eles fiquem
            disponíveis nos totens de autoatendimento.
          </p>
          <Button
            size="sm"
            className="mt-4 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            Cadastrar Primeiro Produto
          </Button>
        </div>
      )}
    </div>
  )
}
