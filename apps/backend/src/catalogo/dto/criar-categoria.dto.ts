import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CriarCategoriaSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome da categoria é obrigatório')
    .describe('Nome da categoria (ex: Lanches, Bebidas, Sobremesas)'),
  ordem: z
    .number()
    .int()
    .min(0, 'Ordem não pode ser negativa')
    .default(0)
    .describe('Posição de exibição no cardápio (0 = primeiro)'),
});

export class CriarCategoriaDto extends createZodDto(CriarCategoriaSchema) {}
