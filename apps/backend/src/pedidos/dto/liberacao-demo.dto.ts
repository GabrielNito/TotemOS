import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPedido } from '@prisma/client';

export const LiberacaoDemoSchema = z
  .object({
    motivo: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .describe('Justificativa de ensaio, registrada na auditoria.'),
    pin: z
      .string()
      .regex(/^\d{4}$/)
      .describe(
        'PIN do dono, verificado via bcrypt e nunca persistido nesta ação.',
      ),
    versaoEsperada: z
      .number()
      .int()
      .positive()
      .describe('Versão do pedido lida antes da solicitação.'),
  })
  .strict();
export class LiberacaoDemoDto extends createZodDto(LiberacaoDemoSchema) {}
export class LiberacaoDemoResponseDto extends createZodDto(
  z.object({
    resultadoOperacao: z.object({
      tipo: z.literal('LIBERACAO_DEMO'),
      repetida: z.boolean(),
    }),
    pedido: z.object({
      id: z.string().uuid(),
      status: z.nativeEnum(StatusPedido),
      senha: z.number().int().nullable(),
      versao: z.number().int(),
      demo: z.literal(true),
      demoAmbiente: z.string(),
      elegivelCozinha: z.boolean(),
      autorizacaoOperacional: z.object({
        tipo: z.literal('DEMO'),
        financeira: z.literal(false),
      }),
    }),
  }),
) {}
