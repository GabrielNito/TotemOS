import { test, expect, describe } from 'bun:test';
import {
  CriarPedidoSchema,
  PedidoItemInputSchema,
  ItemAdicionalInputSchema,
} from '../src/pedidos/dto/criar-pedido.dto';

describe('Pedidos — Validação de Schemas Zod e Bloqueio de Fraude (TDD)', () => {
  const produtoUuid1 = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
  const produtoUuid2 = 'b2c3d4e5-f6a7-4901-8cde-f12345678902';
  const adicionalUuid1 = 'c3d4e5f6-a7b8-4012-9def-123456789012';

  describe('CriarPedidoSchema — Regras de Entrada e Validação', () => {
    test('aceita payload válido com 1 item', () => {
      const payload = {
        nomeCliente: 'Gabriel',
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            observacao: 'Sem cebola',
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.itens).toHaveLength(1);
        expect(resultado.data.itens[0].produtoId).toBe(produtoUuid1);
        expect(resultado.data.itens[0].quantidade).toBe(1);
      }
    });

    test('aceita payload com múltiplos itens e adicionais válidos', () => {
      const payload = {
        codigoCliente: 'TOTEM-42',
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 2,
            adicionais: [
              {
                adicionalId: adicionalUuid1,
                quantidade: 2,
              },
            ],
          },
          {
            produtoId: produtoUuid2,
            quantidade: 1,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.itens).toHaveLength(2);
      }
    });

    test('rejeita payload sem lista de itens ou com itens vazio', () => {
      const payloadVazio = {
        nomeCliente: 'Carlos',
        itens: [],
      };

      const resultado = CriarPedidoSchema.safeParse(payloadVazio);
      expect(resultado.success).toBe(false);
    });

    test('rejeita produtoId com formato inválido (não-UUID)', () => {
      const payload = {
        itens: [
          {
            produtoId: 'id-invalido-nao-uuid',
            quantidade: 1,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    test('rejeita item com quantidade menor ou igual a zero', () => {
      const payloadZero = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 0,
          },
        ],
      };
      const resultadoZero = CriarPedidoSchema.safeParse(payloadZero);
      expect(resultadoZero.success).toBe(false);

      const payloadNegativo = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: -2,
          },
        ],
      };
      const resultadoNegativo = CriarPedidoSchema.safeParse(payloadNegativo);
      expect(resultadoNegativo.success).toBe(false);
    });

    test('rejeita adicional com quantidade menor ou igual a zero', () => {
      const payload = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            adicionais: [
              {
                adicionalId: adicionalUuid1,
                quantidade: 0,
              },
            ],
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });
  });

  describe('Bloqueio Estrito de Preço Adulterado (Fraude / Tampering Prevention)', () => {
    test('rejeita payload com campo "valorTotal" no nível raiz', () => {
      const payload = {
        nomeCliente: 'Atacante',
        valorTotal: 0.01,
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    test('rejeita payload com "preco" ou "precoBase" no nível raiz', () => {
      const payloadPreco = {
        preco: 1.0,
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };
      expect(CriarPedidoSchema.safeParse(payloadPreco).success).toBe(false);

      const payloadPrecoBase = {
        precoBase: 1.0,
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };
      expect(CriarPedidoSchema.safeParse(payloadPrecoBase).success).toBe(false);
    });

    test('rejeita payload com "precoNoMomento" ou "preco" dentro do item', () => {
      const payloadItemComPreco = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            precoNoMomento: 0.5,
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payloadItemComPreco);
      expect(resultado.success).toBe(false);
    });

    test('rejeita adicional com "preco" ou "precoNoMomento"', () => {
      const payloadAdicionalComPreco = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            adicionais: [
              {
                adicionalId: adicionalUuid1,
                quantidade: 1,
                precoNoMomento: 0.1,
              },
            ],
          },
        ],
      };

      const resultado = CriarPedidoSchema.safeParse(payloadAdicionalComPreco);
      expect(resultado.success).toBe(false);
    });
  });

  describe('PedidosService — Engine de Snapshot e Regras de Negócio (TDD)', () => {
    let service: any;
    let mockPrisma: any;

    const mockNegocioId = 'tenant-uuid-1111';
    const prodUuid1 = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
    const prodUuid2 = 'b2c3d4e5-f6a7-4901-8cde-f12345678902';
    const adicUuid1 = 'c3d4e5f6-a7b8-4012-9def-123456789012';

    test('carrega PedidosService e executa testes unitários', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');
      expect(PedidosService).toBeDefined();
    });

    test('cria pedido com cálculo de total seguro e gravação de snapshots imutáveis', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      let pedidoCriadoDados: any = null;
      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: {
          findFirst: async () => null,
          findMany: async () => [],
          create: async (args: any) => {
            pedidoCriadoDados = args.data;
            return { id: 'pedido-123', ...args.data };
          },
        },
        produto: {
          findMany: async () => [
            {
              id: prodUuid1,
              negocioId: mockNegocioId,
              nome: 'X-Burguer Artesanal',
              precoBase: 25.0,
              tempoEstimadoPreparo: 12,
              esgotado: false,
              ativo: true,
            },
          ],
        },
        adicional: {
          findMany: async () => [
            {
              id: adicUuid1,
              produtoId: prodUuid1,
              nome: 'Bacon Crocante',
              preco: 4.0,
              maximo: 2,
              esgotado: false,
            },
          ],
        },
        itemDoGrupo: {
          findMany: async () => [],
        },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        itens: [
          {
            produtoId: prodUuid1,
            quantidade: 1,
            adicionais: [
              {
                adicionalId: adicUuid1,
                quantidade: 2,
              },
            ],
          },
        ],
      };

      const resultado = await service.criar(mockNegocioId, dto);
      expect(resultado).toBeDefined();
      expect(Number(pedidoCriadoDados.valorTotal)).toBe(33.0); // 25 + (4 * 2) = 33
      expect(pedidoCriadoDados.status).toBe('AGUARDANDO_PAGAMENTO');
      expect(pedidoCriadoDados.preparoZero).toBe(false);

      // Validação de snapshots imutáveis
      const itemGravado = pedidoCriadoDados.itens.create[0];
      expect(Number(itemGravado.precoNoMomento)).toBe(25.0);
      expect(itemGravado.nomeProduto).toBe('X-Burguer Artesanal');
      expect(Number(itemGravado.adicionais.create[0].precoNoMomento)).toBe(4.0);
      expect(itemGravado.adicionais.create[0].nomeAdicional).toBe(
        'Bacon Crocante',
      );
    });

    test('marca preparoZero = true quando todos os produtos têm tempoEstimadoPreparo = 0', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      let pedidoCriado: any = null;
      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: {
          findFirst: async () => null,
          findMany: async () => [],
          create: async (args: any) => {
            pedidoCriado = args.data;
            return { id: 'ped-zero', ...args.data };
          },
        },
        produto: {
          findMany: async () => [
            {
              id: prodUuid1,
              negocioId: mockNegocioId,
              nome: 'Refrigerante Lata',
              precoBase: 6.0,
              tempoEstimadoPreparo: 0,
              esgotado: false,
              ativo: true,
            },
          ],
        },
        adicional: {
          findMany: async () => [],
        },
        itemDoGrupo: {
          findMany: async () => [],
        },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        itens: [{ produtoId: prodUuid1, quantidade: 2 }],
      };

      await service.criar(mockNegocioId, dto);
      expect(pedidoCriado.preparoZero).toBe(true);
      expect(Number(pedidoCriado.valorTotal)).toBe(12.0);
    });

    test('marca preparoZero = false quando ao menos um item tem tempoEstimadoPreparo > 0', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      let pedidoCriado: any = null;
      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: {
          findFirst: async () => null,
          findMany: async () => [],
          create: async (args: any) => {
            pedidoCriado = args.data;
            return { id: 'ped-misto', ...args.data };
          },
        },
        produto: {
          findMany: async () => [
            {
              id: prodUuid1,
              negocioId: mockNegocioId,
              nome: 'Refrigerante Lata',
              precoBase: 6.0,
              tempoEstimadoPreparo: 0,
              esgotado: false,
              ativo: true,
            },
            {
              id: prodUuid2,
              negocioId: mockNegocioId,
              nome: 'Batata Frita',
              precoBase: 14.0,
              tempoEstimadoPreparo: 8,
              esgotado: false,
              ativo: true,
            },
          ],
        },
        adicional: {
          findMany: async () => [],
        },
        itemDoGrupo: {
          findMany: async () => [],
        },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        itens: [
          { produtoId: prodUuid1, quantidade: 1 },
          { produtoId: prodUuid2, quantidade: 1 },
        ],
      };

      await service.criar(mockNegocioId, dto);
      expect(pedidoCriado.preparoZero).toBe(false);
      expect(Number(pedidoCriado.valorTotal)).toBe(20.0);
    });

    test('rejeita criação se produto for inexistente ou de outro estabelecimento', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: { findFirst: async () => null },
        produto: { findMany: async () => [] }, // Produto não encontrado para o tenant
        adicional: { findMany: async () => [] },
        itemDoGrupo: { findMany: async () => [] },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        itens: [{ produtoId: prodUuid1, quantidade: 1 }],
      };

      expect(service.criar(mockNegocioId, dto)).rejects.toThrow();
    });

    test('rejeita criação se produto estiver esgotado ou inativo', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: { findFirst: async () => null },
        produto: {
          findMany: async () => [
            {
              id: prodUuid1,
              negocioId: mockNegocioId,
              nome: 'Produto Esgotado',
              precoBase: 20.0,
              tempoEstimadoPreparo: 5,
              esgotado: true,
              ativo: true,
            },
          ],
        },
        adicional: { findMany: async () => [] },
        itemDoGrupo: { findMany: async () => [] },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        itens: [{ produtoId: prodUuid1, quantidade: 1 }],
      };

      expect(service.criar(mockNegocioId, dto)).rejects.toThrow();
    });

    test('rejeita criação se adicional exceder o limite maximo configurado', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: { findFirst: async () => null },
        produto: {
          findMany: async () => [
            {
              id: prodUuid1,
              negocioId: mockNegocioId,
              nome: 'Lanche',
              precoBase: 20.0,
              tempoEstimadoPreparo: 5,
              esgotado: false,
              ativo: true,
            },
          ],
        },
        adicional: {
          findMany: async () => [
            {
              id: adicUuid1,
              produtoId: prodUuid1,
              nome: 'Queijo',
              preco: 3.0,
              maximo: 2, // Limite é 2
              esgotado: false,
            },
          ],
        },
        itemDoGrupo: { findMany: async () => [] },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        itens: [
          {
            produtoId: prodUuid1,
            quantidade: 1,
            adicionais: [{ adicionalId: adicUuid1, quantidade: 3 }], // Solicitou 3
          },
        ],
      };

      expect(service.criar(mockNegocioId, dto)).rejects.toThrow();
    });

    test('retorna pedido existente em caso de idempotencyKey duplicado', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      const pedidoExistente = {
        id: 'pedido-existente-1',
        idempotencyKey: 'chave-repetida-123',
        valorTotal: 50.0,
        negocioId: mockNegocioId,
      };

      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: {
          findFirst: async (args: any) => {
            if (args?.where?.idempotencyKey === 'chave-repetida-123') {
              return pedidoExistente;
            }
            return null;
          },
        },
        produto: { findMany: async () => [] },
        adicional: { findMany: async () => [] },
        itemDoGrupo: { findMany: async () => [] },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        idempotencyKey: 'chave-repetida-123',
        itens: [{ produtoId: prodUuid1, quantidade: 1 }],
      };

      const resultado = await service.criar(mockNegocioId, dto);
      expect(resultado.id).toBe('pedido-existente-1');
    });

    test('gera senha sequencial diária incrementada para o mesmo estabelecimento', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      let pedidoCriado: any = null;
      mockPrisma = {
        $transaction: async (callback: any) => callback(mockPrisma),
        pedido: {
          findFirst: async (args: any) => {
            if (args?.orderBy?.senha === 'desc') {
              return { senha: 41 };
            }
            return null;
          },
          create: async (args: any) => {
            pedidoCriado = args.data;
            return { id: 'ped-42', ...args.data };
          },
        },
        produto: {
          findMany: async () => [
            {
              id: prodUuid1,
              negocioId: mockNegocioId,
              nome: 'Lanche',
              precoBase: 10.0,
              tempoEstimadoPreparo: 5,
              esgotado: false,
              ativo: true,
            },
          ],
        },
        adicional: { findMany: async () => [] },
        itemDoGrupo: { findMany: async () => [] },
      };

      service = new PedidosService(mockPrisma);

      const dto = {
        itens: [{ produtoId: prodUuid1, quantidade: 1 }],
      };

      await service.criar(mockNegocioId, dto);
      expect(pedidoCriado.senha).toBe(42);
    });

    test('buscarPorId lança NotFoundException se o pedido for de outro estabelecimento', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      mockPrisma = {
        pedido: {
          findFirst: async () => null,
        },
      };

      service = new PedidosService(mockPrisma);

      expect(
        service.buscarPorId(mockNegocioId, 'pedido-outro-tenant'),
      ).rejects.toThrow();
    });

    test('listar filtra estritamente pelo negocioId autenticado', async () => {
      const { PedidosService } = await import('../src/pedidos/pedidos.service');

      let filtroCapturado: any = null;
      mockPrisma = {
        pedido: {
          findMany: async (args: any) => {
            filtroCapturado = args.where;
            return [{ id: 'p1', negocioId: mockNegocioId }];
          },
        },
      };

      service = new PedidosService(mockPrisma);

      const pedidos = await service.listar(mockNegocioId);
      expect(filtroCapturado.negocioId).toBe(mockNegocioId);
      expect(pedidos).toHaveLength(1);
    });
  });
});
