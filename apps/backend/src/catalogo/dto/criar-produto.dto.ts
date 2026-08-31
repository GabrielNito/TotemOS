import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdicionalInputSchema = z.object({
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
});

export const CriarProdutoSchema = z.object({
  categoriaId: z
    .string()
    .uuid('ID de categoria inválido — deve ser um UUID válido')
    .describe('UUID da categoria à qual o produto pertence'),
  nome: z
    .string()
    .min(1, 'Nome do produto é obrigatório')
    .describe('Nome do produto exibido no cardápio (ex: X-Burguer Artesanal)'),
  descricao: z
    .string()
    .optional()
    .describe('Descrição detalhada do produto (ingredientes, modo de preparo)'),
  precoBase: z
    .number()
    .positive('Preço base deve ser um valor positivo')
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
    .default(0)
    .describe(
      'Tempo estimado de preparo em minutos. 0 = sem preparo (ex: bebidas enlatadas)',
    ),
  adicionais: z
    .array(AdicionalInputSchema)
    .optional()
    .describe('Lista de adicionais disponíveis para este produto'),
});

export class CriarProdutoDto extends createZodDto(CriarProdutoSchema) {}
