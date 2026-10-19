import { z } from "zod"

const numeroObrigatorio = (mensagem: string) =>
  z.number({ error: mensagem }).finite(mensagem)

export const CategoriaFormSchema = z.object({
  nome: z.string().trim().min(1, "O nome da categoria é obrigatório"),
  ordem: numeroObrigatorio("Informe uma ordem válida")
    .int("A ordem deve ser um número inteiro")
    .min(0, "A ordem não pode ser negativa"),
  ativo: z.boolean(),
})

export const AdicionalFormSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1, "O nome do adicional é obrigatório"),
  preco: numeroObrigatorio("Informe um preço válido").min(
    0,
    "O preço não pode ser negativo"
  ),
  maximo: numeroObrigatorio("Informe o limite máximo")
    .int("O limite deve ser um número inteiro")
    .min(1, "O limite deve ser pelo menos 1"),
  esgotado: z.boolean(),
})

export const ProdutoFormSchema = z.object({
  nome: z.string().trim().min(1, "O nome do produto é obrigatório"),
  descricao: z.string().trim().optional(),
  precoBase: numeroObrigatorio("Informe um preço válido").positive(
    "O preço deve ser maior que zero"
  ),
  imagemUrl: z
    .string()
    .trim()
    .url("Informe uma URL de imagem válida")
    .optional()
    .or(z.literal("")),
  tempoEstimadoPreparo: numeroObrigatorio("Informe um tempo válido")
    .int("O tempo deve ser um número inteiro")
    .min(0, "O tempo não pode ser negativo"),
  categoriaId: z.string().uuid("Selecione uma categoria válida"),
  ativo: z.boolean(),
  esgotado: z.boolean(),
  adicionais: z.array(AdicionalFormSchema),
})

export type CategoriaFormValues = z.infer<typeof CategoriaFormSchema>
export type ProdutoFormValues = z.infer<typeof ProdutoFormSchema>
