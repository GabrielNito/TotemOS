import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AtivarDispositivoSchema = z
  .object({
    codigo: z
      .string()
      .regex(/^\d{6}$/, 'Código de pareamento deve conter 6 dígitos'),
  })
  .strict();

export class AtivarDispositivoDto extends createZodDto(
  AtivarDispositivoSchema,
) {}
