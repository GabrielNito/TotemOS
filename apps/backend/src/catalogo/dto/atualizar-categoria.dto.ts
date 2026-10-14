import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AtualizarCategoriaSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome da categoria não pode ser vazio')
    .optional()
    .describe('Nome da categoria'),
  ordem: z
    .number()
    .int()
    .min(0, 'Ordem não pode ser negativa')
    .optional()
    .describe('Posição de exibição no cardápio'),
  ativo: z
    .boolean()
    .optional()
    .describe('Status de ativação da categoria no catálogo'),
});

export class AtualizarCategoriaDto extends createZodDto(
  AtualizarCategoriaSchema,
) {}
