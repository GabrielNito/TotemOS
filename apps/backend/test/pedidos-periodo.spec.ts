import { describe, expect, test } from 'bun:test';
import { ListarPedidosQuerySchema } from '../src/pedidos/dto/operacao-pedido.dto';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { PedidosController } from '../src/pedidos/pedidos.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role, StatusPedido } from '@prisma/client';

describe('histórico por criação, contrato separado da senha (#34)', () => {
  test('aceita intervalo civil de criação e preserva status', () => {
    expect(
      ListarPedidosQuerySchema.safeParse({
        criadoEmInicio: '2026-11-04',
        criadoEmFim: '2026-11-05',
        status: 'PENDENTE',
      }).success,
    ).toBe(true);
  });
  test.each([
    { criadoEmInicio: '2026-02-30' },
    { criadoEmFim: '2026-13-01' },
    { criadoEmInicio: '2026-11-05', criadoEmFim: '2026-11-05' },
    { criadoEmInicio: '2026-11-06', criadoEmFim: '2026-11-05' },
    { criadoEmInicio: '2026-11-04', dataSequencial: '2026-11-05' },
    { criadoEmFim: '2026-11-05', dataIniciadaEm: '2026-11-01' },
    { criadoEmInicio: '2026-11-04', negocioId: 'outro' },
  ])('rejeita datas e combinações ambíguas %j', (query) => {
    expect(ListarPedidosQuerySchema.safeParse(query).success).toBe(false);
  });
  test('mantém filtros legados com significado anterior', () => {
    expect(
      ListarPedidosQuerySchema.parse({
        dataIniciadaEm: '2026-11-04',
        dataFinalizadaEm: '2026-11-05',
      }),
    ).toEqual({ dataIniciadaEm: '2026-11-04', dataFinalizadaEm: '2026-11-05' });
  });
  for (const [inicio, fim, utcInicio, utcFim] of [
    [
      '2026-11-04',
      '2026-11-05',
      '2026-11-04T03:00:00.000Z',
      '2026-11-05T03:00:00.000Z',
    ],
    [
      '2026-11-30',
      '2026-12-01',
      '2026-11-30T03:00:00.000Z',
      '2026-12-01T03:00:00.000Z',
    ],
    [
      '2026-12-31',
      '2027-01-01',
      '2026-12-31T03:00:00.000Z',
      '2027-01-01T03:00:00.000Z',
    ],
    [
      '2018-11-04',
      '2018-11-05',
      '2018-11-04T03:00:00.000Z',
      '2018-11-05T02:00:00.000Z',
    ],
    [
      '2019-02-16',
      '2019-02-17',
      '2019-02-16T02:00:00.000Z',
      '2019-02-17T03:00:00.000Z',
    ],
  ]) {
    test(`consulta createdAt por tenant em [${inicio}, ${fim}) incluindo DST`, async () => {
      let where: unknown;
      const service = new PedidosService({
        pedido: {
          findMany: (args: { where: unknown }) => {
            where = args.where;
            return Promise.resolve([]);
          },
        },
      } as unknown as PrismaService);
      const filtro = {
        status: StatusPedido.ENTREGUE,
        criadoEmInicio: inicio,
        criadoEmFim: fim,
      };
      await service.listar('tenant-a', filtro);
      expect(where).toEqual({
        negocioId: 'tenant-a',
        status: StatusPedido.ENTREGUE,
        createdAt: { gte: new Date(utcInicio), lt: new Date(utcFim) },
      });
    });
  }
  test('controller transmite criação sem usar tenant da query', async () => {
    let recebido: unknown;
    const service = {
      listar: (negocioId: string, filtro: unknown) => {
        recebido = { negocioId, filtro };
        return Promise.resolve([]);
      },
    } as unknown as PedidosService;
    const controller = new PedidosController(service, {} as never, {} as never);
    const filtro = {
      status: StatusPedido.PENDENTE,
      criadoEmInicio: '2026-11-04',
      criadoEmFim: '2026-11-05',
    };
    await controller.listar(
      {
        identity: 'USER',
        sub: 'dono',
        negocioId: 'tenant-a',
        role: Role.DONO,
        email: 'dono@example.test',
        isDispositivo: false,
      },
      filtro,
    );
    expect((recebido as { negocioId: string }).negocioId).toBe('tenant-a');
    expect((recebido as { filtro: unknown }).filtro).toMatchObject(filtro);
  });
});
