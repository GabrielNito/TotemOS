"use client"

import * as React from "react"
import { useFieldArray, useForm, useWatch, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ImageIcon, Loader2, Plus, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { Categoria, Produto } from "@/lib/types/models"
import {
  CategoriaFormSchema,
  type CategoriaFormValues,
  ProdutoFormSchema,
  type ProdutoFormValues,
} from "@/lib/schemas/catalogo"

const novaCategoria: CategoriaFormValues = {
  nome: "",
  ordem: 0,
  ativo: true,
}

const novoAdicional = {
  nome: "",
  preco: 0,
  maximo: 1,
  esgotado: false,
}

function mensagemDoErro(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível salvar. Tente novamente."
}

interface CategoriaDialogProps {
  categoria: Categoria | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: CategoriaFormValues) => Promise<boolean>
}

export function CategoriaDialog({
  categoria,
  open,
  onOpenChange,
  onSave,
}: CategoriaDialogProps) {
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saveBlocked, setSaveBlocked] = React.useState(false)
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoriaFormValues>({
    resolver: zodResolver(CategoriaFormSchema),
    defaultValues: novaCategoria,
  })

  React.useEffect(() => {
    reset(
      categoria
        ? {
            nome: categoria.nome,
            ordem: categoria.ordem,
            ativo: categoria.ativo,
          }
        : novaCategoria
    )
  }, [categoria, open, reset])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null)
      setSaveBlocked(false)
    }
    onOpenChange(nextOpen)
  }

  const submit = async (values: CategoriaFormValues) => {
    setFormError(null)
    try {
      const saved = await onSave(values)
      if (saved) {
        handleOpenChange(false)
      } else {
        setSaveBlocked(true)
        setFormError(
          "A alteração foi enviada, mas a lista não foi atualizada. Feche o formulário e tente recarregar o catálogo."
        )
      }
    } catch (error) {
      const message = mensagemDoErro(error)
      setFormError(message)
      toast.error("Não foi possível salvar a categoria", {
        description: message,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">
            {categoria ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Organize os produtos do seu cardápio sem alterar pedidos já feitos.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
          {formError && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {formError}
            </p>
          )}
          <Campo
            label="Nome"
            error={errors.nome?.message}
            htmlFor="categoria-nome"
          >
            <Input
              id="categoria-nome"
              className={campoClass(errors.nome?.message)}
              disabled={isSubmitting || saveBlocked}
              {...register("nome")}
            />
          </Campo>
          <Campo
            label="Ordem"
            error={errors.ordem?.message}
            htmlFor="categoria-ordem"
          >
            <Input
              id="categoria-ordem"
              type="number"
              min={0}
              className={campoClass(errors.ordem?.message)}
              disabled={isSubmitting || saveBlocked}
              {...register("ordem", { valueAsNumber: true })}
            />
          </Campo>
          {categoria && (
            <Controller
              control={control}
              name="ativo"
              render={({ field }) => (
                <label className="flex items-center justify-between rounded-2xl bg-muted/40 px-3.5 py-3">
                  <span>
                    <span className="block text-xs font-semibold">
                      Categoria ativa
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Categorias inativas permanecem no painel.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    disabled={isSubmitting || saveBlocked}
                    onCheckedChange={field.onChange}
                  />
                </label>
              )}
            />
          )}
          <DialogFooter>
            {saveBlocked && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => handleOpenChange(false)}
              >
                Fechar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || saveBlocked}
              className="rounded-xl"
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {saveBlocked ? "Alteração enviada" : "Salvar categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface ProdutoDialogProps {
  produto: Produto | null
  categorias: Categoria[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: ProdutoFormValues) => Promise<boolean>
}

export function ProdutoDialog({
  produto,
  categorias,
  open,
  onOpenChange,
  onSave,
}: ProdutoDialogProps) {
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saveBlocked, setSaveBlocked] = React.useState(false)
  const [failedImageUrl, setFailedImageUrl] = React.useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProdutoFormValues>({
    resolver: zodResolver(ProdutoFormSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      precoBase: 0,
      imagemUrl: "",
      tempoEstimadoPreparo: 0,
      categoriaId: "",
      ativo: true,
      esgotado: false,
      adicionais: [],
    },
  })
  const { fields, append, remove } = useFieldArray({
    control,
    name: "adicionais",
    keyName: "fieldId",
  })

  const imagemUrlValue = useWatch({ control, name: "imagemUrl" })
  const tempoEstimadoValue = useWatch({ control, name: "tempoEstimadoPreparo" })
  const imageError = Boolean(
    imagemUrlValue && failedImageUrl === imagemUrlValue
  )

  React.useEffect(() => {
    reset({
      nome: produto?.nome ?? "",
      descricao: produto?.descricao ?? "",
      precoBase: produto?.precoBase ?? 0,
      imagemUrl: produto?.imagemUrl ?? "",
      tempoEstimadoPreparo: produto?.tempoEstimadoPreparo ?? 0,
      categoriaId: produto?.categoriaId ?? (categorias[0]?.id ?? ""),
      ativo: produto?.ativo ?? true,
      esgotado: produto?.esgotado ?? false,
      adicionais:
        produto?.adicionais?.map((adicional) => ({
          id: adicional.id,
          nome: adicional.nome,
          preco: adicional.preco,
          maximo: adicional.maximo,
          esgotado: adicional.esgotado,
        })) ?? [],
    })
  }, [produto, open, reset, categorias])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null)
      setSaveBlocked(false)
      setFailedImageUrl(null)
    }
    onOpenChange(nextOpen)
  }

  const submit = async (values: ProdutoFormValues) => {
    setFormError(null)
    try {
      const saved = await onSave(values)
      if (saved) {
        handleOpenChange(false)
      } else {
        setSaveBlocked(true)
        setFormError(
          "A alteração foi enviada, mas a lista não foi atualizada. Feche o formulário e tente recarregar o catálogo."
        )
      }
    } catch (error) {
      const message = mensagemDoErro(error)
      setFormError(message)
      toast.error("Não foi possível salvar o produto", { description: message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">
            {produto ? "Editar produto" : "Adicionar produto"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure informações, preços, imagem, preparo e modificadores deste item.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
          {formError && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {formError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Nome"
              error={errors.nome?.message}
              htmlFor="produto-nome"
            >
              <Input
                id="produto-nome"
                className={campoClass(errors.nome?.message)}
                disabled={isSubmitting || saveBlocked}
                {...register("nome")}
              />
            </Campo>
            <Campo
              label="Categoria"
              error={errors.categoriaId?.message}
              htmlFor="produto-categoria"
            >
              <select
                id="produto-categoria"
                className={campoClass(errors.categoriaId?.message)}
                disabled={isSubmitting || saveBlocked}
                {...register("categoriaId")}
              >
                <option value="">Selecione uma categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                    {categoria.ativo ? "" : " (inativa)"}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              label="Preço base (R$)"
              error={errors.precoBase?.message}
              htmlFor="produto-preco"
            >
              <Input
                id="produto-preco"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className={campoClass(errors.precoBase?.message)}
                disabled={isSubmitting || saveBlocked}
                {...register("precoBase", { valueAsNumber: true })}
              />
            </Campo>
            <Campo
              label="Tempo de preparo (min)"
              error={errors.tempoEstimadoPreparo?.message}
              htmlFor="produto-tempo"
            >
              <Input
                id="produto-tempo"
                type="number"
                min={0}
                step={1}
                className={campoClass(errors.tempoEstimadoPreparo?.message)}
                disabled={isSubmitting || saveBlocked}
                {...register("tempoEstimadoPreparo", { valueAsNumber: true })}
              />
              {tempoEstimadoValue === 0 && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Zap className="size-3" /> Preparo Zero: avança direto para PRONTO
                </span>
              )}
            </Campo>
          </div>

          <Campo
            label="Descrição detalhada (opcional)"
            error={errors.descricao?.message}
            htmlFor="produto-descricao"
          >
            <textarea
              id="produto-descricao"
              rows={2}
              placeholder="Ex: Pão brioche artesanal, hambúrguer de costela 160g, queijo prato e maionese da casa..."
              className={cn(
                "w-full resize-none rounded-xl border border-input bg-background p-3 text-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                errors.descricao?.message && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isSubmitting || saveBlocked}
              {...register("descricao")}
            />
          </Campo>

          <div className="grid gap-3">
            <Campo
              label="URL da Imagem (pública)"
              error={errors.imagemUrl?.message}
              htmlFor="produto-imagem"
            >
              <Input
                id="produto-imagem"
                type="url"
                placeholder="https://exemplo.com/fotos/lanche.jpg"
                className={campoClass(errors.imagemUrl?.message)}
                disabled={isSubmitting || saveBlocked}
                {...register("imagemUrl")}
              />
            </Campo>

            <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/20 p-3">
              <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted">
                {imagemUrlValue && !imageError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagemUrlValue}
                    alt="Prévia do produto"
                    className="size-full object-cover"
                    onError={() => setFailedImageUrl(imagemUrlValue)}
                  />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">
                  {imagemUrlValue
                    ? imageError
                      ? "Não foi possível carregar a imagem"
                      : "Foto carregada"
                    : "Sem foto cadastrada"}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {imagemUrlValue
                    ? imageError
                      ? "Verifique se a URL é pública e aponta para uma imagem válida."
                      : "Esta imagem será exibida nos totens de autoatendimento."
                    : "Itens sem foto utilizam a identificação padrão no Totem."}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Controller
              control={control}
              name="ativo"
              render={({ field }) => (
                <label className="flex items-center justify-between rounded-2xl bg-muted/40 p-3.5">
                  <span className="pr-2">
                    <span className="block text-xs font-semibold">
                      Produto ativo
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Desative para ocultar do Totem.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    disabled={isSubmitting || saveBlocked}
                    onCheckedChange={field.onChange}
                  />
                </label>
              )}
            />

            <Controller
              control={control}
              name="esgotado"
              render={({ field }) => (
                <label className="flex items-center justify-between rounded-2xl bg-muted/40 p-3.5">
                  <span className="pr-2">
                    <span className="block text-xs font-semibold">
                      Produto esgotado
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Permanece no catálogo, mas bloqueado no Totem.
                    </span>
                  </span>
                  <Switch
                    checked={field.value}
                    disabled={isSubmitting || saveBlocked}
                    onCheckedChange={field.onChange}
                  />
                </label>
              )}
            />
          </div>

          <section className="grid gap-3 rounded-2xl border border-border/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Adicionais</h3>
                <p className="text-[11px] text-muted-foreground">
                  Defina o máximo permitido por pedido.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs"
                disabled={isSubmitting || saveBlocked}
                onClick={() => append(novoAdicional)}
              >
                <Plus /> Adicionar
              </Button>
            </div>
            {fields.map((field, index) => (
              <div
                key={field.fieldId}
                className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-[1fr_100px_90px_auto_auto]"
              >
                <Campo
                  label="Nome"
                  error={errors.adicionais?.[index]?.nome?.message}
                  htmlFor={`adicional-nome-${field.fieldId}`}
                  compact
                >
                  <Input
                    id={`adicional-nome-${field.fieldId}`}
                    disabled={isSubmitting || saveBlocked}
                    {...register(`adicionais.${index}.nome`)}
                  />
                </Campo>
                <Campo
                  label="Preço (R$)"
                  error={errors.adicionais?.[index]?.preco?.message}
                  htmlFor={`adicional-preco-${field.fieldId}`}
                  compact
                >
                  <Input
                    id={`adicional-preco-${field.fieldId}`}
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={isSubmitting || saveBlocked}
                    {...register(`adicionais.${index}.preco`, {
                      valueAsNumber: true,
                    })}
                  />
                </Campo>
                <Campo
                  label="Máximo"
                  error={errors.adicionais?.[index]?.maximo?.message}
                  htmlFor={`adicional-maximo-${field.fieldId}`}
                  compact
                >
                  <Input
                    id={`adicional-maximo-${field.fieldId}`}
                    type="number"
                    min={1}
                    step={1}
                    disabled={isSubmitting || saveBlocked}
                    {...register(`adicionais.${index}.maximo`, {
                      valueAsNumber: true,
                    })}
                  />
                </Campo>
                <Controller
                  control={control}
                  name={`adicionais.${index}.esgotado`}
                  render={({ field: statusField }) => (
                    <label className="flex items-center gap-2 self-end pb-2 text-[11px] text-muted-foreground">
                      <Switch
                        size="sm"
                        checked={statusField.value}
                        disabled={isSubmitting || saveBlocked}
                        onCheckedChange={statusField.onChange}
                      />
                      Esgotado
                    </label>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="self-end text-muted-foreground hover:text-destructive"
                  disabled={isSubmitting || saveBlocked}
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                  <span className="sr-only">Remover adicional</span>
                </Button>
              </div>
            ))}
          </section>
          <DialogFooter>
            {saveBlocked && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => handleOpenChange(false)}
              >
                Fechar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || saveBlocked}
              className="rounded-xl"
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {saveBlocked ? "Alteração enviada" : "Salvar produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Campo({
  label,
  error,
  htmlFor,
  compact = false,
  children,
}: {
  label: string
  error?: string
  htmlFor: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label
        htmlFor={htmlFor}
        className={cn("font-semibold", compact ? "text-[11px]" : "text-xs")}
      >
        {label}
      </Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

function campoClass(error?: string) {
  return cn(
    "h-10 rounded-xl text-xs",
    error && "border-destructive focus-visible:ring-destructive"
  )
}
