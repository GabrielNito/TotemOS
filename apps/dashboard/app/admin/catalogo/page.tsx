"use client"

import * as React from "react"
import {
  AlertCircle,
  Clock,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tag,
  UtensilsCrossed,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  CategoriaDialog,
  ProdutoDialog,
} from "@/components/catalogo/catalogo-dialogs"
import {
  ApiError,
  createCategoria,
  createProduto,
  deactivateProduto,
  getCatalogoAdministrativo,
  updateCategoria,
  updateProduto,
} from "@/lib/api"
import type { Categoria, Produto } from "@/lib/types/models"
import type {
  CategoriaFormValues,
  ProdutoFormValues,
} from "@/lib/schemas/catalogo"
import { cn } from "@/lib/utils"

function mensagemDoErro(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Não foi possível comunicar com a API. Tente novamente."
}

const assinarHidratacao = () => () => {}
const snapshotClienteHidratado = () => true
const snapshotServidorNaoHidratado = () => false

export default function CatalogoPage() {
  const [products, setProducts] = React.useState<Produto[]>([])
  const [categories, setCategories] = React.useState<Categoria[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("Todos")
  const [search, setSearch] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [categoriaDialogOpen, setCategoriaDialogOpen] = React.useState(false)
  const [produtoDialogOpen, setProdutoDialogOpen] = React.useState(false)
  const [editingCategoria, setEditingCategoria] =
    React.useState<Categoria | null>(null)
  const [editingProduto, setEditingProduto] = React.useState<Produto | null>(
    null
  )
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)
  const isHydrated = React.useSyncExternalStore(
    assinarHidratacao,
    snapshotClienteHidratado,
    snapshotServidorNaoHidratado
  )

  const carregarCatalogo = React.useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setIsLoading(true)
    setLoadError(null)
    try {
      const catalogo = await getCatalogoAdministrativo()
      setCategories(catalogo.categorias)
      setProducts(catalogo.produtos)
      return true
    } catch (error) {
      setLoadError(mensagemDoErro(error))
      return false
    } finally {
      if (showSkeleton) setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    async function carregarInicial() {
      await carregarCatalogo(true)
    }

    void carregarInicial()
  }, [carregarCatalogo])

  const actionsDisabled = (isHydrated && isLoading) || Boolean(loadError)

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategoryId === "Todos" ||
      product.categoriaId === selectedCategoryId
    return (
      matchesCategory &&
      product.nome.toLowerCase().includes(search.toLowerCase())
    )
  })
  const preparoZeroCount = products.filter(
    (product) => product.tempoEstimadoPreparo === 0
  ).length
  const tempoMedio = products.length
    ? (
        products.reduce(
          (total, product) => total + product.tempoEstimadoPreparo,
          0
        ) / products.length
      ).toFixed(1)
    : "0"
  const adicionaisCount = products.reduce(
    (total, product) => total + (product.adicionais?.length ?? 0),
    0
  )

  const avisarResultadoDoRefetch = async () => {
    const recarregou = await carregarCatalogo()
    if (!recarregou) {
      toast.error("A lista não foi atualizada", {
        description:
          "A alteração foi enviada. Tente recarregar o catálogo novamente.",
      })
    }
    return recarregou
  }

  const salvarCategoria = async (
    values: CategoriaFormValues
  ): Promise<boolean> => {
    if (editingCategoria) {
      await updateCategoria(editingCategoria.id, values)
    } else {
      await createCategoria({
        nome: values.nome,
        ordem: values.ordem,
      })
    }
    const recarregou = await avisarResultadoDoRefetch()
    if (!recarregou) return false
    toast.success(
      editingCategoria
        ? "Categoria atualizada com sucesso"
        : "Categoria criada com sucesso"
    )
    return true
  }

  const salvarProduto = async (values: ProdutoFormValues): Promise<boolean> => {
    if (editingProduto) {
      await updateProduto(editingProduto.id, {
        ...values,
      })
    } else {
      await createProduto({
        categoriaId: values.categoriaId,
        nome: values.nome,
        precoBase: values.precoBase,
        tempoEstimadoPreparo: values.tempoEstimadoPreparo,
        ativo: values.ativo,
        adicionais: values.adicionais.map(({ nome, preco, maximo }) => ({
          nome,
          preco,
          maximo,
        })),
      })
    }
    const recarregou = await avisarResultadoDoRefetch()
    if (!recarregou) return false
    toast.success(
      editingProduto
        ? "Produto atualizado com sucesso"
        : "Produto criado com sucesso"
    )
    return true
  }

  const alterarCategoriaAtiva = async (
    categoria: Categoria,
    ativo: boolean
  ) => {
    setUpdatingId(categoria.id)
    try {
      await updateCategoria(categoria.id, { ativo })
      if (!(await avisarResultadoDoRefetch())) return
      toast.success(ativo ? "Categoria ativada" : "Categoria desativada")
    } catch (error) {
      toast.error("Não foi possível alterar a categoria", {
        description: mensagemDoErro(error),
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const alterarProdutoAtivo = async (produto: Produto, ativo: boolean) => {
    setUpdatingId(produto.id)
    try {
      if (ativo) await updateProduto(produto.id, { ativo: true })
      else await deactivateProduto(produto.id)
      if (!(await avisarResultadoDoRefetch())) return
      toast.success(ativo ? "Produto ativado" : "Produto desativado")
    } catch (error) {
      toast.error("Não foi possível alterar o produto", {
        description: mensagemDoErro(error),
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const abrirCategoria = (categoria: Categoria | null) => {
    setEditingCategoria(categoria)
    setCategoriaDialogOpen(true)
  }
  const abrirProduto = (produto: Produto | null) => {
    setEditingProduto(produto)
    setProdutoDialogOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Catálogo de Produtos & Cardápio
            </h1>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              {products.filter((product) => product.ativo).length} Itens Ativos
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gerencie itens, categorias, adicionais e regras de preparo
            instantâneo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs"
            disabled={actionsDisabled}
            onClick={() => abrirCategoria(null)}
          >
            <Tag className="size-3.5" /> Nova Categoria
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
            disabled={actionsDisabled}
            onClick={() => abrirProduto(null)}
          >
            <Plus className="size-3.5" /> Adicionar Produto
          </Button>
        </div>
      </header>

      {isLoading ? (
        <CatalogoSkeleton />
      ) : loadError ? (
        <LoadError
          message={loadError}
          onRetry={() => void carregarCatalogo(true)}
        />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              icon={<UtensilsCrossed className="size-4" />}
              label="Total de Produtos"
              value={products.length}
              detail={`Em ${categories.filter((category) => category.ativo).length} categorias ativas`}
            />
            <Metric
              icon={<Zap className="size-4" />}
              label="Preparo Imediato (Zero)"
              value={`${preparoZeroCount} itens`}
              detail={
                preparoZeroCount
                  ? "Avançam direto para PRONTO"
                  : "Nenhum cadastrado"
              }
              tone="emerald"
            />
            <Metric
              icon={<Clock className="size-4" />}
              label="Tempo Médio Estimado"
              value={`${tempoMedio} min`}
              detail="Base de preparo na cozinha"
              tone="blue"
            />
            <Metric
              icon={<Layers className="size-4" />}
              label="Adicionais & Modificadores"
              value={adicionaisCount}
              detail="Configurados no catálogo"
              tone="amber"
            />
          </section>

          <section className="rounded-3xl border border-border/40 bg-card p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold">Categorias</span>
              <span className="text-[11px] text-muted-foreground">
                Edite ou altere a ativação
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((categoria) => (
                <div
                  key={categoria.id}
                  className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2"
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => abrirCategoria(categoria)}
                  >
                    <span className="block truncate text-xs font-semibold">
                      {categoria.nome}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Ordem {categoria.ordem}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => abrirCategoria(categoria)}
                    >
                      <Pencil />
                      <span className="sr-only">Editar {categoria.nome}</span>
                    </Button>
                    <Switch
                      aria-label={`${categoria.ativo ? "Desativar" : "Ativar"} categoria ${categoria.nome}`}
                      checked={categoria.ativo}
                      disabled={updatingId === categoria.id}
                      onCheckedChange={(ativo) =>
                        void alterarCategoriaAtiva(categoria, ativo)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-4 shadow-xs sm:flex-row sm:items-center">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "Todos", nome: "Todos" },
                ...categories.map((category) => ({
                  id: category.id,
                  nome: category.nome,
                })),
              ].map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
                    selectedCategoryId === category.id
                      ? "bg-foreground font-semibold text-background shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {category.nome}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 rounded-xl pl-9 text-xs"
              />
            </div>
          </section>

          {filteredProducts.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProdutoCard
                  key={product.id}
                  produto={product}
                  updating={updatingId === product.id}
                  onEdit={() => abrirProduto(product)}
                  onAtivoChange={(ativo) =>
                    void alterarProdutoAtivo(product, ativo)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              hasProducts={products.length > 0}
              onCreate={() => abrirProduto(null)}
            />
          )}
        </>
      )}

      <CategoriaDialog
        categoria={editingCategoria}
        open={categoriaDialogOpen}
        onOpenChange={setCategoriaDialogOpen}
        onSave={salvarCategoria}
      />
      <ProdutoDialog
        produto={editingProduto}
        categorias={categories}
        open={produtoDialogOpen}
        onOpenChange={setProdutoDialogOpen}
        onSave={salvarProduto}
      />
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  detail,
  tone = "primary",
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  detail: string
  tone?: "primary" | "emerald" | "blue" | "amber"
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-xl",
            tones[tone]
          )}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 space-y-0.5">
        <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </h3>
        <span className="text-[11px] text-muted-foreground">{detail}</span>
      </div>
    </div>
  )
}

function ProdutoCard({
  produto,
  updating,
  onEdit,
  onAtivoChange,
}: {
  produto: Produto
  updating: boolean
  onEdit: () => void
  onAtivoChange: (ativo: boolean) => void
}) {
  return (
    <div className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-border/80">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            className="truncate rounded-full text-[10px]"
          >
            {produto.categoria?.nome || "Sem categoria"}
          </Badge>
          {produto.tempoEstimadoPreparo === 0 ? (
            <Badge
              variant="outline"
              className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <Zap className="size-2.5" /> Preparo Zero
            </Badge>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {produto.tempoEstimadoPreparo} min
            </span>
          )}
        </div>
        <h4 className="text-base font-bold text-foreground">{produto.nome}</h4>
        <p className="text-[11px] text-muted-foreground">
          {produto.adicionais?.length ?? 0} adicionais
          {produto.esgotado ? " · Esgotado" : ""}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3">
        <span className="text-base font-bold text-foreground tabular-nums">
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(produto.precoBase)}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil />
            <span className="sr-only">Editar {produto.nome}</span>
          </Button>
          {updating ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              aria-label={`${produto.ativo ? "Desativar" : "Ativar"} produto ${produto.nome}`}
              checked={produto.ativo}
              onCheckedChange={onAtivoChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-destructive/20 bg-destructive/5 p-10 text-center">
      <AlertCircle className="size-6 text-destructive" />
      <p className="text-sm font-semibold">
        Não foi possível carregar o catálogo
      </p>
      <p className="text-xs text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={onRetry}
      >
        Tentar novamente
      </Button>
    </div>
  )
}

function EmptyState({
  hasProducts,
  onCreate,
}: {
  hasProducts: boolean
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <UtensilsCrossed className="size-6" />
      </div>
      <h3 className="text-sm font-bold text-foreground">
        {hasProducts
          ? "Nenhum produto encontrado"
          : "Nenhum produto cadastrado no cardápio"}
      </h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {hasProducts
          ? "Ajuste os filtros ou a busca para encontrar outro item."
          : "Cadastre os itens do seu estabelecimento para que eles fiquem disponíveis nos totens de autoatendimento."}
      </p>
      {!hasProducts && (
        <Button
          size="sm"
          className="mt-4 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          onClick={onCreate}
        >
          <Plus className="size-3.5" /> Cadastrar Primeiro Produto
        </Button>
      )}
    </div>
  )
}

function CatalogoSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-16 rounded-3xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-48 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}
