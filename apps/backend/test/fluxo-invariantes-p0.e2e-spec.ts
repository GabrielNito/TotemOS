import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';
import { ModoIdentificacao, Role, TipoDispositivo } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import * as bcrypt from 'bcryptjs';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DeviceTokenGuard } from '../src/auth/guards/device-token.guard';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { LiberacaoDemoService } from '../src/pedidos/liberacao-demo.service';
import { SenhaPedidoService } from '../src/pedidos/senha-pedido.service';
import { OperacaoPedidosService } from '../src/pedidos/operacao-pedidos.service';

const database = process.env.DEMO_TEST_DATABASE_URL;
if (!database) {
  throw new Error('DEMO_TEST_DATABASE_URL local obrigatório.');
}
const target = new URL(database);
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  target.pathname !== '/totemos_demo_test'
) {
  throw new Error('Somente PostgreSQL local totemos_demo_test.');
}

Object.assign(process.env, {
  DATABASE_URL: database,
  DIRECT_URL: database,
  JWT_SECRET: 'invariantes-p0-e2e-secret',
  DEVICE_TOKEN_PEPPER: 'invariantes-p0-e2e-pepper',
  PAIRING_CODE_PEPPER: 'invariantes-p0-e2e-pairing',
  NODE_ENV: 'test',
  TOTEMOS_ENV: 'demo',
  DEMO_ENABLED: 'true',
  DEMO_DATABASE_ISOLATED: 'true',
  DEMO_ENVIRONMENT_ID: 'invariantes-p0-e2e',
});

interface TenantFixture {
  negocioId: string;
  donoId: string;
  gerenteId: string;
  dono: string;
  gerente: string;
  totem: string;
  totemId: string;
  outroTotem: string;
  painel1: string;
  painel1Id: string;
  painel2: string;
  painel2Id: string;
  produtoPreparoId: string;
  produtoZeroId: string;
}

interface PedidoState {
  id: string;
  negocioId?: string;
  status: string;
  senha: number | null;
  versao: number;
  preparoZero?: boolean;
  demo?: boolean;
  demoAmbiente?: string | null;
  valorTotal?: string;
  dataOperacional?: string | null;
  itens?: Array<{
    precoNoMomento: string;
    quantidade: number;
  }>;
}

interface OperacaoResult {
  resultadoOperacao: { repetida: boolean };
  pedido: PedidoState;
}

describe('Invariantes P0 fim a fim em PostgreSQL real (#39)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let a: TenantFixture;
  let b: TenantFixture;
  let seq = 0;

  const pepperHash = (token: string) =>
    createHmac('sha256', process.env.DEVICE_TOKEN_PEPPER!)
      .update(token)
      .digest('hex');

  async function criarTenant(nome: string): Promise<TenantFixture> {
    const suffix = randomUUID();
    const negocio = await prisma.negocio.create({
      data: {
        nome,
        slug: `qa-${suffix}`,
        pinDonoHash: await bcrypt.hash('1234', 4),
        config: {
          create: {
            modoIdentificacao: ModoIdentificacao.OPCIONAL,
            tempoPadraoPreparo: 10,
            permitirPagamentoOffline: false,
            mensagemBoasVindas: `Bem-vindo ${nome}`,
          },
        },
      },
    });

    const dono = await prisma.usuario.create({
      data: {
        negocioId: negocio.id,
        nome: 'Dono QA',
        email: `dono-${suffix}@example.test`,
        senhaHash: 'fixture',
        role: Role.DONO,
      },
    });
    const gerente = await prisma.usuario.create({
      data: {
        negocioId: negocio.id,
        nome: 'Gerente QA',
        email: `gerente-${suffix}@example.test`,
        senhaHash: 'fixture',
        role: Role.GERENTE,
      },
    });

    const sign = (u: { id: string; email: string; role: Role }) =>
      jwt.sign({
        sub: u.id,
        negocioId: negocio.id,
        email: u.email,
        role: u.role,
        identity: 'USER',
      });

    const tokens = {
      totem: randomUUID(),
      outroTotem: randomUUID(),
      painel1: randomUUID(),
      painel2: randomUUID(),
    };

    const totemRec = await prisma.dispositivo.create({
      data: {
        negocioId: negocio.id,
        nome: 'Totem 1',
        tipo: TipoDispositivo.TOTEM,
        tokenHash: pepperHash(tokens.totem),
      },
    });
    await prisma.dispositivo.create({
      data: {
        negocioId: negocio.id,
        nome: 'Totem 2',
        tipo: TipoDispositivo.TOTEM,
        tokenHash: pepperHash(tokens.outroTotem),
      },
    });
    const painel1Rec = await prisma.dispositivo.create({
      data: {
        negocioId: negocio.id,
        nome: 'Painel 1',
        tipo: TipoDispositivo.PAINEL,
        tokenHash: pepperHash(tokens.painel1),
      },
    });
    const painel2Rec = await prisma.dispositivo.create({
      data: {
        negocioId: negocio.id,
        nome: 'Painel 2',
        tipo: TipoDispositivo.PAINEL,
        tokenHash: pepperHash(tokens.painel2),
      },
    });

    const categoria = await prisma.categoria.create({
      data: { negocioId: negocio.id, nome: 'Principal' },
    });
    const produtoPreparo = await prisma.produto.create({
      data: {
        negocioId: negocio.id,
        categoriaId: categoria.id,
        nome: 'Hamburguer',
        precoBase: 25.0,
        tempoEstimadoPreparo: 10,
      },
    });
    const produtoZero = await prisma.produto.create({
      data: {
        negocioId: negocio.id,
        categoriaId: categoria.id,
        nome: 'Refrigerante Lata',
        precoBase: 7.5,
        tempoEstimadoPreparo: 0,
      },
    });

    return {
      negocioId: negocio.id,
      donoId: dono.id,
      gerenteId: gerente.id,
      dono: sign(dono),
      gerente: sign(gerente),
      ...tokens,
      totemId: totemRec.id,
      painel1Id: painel1Rec.id,
      painel2Id: painel2Rec.id,
      produtoPreparoId: produtoPreparo.id,
      produtoZeroId: produtoZero.id,
    };
  }

  function http(
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    token?: string,
    payload?: object,
    key?: string,
  ) {
    return app.inject({
      method,
      url,
      payload,
      remoteAddress: `127.0.1.${(++seq % 200) + 1}`,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
    });
  }

  async function criarPedido(
    tenant: TenantFixture,
    produtoId = tenant.produtoPreparoId,
    quantidade = 1,
    key = randomUUID(),
  ) {
    const res = await http(
      'POST',
      '/pedidos',
      tenant.totem,
      { itens: [{ produtoId, quantidade }] },
      key,
    );
    expect(res.statusCode).toBe(201);
    return res.json<PedidoState>();
  }

  async function liberarDemo(
    tenant: TenantFixture,
    pedidoId: string,
    versaoEsperada = 1,
    key = randomUUID(),
    motivo = 'Validacao QA P0',
  ) {
    return http(
      'POST',
      `/pedidos/${pedidoId}/liberacao-demo`,
      tenant.dono,
      { motivo, pin: '1234', versaoEsperada },
      key,
    );
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    );
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = mod.get(PrismaService);
    jwt = mod.get(JwtService);

    a = await criarTenant('Tenant Alpha');
    b = await criarTenant('Tenant Beta');
    process.env.DEMO_TENANT_IDS = `${a.negocioId},${b.negocioId}`;
  }, 30000);

  afterAll(async () => {
    if (prisma && a && b) {
      const ids = [a.negocioId, b.negocioId];
      await prisma.transicaoPedido.deleteMany({
        where: { negocioId: { in: ids } },
      });
      await prisma.atribuicaoSenha.deleteMany({
        where: { negocioId: { in: ids } },
      });
      await prisma.contadorSenha.deleteMany({
        where: { negocioId: { in: ids } },
      });
      await prisma.liberacaoDemo.deleteMany({
        where: { negocioId: { in: ids } },
      });
      await prisma.negocio.deleteMany({
        where: { id: { in: ids } },
      });
    }
    if (app) await app.close();
  });

  test('Critério 1: dois KDS simultâneos emitem uma única senha e apenas um vence corrida de transição', async () => {
    const criado = await criarPedido(a, a.produtoPreparoId, 2);
    expect(criado).toMatchObject({
      status: 'AGUARDANDO_PAGAMENTO',
      senha: null,
      versao: 1,
      preparoZero: false,
      demo: true,
      demoAmbiente: 'invariantes-p0-e2e',
    });

    const libRes = await liberarDemo(a, criado.id, 1);
    expect(libRes.statusCode).toBe(200);
    expect(libRes.json<OperacaoResult>().pedido).toMatchObject({
      status: 'PENDENTE',
      senha: null,
      versao: 2,
    });
    expect(
      await prisma.pagamento.count({ where: { pedidoId: criado.id } }),
    ).toBe(0);

    // Dois KDS concorrentes com chaves distintas solicitam senha para o mesmo pedido
    const [s1, s2] = await Promise.all([
      http('POST', `/pedidos/${criado.id}/senha`, a.painel1, {}, randomUUID()),
      http('POST', `/pedidos/${criado.id}/senha`, a.painel2, {}, randomUUID()),
    ]);
    expect([s1.statusCode, s2.statusCode]).toEqual([200, 200]);
    const p1 = s1.json<OperacaoResult>().pedido;
    const p2 = s2.json<OperacaoResult>().pedido;
    expect(p1.senha).toBe(1);
    expect(p2.senha).toBe(1);
    expect(p1.versao).toBe(3);
    expect(p2.versao).toBe(3);

    const primeiras = await prisma.atribuicaoSenha.count({
      where: {
        negocioId: a.negocioId,
        pedidoId: criado.id,
        primeiraAtribuicao: true,
      },
    });
    expect(primeiras).toBe(1);

    // Corrida de transição com versaoEsperada: apenas 1 avança e o outro recebe 409
    const [t1, t2] = await Promise.all([
      http(
        'PATCH',
        `/pedidos/${criado.id}/status`,
        a.painel1,
        { status: 'EM_PREPARO', versaoEsperada: 3 },
        randomUUID(),
      ),
      http(
        'PATCH',
        `/pedidos/${criado.id}/status`,
        a.painel2,
        { status: 'EM_PREPARO', versaoEsperada: 3 },
        randomUUID(),
      ),
    ]);
    expect([t1.statusCode, t2.statusCode].sort()).toEqual([200, 409]);

    const prontoRes = await http(
      'PATCH',
      `/pedidos/${criado.id}/status`,
      a.painel1,
      { status: 'PRONTO', versaoEsperada: 4 },
      randomUUID(),
    );
    expect(prontoRes.statusCode).toBe(200);
    expect(prontoRes.json<OperacaoResult>().pedido.versao).toBe(5);

    const entregueRes = await http(
      'PATCH',
      `/pedidos/${criado.id}/status`,
      a.painel2,
      { status: 'ENTREGUE', versaoEsperada: 5 },
      randomUUID(),
    );
    expect(entregueRes.statusCode).toBe(200);
    expect(entregueRes.json<OperacaoResult>().pedido).toMatchObject({
      status: 'ENTREGUE',
      versao: 6,
      senha: 1,
    });

    const acomp = await http(
      'GET',
      `/pedidos/${criado.id}/acompanhamento`,
      a.totem,
    );
    expect(acomp.statusCode).toBe(200);
    expect(acomp.json<PedidoState>()).toMatchObject({
      status: 'ENTREGUE',
      senha: 1,
    });

    const fila = await http('GET', '/pedidos/fila?limite=50', a.painel1);
    expect(fila.statusCode).toBe(200);
    expect(
      fila.json<{ pedidos: PedidoState[] }>().pedidos.map((x) => x.id),
    ).not.toContain(criado.id);

    // Dois KDS atribuindo senhas simultaneamente em pedidos distintos obtêm números sequenciais únicos
    const q = await criarPedido(a);
    const r = await criarPedido(a);
    expect((await liberarDemo(a, q.id)).statusCode).toBe(200);
    expect((await liberarDemo(a, r.id)).statusCode).toBe(200);
    const [sq, sr] = await Promise.all([
      http('POST', `/pedidos/${q.id}/senha`, a.painel1, {}, randomUUID()),
      http('POST', `/pedidos/${r.id}/senha`, a.painel2, {}, randomUUID()),
    ]);
    expect([sq.statusCode, sr.statusCode]).toEqual([200, 200]);
    expect(
      [
        sq.json<OperacaoResult>().pedido.senha,
        sr.json<OperacaoResult>().pedido.senha,
      ].sort((x, y) => (x ?? 0) - (y ?? 0)),
    ).toEqual([2, 3]);
  });

  test('Critério 2: isolamento entre negócios, matriz de identidades e revogação durante chamadas', async () => {
    // Tenant A não cria com produto de Tenant B
    const crossCreate = await http(
      'POST',
      '/pedidos',
      a.totem,
      { itens: [{ produtoId: b.produtoPreparoId, quantidade: 1 }] },
      randomUUID(),
    );
    expect(crossCreate.statusCode).toBe(404);

    const pedidoA = await criarPedido(a);
    const pedidoB = await criarPedido(b);

    // Isolamento de leitura / mutação entre A e B
    expect((await liberarDemo(b, pedidoA.id)).statusCode).toBe(404);
    expect((await liberarDemo(a, pedidoA.id)).statusCode).toBe(200);
    expect((await liberarDemo(b, pedidoB.id)).statusCode).toBe(200);

    // PAINEL B não emite senha nem vê pedido de A, e sua sequência diária inicia em 1 no próprio negócio
    expect(
      (
        await http(
          'POST',
          `/pedidos/${pedidoA.id}/senha`,
          b.painel1,
          {},
          randomUUID(),
        )
      ).statusCode,
    ).toBe(404);
    const senhaB = await http(
      'POST',
      `/pedidos/${pedidoB.id}/senha`,
      b.painel1,
      {},
      randomUUID(),
    );
    expect(senhaB.statusCode).toBe(200);
    expect(senhaB.json<OperacaoResult>().pedido.senha).toBe(1);

    expect(
      (
        await http(
          'PATCH',
          `/pedidos/${pedidoA.id}/status`,
          b.painel1,
          { status: 'EM_PREPARO', versaoEsperada: 2 },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(404);

    // Outro TOTEM do mesmo negócio não acessa /acompanhamento do pedido alheio
    expect(
      (await http('GET', `/pedidos/${pedidoA.id}/acompanhamento`, a.outroTotem))
        .statusCode,
    ).toBe(404);

    // Matriz de identidades: PAINEL, TOTEM, DONO e GERENTE
    expect(
      (
        await http(
          'POST',
          '/pedidos',
          a.painel1,
          { itens: [{ produtoId: a.produtoPreparoId, quantidade: 1 }] },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await http(
          'POST',
          `/pedidos/${pedidoA.id}/liberacao-demo`,
          a.painel1,
          { motivo: 'X', pin: '1234', versaoEsperada: 2 },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await http(
          'POST',
          `/pedidos/${pedidoA.id}/liberacao-demo`,
          a.gerente,
          { motivo: 'X', pin: '1234', versaoEsperada: 2 },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await http(
          'POST',
          `/pedidos/${pedidoA.id}/liberacao-demo`,
          a.totem,
          { motivo: 'X', pin: '1234', versaoEsperada: 2 },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(403);
    expect((await http('GET', '/pedidos/fila', a.totem)).statusCode).toBe(403);
    expect((await http('GET', '/pedidos', a.totem)).statusCode).toBe(403);
    for (const token of [a.totem, a.dono, a.gerente]) {
      expect(
        (
          await http(
            'POST',
            `/pedidos/${pedidoA.id}/senha`,
            token,
            {},
            randomUUID(),
          )
        ).statusCode,
      ).toBe(403);
    }
    expect(
      (
        await http(
          'PATCH',
          `/pedidos/${pedidoA.id}/status`,
          a.totem,
          { status: 'EM_PREPARO', versaoEsperada: 2 },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(403);
    for (const token of [a.painel1, a.dono, a.gerente]) {
      expect(
        (await http('GET', `/pedidos/${pedidoA.id}/acompanhamento`, token))
          .statusCode,
      ).toBe(403);
    }

    // Revogação em trânsito entre guard e serviço transacional
    const guard = app.get<DeviceTokenGuard>(DeviceTokenGuard);
    const originalGuard = guard.canActivate.bind(
      guard,
    ) as DeviceTokenGuard['canActivate'];

    // 1) Revogar TOTEM durante POST /pedidos
    const spyTotem = jest
      .spyOn(DeviceTokenGuard.prototype, 'canActivate')
      .mockImplementationOnce(async (ctx) => {
        const ok = await originalGuard(ctx);
        await prisma.dispositivo.updateMany({
          where: { id: a.totemId, negocioId: a.negocioId },
          data: { ativo: false, revogadoEm: new Date() },
        });
        return ok;
      });
    try {
      const key = randomUUID();
      const res = await http(
        'POST',
        '/pedidos',
        a.totem,
        { itens: [{ produtoId: a.produtoPreparoId, quantidade: 1 }] },
        key,
      );
      expect(res.statusCode).toBe(401);
      expect(
        await prisma.pedido.findFirst({
          where: { negocioId: a.negocioId, idempotencyKey: key },
        }),
      ).toBeNull();
    } finally {
      spyTotem.mockRestore();
      await prisma.dispositivo.updateMany({
        where: { id: a.totemId, negocioId: a.negocioId },
        data: { ativo: true, revogadoEm: null },
      });
    }

    // 2) Revogar PAINEL durante POST /pedidos/:id/senha e PATCH /pedidos/:id/status
    const spyPainelSenha = jest
      .spyOn(DeviceTokenGuard.prototype, 'canActivate')
      .mockImplementationOnce(async (ctx) => {
        const ok = await originalGuard(ctx);
        await prisma.dispositivo.updateMany({
          where: { id: a.painel1Id, negocioId: a.negocioId },
          data: { revogadoEm: new Date() },
        });
        return ok;
      });
    try {
      const res = await http(
        'POST',
        `/pedidos/${pedidoA.id}/senha`,
        a.painel1,
        {},
        randomUUID(),
      );
      expect(res.statusCode).toBe(401);
      const saved = await prisma.pedido.findFirstOrThrow({
        where: { id: pedidoA.id, negocioId: a.negocioId },
      });
      expect(saved.senha).toBeNull();
    } finally {
      spyPainelSenha.mockRestore();
      await prisma.dispositivo.updateMany({
        where: { id: a.painel1Id, negocioId: a.negocioId },
        data: { revogadoEm: null },
      });
    }

    // Emite senha legitimamente para testar revogação em PATCH /status
    expect(
      (
        await http(
          'POST',
          `/pedidos/${pedidoA.id}/senha`,
          a.painel1,
          {},
          randomUUID(),
        )
      ).statusCode,
    ).toBe(200);

    const spyPainelStatus = jest
      .spyOn(DeviceTokenGuard.prototype, 'canActivate')
      .mockImplementationOnce(async (ctx) => {
        const ok = await originalGuard(ctx);
        await prisma.dispositivo.updateMany({
          where: { id: a.painel1Id, negocioId: a.negocioId },
          data: { ativo: false },
        });
        return ok;
      });
    try {
      const res = await http(
        'PATCH',
        `/pedidos/${pedidoA.id}/status`,
        a.painel1,
        { status: 'EM_PREPARO', versaoEsperada: 3 },
        randomUUID(),
      );
      expect(res.statusCode).toBe(401);
      const saved = await prisma.pedido.findFirstOrThrow({
        where: { id: pedidoA.id, negocioId: a.negocioId },
      });
      expect(saved.status).toBe('PENDENTE');
      expect(saved.versao).toBe(3);
    } finally {
      spyPainelStatus.mockRestore();
      await prisma.dispositivo.updateMany({
        where: { id: a.painel1Id, negocioId: a.negocioId },
        data: { ativo: true },
      });
    }

    // 3) Rebaixar DONO antes do lock em POST /pedidos/:id/liberacao-demo
    const pedidoRebaixado = await criarPedido(a);
    const libService = app.get(LiberacaoDemoService);
    const spyDono = jest
      .spyOn(LiberacaoDemoService.prototype, 'liberar')
      .mockImplementationOnce(async (user, id, dto, key) => {
        spyDono.mockRestore();
        await prisma.usuario.updateMany({
          where: { id: a.donoId, negocioId: a.negocioId },
          data: { role: Role.GERENTE },
        });
        return libService.liberar(user, id, dto, key);
      });
    try {
      const res = await liberarDemo(a, pedidoRebaixado.id, 1);
      expect(res.statusCode).toBe(403);
    } finally {
      spyDono.mockRestore();
      await prisma.usuario.updateMany({
        where: { id: a.donoId, negocioId: a.negocioId },
        data: { role: Role.DONO },
      });
    }
  });

  test('Critério 3: replay de POST /pedidos, resultado incerto pós-commit, preparo zero e erros de contrato', async () => {
    // 1) Falha transitória (503) antes do commit permite retentativa com a mesma Idempotency-Key
    const keyRecuperada = randomUUID();
    const erroTransitorio = new PrismaClientInitializationError(
      'db indisponivel',
      '6.4.0',
    );
    const deadPrisma = {
      $transaction: () => Promise.reject(erroTransitorio),
    } as unknown as PrismaService;
    const spyFalha = jest
      .spyOn(PedidosService.prototype, 'criar')
      .mockImplementationOnce((negocioId, dto, opts) =>
        new PedidosService(deadPrisma).criar(negocioId, dto, opts),
      );
    try {
      const falhaRes = await http(
        'POST',
        '/pedidos',
        a.totem,
        { itens: [{ produtoId: a.produtoPreparoId, quantidade: 1 }] },
        keyRecuperada,
      );
      expect(falhaRes.statusCode).toBe(503);
      expect(
        await prisma.pedido.findFirst({
          where: { negocioId: a.negocioId, idempotencyKey: keyRecuperada },
        }),
      ).toBeNull();
    } finally {
      spyFalha.mockRestore();
    }

    const recuperado = await criarPedido(
      a,
      a.produtoPreparoId,
      1,
      keyRecuperada,
    );
    expect(recuperado.valorTotal).toBe('25');

    // 2) Replay concorrente com mesma chave e payload idêntico cria um único pedido
    const keyConcorrente = randomUUID();
    const [c1, c2] = await Promise.all([
      http(
        'POST',
        '/pedidos',
        a.totem,
        { itens: [{ produtoId: a.produtoPreparoId, quantidade: 2 }] },
        keyConcorrente,
      ),
      http(
        'POST',
        '/pedidos',
        a.totem,
        { itens: [{ produtoId: a.produtoPreparoId, quantidade: 2 }] },
        keyConcorrente,
      ),
    ]);
    expect([c1.statusCode, c2.statusCode]).toEqual([201, 201]);
    expect(c1.json<PedidoState>().id).toBe(c2.json<PedidoState>().id);
    expect(
      await prisma.pedido.count({
        where: { negocioId: a.negocioId, idempotencyKey: keyConcorrente },
      }),
    ).toBe(1);

    // 3) Resultado incerto pós-commit: preço alterado e produto esgotado, pedido liberado/em preparo; replay preserva snapshot e estado atual
    const pedidoId = c1.json<PedidoState>().id;
    await prisma.produto.updateMany({
      where: { id: a.produtoPreparoId, negocioId: a.negocioId },
      data: { precoBase: 99.0, esgotado: true },
    });
    try {
      const keyLib = randomUUID();
      const l1 = await liberarDemo(a, pedidoId, 1, keyLib);
      expect(l1.statusCode).toBe(200);
      // Repetição da liberação DEMO com a mesma chave retorna repetida: true
      const lDup = await liberarDemo(a, pedidoId, 1, keyLib);
      expect(lDup.statusCode).toBe(200);
      expect(lDup.json<OperacaoResult>().resultadoOperacao.repetida).toBe(true);
      // Nova chave em pedido já liberado retorna 409
      expect((await liberarDemo(a, pedidoId, 1)).statusCode).toBe(409);
      // Mesma chave com outro motivo retorna 409
      expect(
        (await liberarDemo(a, pedidoId, 1, keyLib, 'Outro motivo')).statusCode,
      ).toBe(409);

      const sRes = await http(
        'POST',
        `/pedidos/${pedidoId}/senha`,
        a.painel1,
        {},
        randomUUID(),
      );
      expect(sRes.statusCode).toBe(200);
      const tRes = await http(
        'PATCH',
        `/pedidos/${pedidoId}/status`,
        a.painel1,
        { status: 'EM_PREPARO', versaoEsperada: 3 },
        randomUUID(),
      );
      expect(tRes.statusCode).toBe(200);

      // Totem repete POST /pedidos original (timeout simulado pós-commit)
      const replayPosCommit = await http(
        'POST',
        '/pedidos',
        a.totem,
        { itens: [{ produtoId: a.produtoPreparoId, quantidade: 2 }] },
        keyConcorrente,
      );
      expect(replayPosCommit.statusCode).toBe(201);
      const replayJson = replayPosCommit.json<PedidoState>();
      expect(replayJson.id).toBe(pedidoId);
      expect(replayJson.status).toBe('EM_PREPARO');
      expect(replayJson.valorTotal).toBe('50');
      expect(replayJson.itens?.[0].precoNoMomento).toBe('25');

      // Reuso da chave com outro payload, outro TOTEM ou outro tenant retorna 409; header != body retorna 400
      expect(
        (
          await http(
            'POST',
            '/pedidos',
            a.totem,
            { itens: [{ produtoId: a.produtoPreparoId, quantidade: 3 }] },
            keyConcorrente,
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await http(
            'POST',
            '/pedidos',
            a.outroTotem,
            { itens: [{ produtoId: a.produtoPreparoId, quantidade: 2 }] },
            keyConcorrente,
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await http(
            'POST',
            '/pedidos',
            b.totem,
            { itens: [{ produtoId: b.produtoPreparoId, quantidade: 2 }] },
            keyConcorrente,
          )
        ).statusCode,
      ).toBe(409);
      expect(
        (
          await http(
            'POST',
            '/pedidos',
            a.totem,
            {
              idempotencyKey: randomUUID(),
              itens: [{ produtoId: a.produtoPreparoId, quantidade: 1 }],
            },
            keyConcorrente,
          )
        ).statusCode,
      ).toBe(400);
    } finally {
      await prisma.produto.updateMany({
        where: { id: a.produtoPreparoId, negocioId: a.negocioId },
        data: { precoBase: 25.0, esgotado: false },
      });
    }

    // 4) Preparo Zero ponta a ponta + status inválidos + transições incompatíveis
    const pZero = await criarPedido(a, a.produtoZeroId, 1);
    expect(pZero).toMatchObject({
      status: 'AGUARDANDO_PAGAMENTO',
      preparoZero: true,
      senha: null,
      versao: 1,
    });

    const keyLibZero = randomUUID();
    const libZero = await liberarDemo(a, pZero.id, 1, keyLibZero);
    expect(libZero.statusCode).toBe(200);
    expect(libZero.json<OperacaoResult>().pedido).toMatchObject({
      status: 'PRONTO',
      senha: null,
      versao: 3,
    });

    // Não pode entregar antes da senha KDS
    expect(
      (
        await http(
          'PATCH',
          `/pedidos/${pZero.id}/status`,
          a.painel1,
          { status: 'ENTREGUE', versaoEsperada: 3 },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(409);

    // KDS emite senha mantendo PRONTO e incrementando versão para 4
    const senhaZero = await http(
      'POST',
      `/pedidos/${pZero.id}/senha`,
      a.painel1,
      {},
      randomUUID(),
    );
    expect(senhaZero.statusCode).toBe(200);
    expect(senhaZero.json<OperacaoResult>().pedido).toMatchObject({
      status: 'PRONTO',
      versao: 4,
    });

    // Status inválidos no DTO (400) e regressão para EM_PREPARO (409)
    for (const status of ['AGUARDANDO_PAGAMENTO', 'PENDENTE', 'CANCELADO']) {
      expect(
        (
          await http(
            'PATCH',
            `/pedidos/${pZero.id}/status`,
            a.painel1,
            { status, versaoEsperada: 4 },
            randomUUID(),
          )
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await http(
          'PATCH',
          `/pedidos/${pZero.id}/status`,
          a.painel1,
          { status: 'EM_PREPARO', versaoEsperada: 4 },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(409);

    const entregaZero = await http(
      'PATCH',
      `/pedidos/${pZero.id}/status`,
      a.painel1,
      { status: 'ENTREGUE', versaoEsperada: 4 },
      randomUUID(),
    );
    expect(entregaZero.statusCode).toBe(200);
    expect(entregaZero.json<OperacaoResult>().pedido).toMatchObject({
      status: 'ENTREGUE',
      versao: 5,
    });

    // Replay de liberação DEMO após ENTREGUE continua retornando estado atual sem reverter status
    const libReplayEntregue = await liberarDemo(a, pZero.id, 1, keyLibZero);
    expect(libReplayEntregue.statusCode).toBe(200);
    expect(libReplayEntregue.json<OperacaoResult>()).toMatchObject({
      resultadoOperacao: { repetida: true },
      pedido: { status: 'ENTREGUE', versao: 5 },
    });

    // Simula erro 503 em senha e transição com recuperação pela mesma Idempotency-Key
    const pRec = await criarPedido(a);
    expect((await liberarDemo(a, pRec.id)).statusCode).toBe(200);
    const keySenhaRec = randomUUID();
    const deadSvc = new PrismaService({
      datasources: {
        db: {
          url: 'postgresql://postgres@127.0.0.1:1/totemos_demo_test?connect_timeout=1',
        },
      },
    });
    const spySenha503 = jest
      .spyOn(SenhaPedidoService.prototype, 'atribuir')
      .mockImplementationOnce(async (user, id, k) => {
        spySenha503.mockRestore();
        return new SenhaPedidoService(deadSvc).atribuir(user, id, k);
      });
    try {
      expect(
        (
          await http(
            'POST',
            `/pedidos/${pRec.id}/senha`,
            a.painel1,
            {},
            keySenhaRec,
          )
        ).statusCode,
      ).toBe(503);
    } finally {
      spySenha503.mockRestore();
    }
    expect(
      (
        await http(
          'POST',
          `/pedidos/${pRec.id}/senha`,
          a.painel1,
          {},
          keySenhaRec,
        )
      ).statusCode,
    ).toBe(200);

    const keyTransRec = randomUUID();
    const spyTrans503 = jest
      .spyOn(OperacaoPedidosService.prototype, 'transicionar')
      .mockImplementationOnce(async (user, id, dto, k) => {
        spyTrans503.mockRestore();
        return new OperacaoPedidosService(deadSvc).transicionar(
          user,
          id,
          dto,
          k,
        );
      });
    try {
      expect(
        (
          await http(
            'PATCH',
            `/pedidos/${pRec.id}/status`,
            a.painel1,
            { status: 'EM_PREPARO', versaoEsperada: 3 },
            keyTransRec,
          )
        ).statusCode,
      ).toBe(503);
    } finally {
      spyTrans503.mockRestore();
      await deadSvc.$disconnect();
    }
    expect(
      (
        await http(
          'PATCH',
          `/pedidos/${pRec.id}/status`,
          a.painel1,
          { status: 'EM_PREPARO', versaoEsperada: 3 },
          keyTransRec,
        )
      ).statusCode,
    ).toBe(200);
  });
});
