import { ReconciliacaoOfflineService } from '../src/pedidos/reconciliacao-offline.service';
import { describe, expect, jest, test } from 'bun:test';

describe('ReconciliacaoOfflineService', () => {
  test('recria cada pedido pelo tenant do PAINEL e preserva origem, dispositivo e chave', async () => {
    const criar = jest
      .fn()
      .mockResolvedValueOnce({ id: 'pedido-1', status: 'AGUARDANDO_PAGAMENTO' })
      .mockResolvedValueOnce({
        id: 'pedido-2',
        status: 'AGUARDANDO_PAGAMENTO',
      });
    const service = new ReconciliacaoOfflineService({ criar } as never);
    const pedidos = [
      {
        dispositivoId: '11111111-1111-4111-8111-111111111111',
        idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        pedido: {
          nomeCliente: 'Ana',
          itens: [
            {
              produtoId: '22222222-2222-4222-8222-222222222222',
              quantidade: 1,
              adicionais: [],
            },
          ],
        },
      },
      {
        dispositivoId: '33333333-3333-4333-8333-333333333333',
        idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        pedido: {
          codigoCliente: 'T-BBBBBBBB',
          itens: [
            {
              produtoId: '44444444-4444-4444-8444-444444444444',
              quantidade: 2,
              adicionais: [],
            },
          ],
        },
      },
    ];

    const resultado = await service.reconciliar('tenant-a', { pedidos });
    expect(resultado).toEqual({
      pedidos: [
        {
          id: 'pedido-1',
          idempotencyKey: pedidos[0].idempotencyKey,
          status: 'AGUARDANDO_PAGAMENTO',
        },
        {
          id: 'pedido-2',
          idempotencyKey: pedidos[1].idempotencyKey,
          status: 'AGUARDANDO_PAGAMENTO',
        },
      ],
    });
    expect(criar).toHaveBeenNthCalledWith(1, 'tenant-a', pedidos[0].pedido, {
      dispositivoId: pedidos[0].dispositivoId,
      idempotencyKey: pedidos[0].idempotencyKey,
      origemOffline: true,
    });
    expect(criar).toHaveBeenNthCalledWith(2, 'tenant-a', pedidos[1].pedido, {
      dispositivoId: pedidos[1].dispositivoId,
      idempotencyKey: pedidos[1].idempotencyKey,
      origemOffline: true,
    });
  });

  test('reenvio usa as mesmas chaves e deixa a idempotência para a criação autoritativa', async () => {
    const resultado = { id: 'pedido-1', status: 'AGUARDANDO_PAGAMENTO' };
    const criar = jest.fn().mockResolvedValue(resultado);
    const service = new ReconciliacaoOfflineService({ criar } as never);
    const lote = {
      pedidos: [
        {
          dispositivoId: '11111111-1111-4111-8111-111111111111',
          idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          pedido: {
            itens: [
              {
                produtoId: '22222222-2222-4222-8222-222222222222',
                quantidade: 1,
                adicionais: [],
              },
            ],
          },
        },
      ],
    };

    await service.reconciliar('tenant-a', lote);
    await service.reconciliar('tenant-a', lote);

    expect(criar).toHaveBeenCalledTimes(2);
    expect(criar.mock.calls[0]).toEqual(criar.mock.calls[1]);
  });
});
