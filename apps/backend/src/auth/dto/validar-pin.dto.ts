import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ValidarPinSchema = z.object({
  negocioId: z
    .string()
    .uuid('ID do negócio deve ser um UUID válido')
    .describe('UUID identificador do Negócio no sistema'),
  pin: z
    .string()
    .length(4, 'O PIN do dono deve conter exatamente 4 dígitos')
    .describe('PIN numérico de 4 dígitos do dono'),
});

export class ValidarPinDto extends createZodDto(ValidarPinSchema) {
  negocioId!: string;
  pin!: string;
}
