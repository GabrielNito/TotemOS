"use client"

import * as React from "react"
import {
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  ImageIcon,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  calcularDiagnosticoPublicacao,
  filtrarCatalogoPublico,
} from "@/lib/catalogo/regras-publicacao"
import { cn } from "@/lib/utils"

function mensagemDoErro(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Não foi possível comunicar com a API. Tente novamente."
}

interface ItemConfirmacao {
  tipo: "categoria" | "produto"
  id: string
  nome: string
}

const assinarHidratacao = () => () => {}
const snapshotClienteHidratado = () => true
const snapshotServidorNaoHidratado = () => false

export default function CatalogoPage() {
  const [products, setProducts] = React.useState<Produto[]>([])
  const [categories, setCategories] = React.useState<Categoria[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("Todos")
  const [search, setSearch] = React.useState("")
  const [abaAtiva, setAbaAtiva] = React.useState<"gestao" | "previa">("gestao")
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
  const [confirmacao, setConfirmacao] = React.useState<ItemConfirmacao | null>(
    null
  )

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
      const categoriasOrdenadas = catalogo.categorias
        .slice()
        .sort((a, b) => a.ordem - b.ordem)
      setCategories(categoriasOrdenadas)
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

  const catalogoPublico = React.useMemo(
    () => filtrarCatalogoPublico(categories, products),
    [categories, products]
  )

  const diagnostico = React.useMemo(
    () => calcularDiagnosticoPublicacao(categories, products),
    [categories, products]
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
    const imagemLimpa = values.imagemUrl?.trim() || null
    const descricaoLimpa = values.descricao?.trim() || null

    if (editingProduto) {
      await updateProduto(editingProduto.id, {
        categoriaId: values.categoriaId,
        nome: values.nome,
        descricao: descricaoLimpa,
        precoBase: values.precoBase,
        imagemUrl: imagemLimpa,
        tempoEstimadoPreparo: values.tempoEstimadoPreparo,
        esgotado: values.esgotado,
        ativo: values.ativo,
        adicionais: values.adicionais.map((adicional) => ({
          ...(adicional.id ? { id: adicional.id } : {}),
          nome: adicional.nome,
          preco: adicional.preco,
          maximo: adicional.maximo,
          esgotado: adicional.esgotado,
        })),
      })
    } else {
      await createProduto({
        categoriaId: values.categoriaId,
        nome: values.nome,
        descricao: descricaoLimpa,
        precoBase: values.precoBase,
        imagemUrl: imagemLimpa ?? undefined,
        tempoEstimadoPreparo: values.tempoEstimadoPreparo,
        esgotado: values.esgotado,
        ativo: values.ativo,
        adicionais: values.adicionais.map(
          ({ nome, preco, maximo, esgotado }) => ({
            nome,
            preco,
            maximo,
            esgotado,
          })
        ),
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

  const solicitarAlteracaoCategoriaAtiva = (
    categoria: Categoria,
    proximoAtivo: boolean
  ) => {
    if (!proximoAtivo && categoria.ativo) {
      setConfirmacao({
        tipo: "categoria",
        id: categoria.id,
        nome: categoria.nome,
      })
      return
    }
    void alterarCategoriaAtiva(categoria, proximoAtivo)
  }

  const solicitarAlteracaoProdutoAtivo = (
    produto: Produto,
    proximoAtivo: boolean
  ) => {
    if (!proximoAtivo && produto.ativo) {
      setConfirmacao({
        tipo: "produto",
        id: produto.id,
        nome: produto.nome,
      })
      return
    }
    void alterarProdutoAtivo(produto, proximoAtivo)
  }

  const executarConfirmacaoDesativacao = async () => {
    if (!confirmacao) return
    const alvo = confirmacao
    setConfirmacao(null)
    if (alvo.tipo === "categoria") {
      const cat = categories.find((c) => c.id === alvo.id)
      if (cat) await alterarCategoriaAtiva(cat, false)
    } else {
      const prod = products.find((p) => p.id === alvo.id)
      if (prod) await alterarProdutoAtivo(prod, false)
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
            Gerencie itens, categorias, fotos, adicionais e disponibilidade do
            Totem.
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
            disabled={actionsDisabled || categories.length === 0}
            title={
              categories.length === 0
                ? "Crie uma categoria antes de adicionar produtos"
                : undefined
            }
            onClick={() => abrirProduto(null)}
          >
            <Plus className="size-3.5" /> Adicionar Produto
          </Button>
        </div>
      </header>

      {/* Navegação entre Gestão e Prévia do Totem */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <button
          type="button"
          onClick={() => setAbaAtiva("gestao")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
            abaAtiva === "gestao"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="size-3.5" /> Gestão do Catálogo
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("previa")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
            abaAtiva === "previa"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Eye className="size-3.5" /> Prévia do Totem
          <Badge
            variant="secondary"
            className="ml-1 rounded-full text-[10px] font-semibold"
          >
            {diagnostico.produtosVisiveisNoTotem} no ar
          </Badge>
        </button>
      </div>

      {isLoading ? (
        <CatalogoSkeleton />
      ) : loadError ? (
        <LoadError
          message={loadError}
          onRetry={() => void carregarCatalogo(true)}
        />
      ) : abaAtiva === "previa" ? (
        <PreviaTotemView
          catalogoPublico={catalogoPublico}
          diagnostico={diagnostico}
          totalProdutosCadastrados={products.length}
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

          {/* Categorias */}
          <section className="rounded-3xl border border-border/40 bg-card p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold">Categorias</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  Organizadas na ordem de exibição do cardápio
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-lg text-xs"
                onClick={() => abrirCategoria(null)}
              >
                <Plus className="size-3" /> Nova Categoria
              </Button>
            </div>
            {categories.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((categoria) => (
                  <div
                    key={categoria.id}
                    className="flex items-center justify-between rounded-2xl bg-muted/40 px-3.5 py-2.5"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => abrirCategoria(categoria)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="block truncate text-xs font-semibold">
                          {categoria.nome}
                        </span>
                        {!categoria.ativo && (
                          <Badge
                            variant="secondary"
                            className="rounded-full px-1.5 py-0 text-[9px]"
                          >
                            Inativa
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Posição #{categoria.ordem}
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
                          solicitarAlteracaoCategoriaAtiva(categoria, ativo)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
                <Tag className="mx-auto mb-2 size-5 text-muted-foreground/60" />
                <p className="text-xs font-semibold text-foreground">
                  Nenhuma categoria cadastrada
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Crie sua primeira categoria para organizar e começar a
                  adicionar produtos.
                </p>
                <Button
                  size="sm"
                  className="mt-3 rounded-xl text-xs"
                  onClick={() => abrirCategoria(null)}
                >
                  <Plus className="size-3.5" /> Criar Primeira Categoria
                </Button>
              </div>
            )}
          </section>

          {/* Filtros e Busca */}
          {categories.length > 0 && (
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
          )}

          {/* Lista de Produtos */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProdutoCard
                  key={product.id}
                  produto={product}
                  updating={updatingId === product.id}
                  onEdit={() => abrirProduto(product)}
                  onAtivoChange={(ativo) =>
                    solicitarAlteracaoProdutoAtivo(product, ativo)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              categoriesCount={categories.length}
              productsCount={products.length}
              hasFilter={Boolean(search || selectedCategoryId !== "Todos")}
              onCreateCategory={() => abrirCategoria(null)}
              onCreateProduct={() => abrirProduto(null)}
            />
          )}
        </>
      )}

      {/* Diálogo de Categoria */}
      <CategoriaDialog
        categoria={editingCategoria}
        open={categoriaDialogOpen}
        onOpenChange={setCategoriaDialogOpen}
        onSave={salvarCategoria}
      />

      {/* Diálogo de Produto */}
      <ProdutoDialog
        produto={editingProduto}
        categorias={categories}
        open={produtoDialogOpen}
        onOpenChange={setProdutoDialogOpen}
        onSave={salvarProduto}
      />

      {/* Diálogo de Confirmação para Desativação */}
      <Dialog
        open={Boolean(confirmacao)}
        onOpenChange={(open) => !open && setConfirmacao(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">
              {confirmacao?.tipo === "categoria"
                ? "Desativar categoria"
                : "Desativar produto"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {confirmacao?.tipo === "categoria"
                ? `Ao desativar "${confirmacao.nome}", todos os produtos desta categoria deixarão de ser exibidos nos totens de autoatendimento.`
                : `Ao desativar "${confirmacao?.nome}", o produto será ocultado imediatamente dos totens de autoatendimento.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setConfirmacao(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => void executarConfirmacaoDesativacao()}
            >
              Confirmar desativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [imageFailed, setImageFailed] = React.useState(false)

  return (
    <div
      className={cn(
        "group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-border/80",
        !produto.ativo && "bg-card/60 opacity-75"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className="truncate rounded-full text-[10px]"
            >
              {produto.categoria?.nome || "Sem categoria"}
            </Badge>

            {!produto.ativo ? (
              <Badge
                variant="outline"
                className="rounded-full border-muted bg-muted text-[10px] text-muted-foreground"
              >
                Inativo
              </Badge>
            ) : produto.esgotado ? (
              <Badge
                variant="outline"
                className="rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
              >
                Esgotado
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                No Totem
              </Badge>
            )}
          </div>

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

        <div className="flex items-start gap-3">
          <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-muted/40">
            {produto.imagemUrl && !imageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={produto.imagemUrl}
                alt={produto.nome}
                className="size-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <ImageIcon className="size-6 text-muted-foreground/40" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="truncate text-base font-bold text-foreground">
              {produto.nome}
            </h4>
            {produto.descricao ? (
              <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                {produto.descricao}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/60 italic">
                Sem descrição cadastrada
              </p>
            )}
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground">
          {produto.adicionais?.length ?? 0} adicionais cadastrados
        </div>
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

function PreviaTotemView({
  catalogoPublico,
  diagnostico,
  totalProdutosCadastrados,
}: {
  catalogoPublico: ReturnType<typeof filtrarCatalogoPublico>
  diagnostico: ReturnType<typeof calcularDiagnosticoPublicacao>
  totalProdutosCadastrados: number
}) {
  return (
    <div className="space-y-6">
      {/* Painel de diagnóstico e regras */}
      <section className="space-y-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Eye className="size-4 text-primary" /> Visualização do Totem de
              Autoatendimento
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Exibe exatamente os itens e categorias disponíveis para compra
              neste momento.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              {diagnostico.produtosVisiveisNoTotem} produtos no ar
            </Badge>
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
            >
              {diagnostico.produtosEsgotados} esgotados
            </Badge>
            <Badge
              variant="outline"
              className="border-muted bg-muted text-xs text-muted-foreground"
            >
              {diagnostico.produtosInativos} inativos
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl bg-muted/30 p-4 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <span className="mb-0.5 block font-semibold text-foreground">
              Itens Inativos
            </span>
            Completamente ocultados da vitrine. Use quando uma categoria ou
            produto estiver fora de linha ou suspenso.
          </div>
          <div>
            <span className="mb-0.5 block font-semibold text-foreground">
              Itens Esgotados
            </span>
            Retirados do Totem temporariamente quando o estoque do dia acaba,
            preservando as configurações no catálogo.
          </div>
        </div>
      </section>

      {/* Conteúdo da prévia */}
      {catalogoPublico.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center">
          <EyeOff className="mb-3 size-8 text-muted-foreground/60" />
          <h3 className="text-sm font-bold text-foreground">
            Nenhum produto visível no Totem no momento
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            {totalProdutosCadastrados === 0
              ? "Cadastre categorias e produtos para que eles apareçam aqui."
              : "Todos os produtos estão inativos, esgotados ou dentro de categorias desativadas. Para publicar no Totem, ative uma categoria e marque produtos disponíveis."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {catalogoPublico.map((categoria) => (
            <section key={categoria.id} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  {categoria.nome}
                </h3>
                <Badge variant="secondary" className="text-[10px]">
                  {categoria.produtos.length}{" "}
                  {categoria.produtos.length === 1 ? "produto" : "produtos"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoria.produtos.map((produto) => (
                  <PreviaProdutoCard key={produto.id} produto={produto} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function PreviaProdutoCard({ produto }: { produto: Produto }) {
  const [imageFailed, setImageFailed] = React.useState(false)

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-4 shadow-xs">
      <div className="space-y-3">
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border/30 bg-muted/40">
          {produto.imagemUrl && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={produto.imagemUrl}
              alt={produto.nome}
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground/40" />
          )}
          {produto.tempoEstimadoPreparo === 0 && (
            <Badge
              variant="outline"
              className="absolute top-2 right-2 gap-1 rounded-full border-emerald-500/30 bg-background/90 text-[10px] font-semibold text-emerald-600 shadow-xs dark:text-emerald-400"
            >
              <Zap className="size-2.5" /> Preparo Zero
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">{produto.nome}</h4>
          {produto.descricao && (
            <p className="line-clamp-2 text-[11px] text-muted-foreground">
              {produto.descricao}
            </p>
          )}
        </div>

        {produto.adicionais && produto.adicionais.length > 0 && (
          <div className="rounded-xl bg-muted/30 p-2.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              Adicionais disponíveis:
            </span>{" "}
            {produto.adicionais.map((a) => a.nome).join(", ")}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-3">
        <span className="text-sm font-bold text-foreground tabular-nums">
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(produto.precoBase)}
        </span>
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
        >
          Disponível no Totem
        </Badge>
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
  categoriesCount,
  productsCount,
  hasFilter,
  onCreateCategory,
  onCreateProduct,
}: {
  categoriesCount: number
  productsCount: number
  hasFilter: boolean
  onCreateCategory: () => void
  onCreateProduct: () => void
}) {
  if (categoriesCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Tag className="size-6" />
        </div>
        <h3 className="text-sm font-bold text-foreground">
          Seu cardápio ainda não possui categorias
        </h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Para começar a cadastrar produtos, primeiro crie pelo menos uma
          categoria (ex: Lanches, Bebidas, Sobremesas).
        </p>
        <Button
          size="sm"
          className="mt-4 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          onClick={onCreateCategory}
        >
          <Plus className="size-3.5" /> Criar Primeira Categoria
        </Button>
      </div>
    )
  }

  if (productsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <UtensilsCrossed className="size-6" />
        </div>
        <h3 className="text-sm font-bold text-foreground">
          Nenhum produto cadastrado no cardápio
        </h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Sua categoria já está criada. Agora adicione o primeiro produto para
          que ele fique disponível nos totens.
        </p>
        <Button
          size="sm"
          className="mt-4 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          onClick={onCreateProduct}
        >
          <Plus className="size-3.5" /> Cadastrar Primeiro Produto
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <UtensilsCrossed className="size-6" />
      </div>
      <h3 className="text-sm font-bold text-foreground">
        Nenhum produto encontrado
      </h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {hasFilter
          ? "Ajuste os filtros ou o termo de busca para encontrar outro item."
          : "Nenhum produto cadastrado nesta categoria."}
      </p>
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
