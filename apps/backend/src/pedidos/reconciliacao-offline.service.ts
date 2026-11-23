import { Injectable } from '@nestjs/common';
import type { ReconciliarPedidosDto } from './dto/reconciliar-pedidos.dto';
import { PedidosService } from './pedidos.service';
import type { StatusPedido } from '@prisma/client';

@Injectable()
export class ReconciliacaoOfflineService {
  constructor(private readonly pedidos: PedidosService) {}

  async reconciliar(negocioId: string, lote: ReconciliarPedidosDto) {
    const pedidos: {
      id: string;
      idempotencyKey: string;
      status: StatusPedido;
    }[] = [];
    for (const item of lote.pedidos) {
      const pedido = await this.pedidos.criar(negocioId, item.pedido, {
        dispositivoId: item.dispositivoId,
        idempotencyKey: item.idempotencyKey,
        origemOffline: true,
      });
      pedidos.push({
        id: pedido.id,
        idempotencyKey: item.idempotencyKey,
        status: pedido.status,
      });
    }
    return { pedidos };
  }
}
