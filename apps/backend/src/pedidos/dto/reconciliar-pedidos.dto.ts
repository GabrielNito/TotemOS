import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CriarPedidoSchema } from './criar-pedido.dto';

export const PedidoOfflineSchema = z
  .object({
    dispositivoId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
    pedido: CriarPedidoSchema.omit({ idempotencyKey: true }),
  })
  .strict();

export const ReconciliarPedidosSchema = z
  .object({
    pedidos: z.array(PedidoOfflineSchema).min(1).max(50),
  })
  .strict();

export class ReconciliarPedidosDto extends createZodDto(
  ReconciliarPedidosSchema,
) {}
