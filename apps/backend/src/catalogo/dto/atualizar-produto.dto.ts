import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdicionalUpdateInputSchema = z.object({
  id: z
    .string()
    .uuid('ID do adicional deve ser um UUID válido')
    .optional()
    .describe(
      'UUID do adicional existente para atualização. Se omitido, um novo adicional será criado.',
    ),
  nome: z
    .string()
    .min(1, 'Nome do adicional é obrigatório')
    .describe('Nome do adicional (ex: Bacon Extra, Queijo Extra)'),
  preco: z
    .number()
    .min(0, 'Preço do adicional não pode ser negativo')
    .describe('Preço do adicional em reais'),
  maximo: z
    .number()
    .int()
    .min(1, 'Máximo deve ser pelo menos 1')
    .default(1)
    .describe('Quantidade máxima permitida por item do pedido'),
  esgotado: z
    .boolean()
    .optional()
    .default(false)
    .describe('Indica se o adicional está temporariamente esgotado'),
});

export const AtualizarProdutoSchema = z.object({
  categoriaId: z
    .string()
    .uuid('ID de categoria inválido — deve ser um UUID válido')
    .optional()
    .describe('UUID da categoria à qual o produto pertence'),
  nome: z
    .string()
    .min(1, 'Nome do produto não pode ser vazio')
    .optional()
    .describe('Nome do produto exibido no cardápio'),
  descricao: z.string().optional().describe('Descrição detalhada do produto'),
  precoBase: z
    .number()
    .positive('Preço base deve ser um valor positivo')
    .optional()
    .describe('Preço base do produto em reais'),
  imagemUrl: z
    .string()
    .url('URL de imagem inválida')
    .optional()
    .describe('URL pública da imagem do produto'),
  tempoEstimadoPreparo: z
    .number()
    .int()
    .min(0, 'Tempo de preparo não pode ser negativo')
    .optional()
    .describe('Tempo estimado de preparo em minutos'),
  esgotado: z
    .boolean()
    .optional()
    .describe('Indica se o produto está temporariamente esgotado'),
  ativo: z
    .boolean()
    .optional()
    .describe('Status de ativação do produto no catálogo'),
  adicionais: z
    .array(AdicionalUpdateInputSchema)
    .optional()
    .describe(
      'Lista completa de adicionais atualizados/novos para este produto',
    ),
});

export class AtualizarProdutoDto extends createZodDto(AtualizarProdutoSchema) {}
