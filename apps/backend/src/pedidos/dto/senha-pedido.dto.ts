import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatusPedido } from '@prisma/client';
export class SenhaPedidoDto extends createZodDto(z.object({}).strict()) {}
export class SenhaResponseDto extends createZodDto(
  z.object({
    resultadoOperacao: z.object({
      tipo: z.literal('ATRIBUICAO_SENHA'),
      repetida: z.boolean(),
    }),
    pedido: z.object({
      id: z.string().uuid(),
      status: z.nativeEnum(StatusPedido),
      senha: z.number().int(),
      dataOperacional: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      versao: z.number().int(),
      demo: z.boolean(),
    }),
  }),
) {}
