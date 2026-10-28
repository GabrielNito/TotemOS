import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TipoDispositivo } from '@prisma/client';

export const GerarCodigoSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, 'Nome do dispositivo é obrigatório')
      .max(100, 'Nome do dispositivo não pode exceder 100 caracteres'),
    tipo: z.nativeEnum(TipoDispositivo),
  })
  .strict();

export class GerarCodigoDto extends createZodDto(GerarCodigoSchema) {}
