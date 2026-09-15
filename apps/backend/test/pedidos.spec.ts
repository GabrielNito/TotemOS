import { test, expect, describe } from 'bun:test';
import {
  CriarPedidoSchema,
  CriarPedidoDto,
} from '../src/pedidos/dto/criar-pedido.dto';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { PedidosController } from '../src/pedidos/pedidos.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { StatusPedido, Role } from '@prisma/client';
import { UserPayload } from '../src/auth/decorators/current-user.decorator';

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
    const mockNegocioId = 'tenant-uuid-1111';

    interface ProdutoMock {
      id: string;
      negocioId: string;
      nome: string;
      precoBase: number;
      tempoEstimadoPreparo: number;
      esgotado: boolean;
      ativo: boolean;
    }

    interface AdicionalMock {
      id: string;
      produtoId: string;
      nome: string;
      preco: number;
      maximo: number;
      esgotado: boolean;
    }

    interface PedidoItemGravado {
      produto: { connect: { id: string } };
      nomeProduto: string;
      precoNoMomento: number;
      quantidade: number;
      observacao?: string;
      variacaoNome?: string;
      adicionais?: {
        create: Array<{
          adicional: { connect: { id: string } };
          nomeAdicional: string;
          precoNoMomento: number;
          quantidade: number;
        }>;
      };
    }

    interface PedidoGravado {
      id?: string;
      negocioId: string;
      dispositivoId?: string;
      idempotencyKey?: string;
      senha: number;
      dataSequencial: string;
      status: StatusPedido;
      nomeCliente?: string;
      codigoCliente?: string;
      valorTotal: number;
      observacoes?: string;
      origemOffline: boolean;
      preparoZero: boolean;
      itens: {
        create: PedidoItemGravado[];
      };
    }

    const criarMockPrisma = (config: {
      produtos?: ProdutoMock[];
      adicionais?: AdicionalMock[];
      ultimoPedido?: { senha: number } | null;
      pedidoExistente?: PedidoGravado | null;
      onCriarPedido?: (dados: PedidoGravado) => void;
    }) => {
      const mock = {
        $transaction: <T>(callback: (tx: PrismaService) => Promise<T>) =>
          callback(mock as unknown as PrismaService),
        pedido: {
          findFirst: (args?: { where?: { idempotencyKey?: string } }) => {
            if (args?.where?.idempotencyKey && config.pedidoExistente) {
              return Promise.resolve(config.pedidoExistente);
            }
            if (config.ultimoPedido !== undefined) {
              return Promise.resolve(config.ultimoPedido);
            }
            return Promise.resolve(null);
          },
          findMany: (args: { where: { negocioId: string } }) =>
            Promise.resolve([
              { id: 'pedido-1', negocioId: args.where.negocioId },
            ]),
          create: (args: { data: PedidoGravado }) => {
            if (config.onCriarPedido) {
              config.onCriarPedido(args.data);
            }
            return Promise.resolve({ id: 'ped-novo-1', ...args.data });
          },
        },
        produto: {
          findMany: () => Promise.resolve(config.produtos ?? []),
        },
        adicional: {
          findMany: () => Promise.resolve(config.adicionais ?? []),
        },
        itemDoGrupo: {
          findMany: () => Promise.resolve([]),
        },
      };

      return mock as unknown as PrismaService;
    };

    test('cria pedido com cálculo de total seguro e gravação de snapshots imutáveis', async () => {
      let pedidoCriadoDados: PedidoGravado | null = null;

      const mockPrisma = criarMockPrisma({
        produtos: [
          {
            id: produtoUuid1,
            negocioId: mockNegocioId,
            nome: 'X-Burguer Artesanal',
            precoBase: 25.0,
            tempoEstimadoPreparo: 12,
            esgotado: false,
            ativo: true,
          },
        ],
        adicionais: [
          {
            id: adicionalUuid1,
            produtoId: produtoUuid1,
            nome: 'Bacon Crocante',
            preco: 4.0,
            maximo: 2,
            esgotado: false,
          },
        ],
        onCriarPedido: (dados) => {
          pedidoCriadoDados = dados;
        },
      });

      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            adicionais: [
              {
                adicionalId: adicionalUuid1,
                quantidade: 2,
              },
            ],
          },
        ],
      };

      const resultado = await service.criar(mockNegocioId, dto);
      expect(resultado).toBeDefined();
      expect(pedidoCriadoDados).not.toBeNull();
      if (pedidoCriadoDados) {
        const dados = pedidoCriadoDados as PedidoGravado;
        expect(dados.valorTotal).toBe(33.0);
        expect(dados.status).toBe(StatusPedido.AGUARDANDO_PAGAMENTO);
        expect(dados.preparoZero).toBe(false);

        const itemGravado = dados.itens.create[0];
        expect(itemGravado.precoNoMomento).toBe(25.0);
        expect(itemGravado.nomeProduto).toBe('X-Burguer Artesanal');
        expect(itemGravado.adicionais?.create[0].precoNoMomento).toBe(4.0);
        expect(itemGravado.adicionais?.create[0].nomeAdicional).toBe(
          'Bacon Crocante',
        );
      }
    });

    test('marca preparoZero = true quando todos os produtos têm tempoEstimadoPreparo = 0', async () => {
      let pedidoCriadoDados: PedidoGravado | null = null;

      const mockPrisma = criarMockPrisma({
        produtos: [
          {
            id: produtoUuid1,
            negocioId: mockNegocioId,
            nome: 'Refrigerante Lata',
            precoBase: 6.0,
            tempoEstimadoPreparo: 0,
            esgotado: false,
            ativo: true,
          },
        ],
        onCriarPedido: (dados) => {
          pedidoCriadoDados = dados;
        },
      });

      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        itens: [{ produtoId: produtoUuid1, quantidade: 2 }],
      };

      await service.criar(mockNegocioId, dto);
      expect(pedidoCriadoDados).not.toBeNull();
      if (pedidoCriadoDados) {
        const dados = pedidoCriadoDados as PedidoGravado;
        expect(dados.preparoZero).toBe(true);
        expect(dados.valorTotal).toBe(12.0);
      }
    });

    test('marca preparoZero = false quando ao menos um item tem tempoEstimadoPreparo > 0', async () => {
      let pedidoCriadoDados: PedidoGravado | null = null;

      const mockPrisma = criarMockPrisma({
        produtos: [
          {
            id: produtoUuid1,
            negocioId: mockNegocioId,
            nome: 'Refrigerante Lata',
            precoBase: 6.0,
            tempoEstimadoPreparo: 0,
            esgotado: false,
            ativo: true,
          },
          {
            id: produtoUuid2,
            negocioId: mockNegocioId,
            nome: 'Batata Frita',
            precoBase: 14.0,
            tempoEstimadoPreparo: 8,
            esgotado: false,
            ativo: true,
          },
        ],
        onCriarPedido: (dados) => {
          pedidoCriadoDados = dados;
        },
      });

      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        itens: [
          { produtoId: produtoUuid1, quantidade: 1 },
          { produtoId: produtoUuid2, quantidade: 1 },
        ],
      };

      await service.criar(mockNegocioId, dto);
      expect(pedidoCriadoDados).not.toBeNull();
      if (pedidoCriadoDados) {
        const dados = pedidoCriadoDados as PedidoGravado;
        expect(dados.preparoZero).toBe(false);
        expect(dados.valorTotal).toBe(20.0);
      }
    });

    test('rejeita criação se produto for inexistente ou de outro estabelecimento', () => {
      const mockPrisma = criarMockPrisma({ produtos: [] });
      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };

      expect(service.criar(mockNegocioId, dto)).rejects.toThrow();
    });

    test('rejeita criação se produto estiver esgotado ou inativo', () => {
      const mockPrisma = criarMockPrisma({
        produtos: [
          {
            id: produtoUuid1,
            negocioId: mockNegocioId,
            nome: 'Produto Esgotado',
            precoBase: 20.0,
            tempoEstimadoPreparo: 5,
            esgotado: true,
            ativo: true,
          },
        ],
      });
      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };

      expect(service.criar(mockNegocioId, dto)).rejects.toThrow();
    });

    test('rejeita criação se adicional exceder o limite maximo configurado', () => {
      const mockPrisma = criarMockPrisma({
        produtos: [
          {
            id: produtoUuid1,
            negocioId: mockNegocioId,
            nome: 'Lanche',
            precoBase: 20.0,
            tempoEstimadoPreparo: 5,
            esgotado: false,
            ativo: true,
          },
        ],
        adicionais: [
          {
            id: adicionalUuid1,
            produtoId: produtoUuid1,
            nome: 'Queijo',
            preco: 3.0,
            maximo: 2,
            esgotado: false,
          },
        ],
      });
      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
            adicionais: [{ adicionalId: adicionalUuid1, quantidade: 3 }],
          },
        ],
      };

      expect(service.criar(mockNegocioId, dto)).rejects.toThrow();
    });

    test('retorna pedido existente em caso de idempotencyKey duplicado', async () => {
      const pedidoExistente: PedidoGravado = {
        id: 'pedido-existente-1',
        negocioId: mockNegocioId,
        idempotencyKey: 'chave-repetida-123',
        senha: 10,
        dataSequencial: '2026-09-14',
        status: StatusPedido.AGUARDANDO_PAGAMENTO,
        valorTotal: 50.0,
        origemOffline: false,
        preparoZero: false,
        itens: { create: [] },
      };

      const mockPrisma = criarMockPrisma({ pedidoExistente });
      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        idempotencyKey: 'chave-repetida-123',
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };

      const resultado = await service.criar(mockNegocioId, dto);
      expect(resultado.id).toBe('pedido-existente-1');
    });

    test('gera senha sequencial diária incrementada para o mesmo estabelecimento', async () => {
      let pedidoCriadoDados: PedidoGravado | null = null;

      const mockPrisma = criarMockPrisma({
        produtos: [
          {
            id: produtoUuid1,
            negocioId: mockNegocioId,
            nome: 'Lanche',
            precoBase: 10.0,
            tempoEstimadoPreparo: 5,
            esgotado: false,
            ativo: true,
          },
        ],
        ultimoPedido: { senha: 41 },
        onCriarPedido: (dados) => {
          pedidoCriadoDados = dados;
        },
      });

      const service = new PedidosService(mockPrisma);

      const dto: CriarPedidoDto = {
        itens: [{ produtoId: produtoUuid1, quantidade: 1 }],
      };

      await service.criar(mockNegocioId, dto);
      expect(pedidoCriadoDados).not.toBeNull();
      if (pedidoCriadoDados) {
        const dados = pedidoCriadoDados as PedidoGravado;
        expect(dados.senha).toBe(42);
      }
    });

    test('buscarPorId lança NotFoundException se o pedido for de outro estabelecimento', () => {
      const mockPrisma = {
        pedido: {
          findFirst: () => Promise.resolve(null),
        },
      } as unknown as PrismaService;

      const service = new PedidosService(mockPrisma);

      expect(
        service.buscarPorId(mockNegocioId, 'pedido-outro-tenant'),
      ).rejects.toThrow();
    });

    test('listar filtra estritamente pelo negocioId autenticado', async () => {
      let filtroCapturadoNegocioId = '';
      const mockPrisma = {
        pedido: {
          findMany: (args: { where: { negocioId: string } }) => {
            filtroCapturadoNegocioId = args.where.negocioId;
            return Promise.resolve([{ id: 'p1', negocioId: mockNegocioId }]);
          },
        },
      } as unknown as PrismaService;

      const service = new PedidosService(mockPrisma);

      const pedidos = await service.listar(mockNegocioId);
      expect(filtroCapturadoNegocioId).toBe(mockNegocioId);
      expect(pedidos).toHaveLength(1);
    });
  });

  describe('PedidosController — Rotas e Isolamento de Tenant (TDD)', () => {
    const userPayload: UserPayload = {
      sub: 'usr-123',
      email: 'dono@estabelecimento.com',
      negocioId: 'negocio-uuid-teste',
      role: Role.DONO,
    };

    const criarMockService = () =>
      ({
        criar: (
          negocioId: string,
          dto: CriarPedidoDto,
          options?: { dispositivoId?: string; idempotencyKey?: string },
        ) =>
          Promise.resolve({
            id: 'pedido-criado',
            negocioId,
            ...dto,
            ...options,
          }),
        listar: (
          negocioId: string,
          filtro?: { status?: StatusPedido; dataSequencial?: string },
        ) => Promise.resolve([{ id: 'p-1', negocioId, ...filtro }]),
        buscarPorId: (negocioId: string, id: string) =>
          Promise.resolve({
            id,
            negocioId,
          }),
      }) as unknown as PedidosService;

    test('POST /pedidos extrai negocioId do token e repassa opções de idempotência', async () => {
      const mockService = criarMockService();
      const controller = new PedidosController(mockService);

      const dto: CriarPedidoDto = {
        itens: [
          {
            produtoId: produtoUuid1,
            quantidade: 1,
          },
        ],
      };

      const resultado = (await controller.criar(
        userPayload,
        dto,
        'idemp-header-99',
      )) as { negocioId: string; idempotencyKey?: string };

      expect(resultado.negocioId).toBe('negocio-uuid-teste');
      expect(resultado.idempotencyKey).toBe('idemp-header-99');
    });

    test('GET /pedidos extrai negocioId do token e repassa filtros', async () => {
      const mockService = criarMockService();
      const controller = new PedidosController(mockService);

      const resultado = (await controller.listar(
        userPayload,
        StatusPedido.PENDENTE,
        '2026-09-14',
      )) as Array<{ id: string; negocioId: string }>;

      expect(resultado).toHaveLength(1);
      expect(resultado[0].negocioId).toBe('negocio-uuid-teste');
    });

    test('GET /pedidos/:id busca o pedido filtrado pelo negocioId do token', async () => {
      const mockService = criarMockService();
      const controller = new PedidosController(mockService);

      const resultado = (await controller.buscarPorId(
        userPayload,
        'ped-uuid-123',
      )) as { id: string; negocioId: string };

      expect(resultado.id).toBe('ped-uuid-123');
      expect(resultado.negocioId).toBe('negocio-uuid-teste');
    });
  });
});
