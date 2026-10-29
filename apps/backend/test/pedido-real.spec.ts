import { describe, expect, test, mock } from 'bun:test';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { PrismaService } from '../src/prisma/prisma.service';

function setup() {
  const produto = {
    id: 'produto',
    negocioId: 'negocio',
    nome: 'Lanche',
    precoBase: 10,
    ativo: true,
    esgotado: false,
    tempoEstimadoPreparo: 0,
    variacoes: [{ id: 'duplo', nome: 'Duplo', preco: 20, esgotado: false }],
  };
  const create = mock(({ data }: { data: Record<string, unknown> }) => ({
    id: 'pedido',
    ...data,
  }));
  const adicionais = mock(() => [
    {
      id: 'extra',
      produtoId: 'produto',
      nome: 'Queijo',
      preco: 2,
      maximo: 2,
      esgotado: false,
    },
  ]);
  const tx = {
    produto: { findMany: mock(() => [produto]) },
    adicional: { findMany: adicionais },
    itemDoGrupo: { findMany: mock(() => []) },
    pedido: { findFirst: mock(() => null), create },
  };
  const prisma = {
    $transaction: async <T>(fn: (value: typeof tx) => Promise<T>) => fn(tx),
  };
  const service = new PedidosService(prisma as unknown as PrismaService);
  return { service, create, produto, adicionais };
}

describe('Pedido real do Totem', () => {
  test('usa o preço e nome da variação do catálogo, com snapshot e sem senha do KDS', async () => {
    const { service, create } = setup();
    await service.criar('negocio', {
      itens: [
        {
          produtoId: 'produto',
          quantidade: 2,
          variacaoNome: 'Duplo',
          adicionais: [{ adicionalId: 'extra', quantidade: 2 }],
        },
      ],
    });
    const data = create.mock.calls[0][0].data;
    expect(data.valorTotal).toBe(48);
    expect(data.senha).toBeNull();
    expect(data.status).toBe('AGUARDANDO_PAGAMENTO');
    expect(data.preparoZero).toBe(true);
    expect(data.itens).toMatchObject({
      create: [{ precoNoMomento: 20, variacaoNome: 'Duplo' }],
    });
  });
  test('exige variação válida e disponível quando o produto tem opções', () => {
    for (const variacaoNome of [undefined, 'Falsa']) {
      const { service } = setup();
      expect(
        service.criar('negocio', {
          itens: [{ produtoId: 'produto', quantidade: 1, variacaoNome }],
        }),
      ).rejects.toThrow();
    }
    const { service, produto } = setup();
    produto.variacoes[0].esgotado = true;
    expect(
      service.criar('negocio', {
        itens: [{ produtoId: 'produto', quantidade: 1, variacaoNome: 'Duplo' }],
      }),
    ).rejects.toThrow();
  });
  test('rejeita adicionais repetidos para impedir contorno do limite', () => {
    const { service } = setup();
    expect(
      service.criar('negocio', {
        itens: [
          {
            produtoId: 'produto',
            quantidade: 1,
            variacaoNome: 'Duplo',
            adicionais: [
              { adicionalId: 'extra', quantidade: 2 },
              { adicionalId: 'extra', quantidade: 2 },
            ],
          },
        ],
      }),
    ).rejects.toThrow();
  });
  test('consulta adicionais com filtro explícito do negócio', async () => {
    const { service, adicionais } = setup();
    await service.criar('negocio', {
      itens: [
        {
          produtoId: 'produto',
          quantidade: 1,
          variacaoNome: 'Duplo',
          adicionais: [{ adicionalId: 'extra', quantidade: 1 }],
        },
      ],
    });
    expect(adicionais.mock.calls[0]).toEqual([
      { where: { id: { in: ['extra'] }, produto: { negocioId: 'negocio' } } },
    ]);
  });
});
