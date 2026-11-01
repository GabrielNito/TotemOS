import { SenhaPedidoService } from '../src/pedidos/senha-pedido.service';
import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, TipoDispositivo } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import * as bcrypt from 'bcryptjs';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  jest,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DeviceTokenGuard } from '../src/auth/guards/device-token.guard';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

const database = process.env.DEMO_TEST_DATABASE_URL;
if (!database) throw new Error('DEMO_TEST_DATABASE_URL local obrigatório.');
const target = new URL(database);
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  target.pathname !== '/totemos_demo_test'
)
  throw new Error('Somente PostgreSQL local totemos_demo_test.');
Object.assign(process.env, {
  DATABASE_URL: database,
  DIRECT_URL: database,
  JWT_SECRET: 'transicoes-test-only',
  DEVICE_TOKEN_PEPPER: 'transicoes-test-only',
  PAIRING_CODE_PEPPER: 'transicoes-test-only',
  NODE_ENV: 'test',
  TOTEMOS_ENV: 'demo',
  DEMO_ENABLED: 'true',
  DEMO_DATABASE_ISOLATED: 'true',
  DEMO_ENVIRONMENT_ID: 'transicoes-e2e',
});
interface State {
  id: string;
  status: string;
  versao: number;
  senha: number | null;
  dataOperacional?: string;
}
interface Result {
  pedido: State;
  resultadoOperacao: { repetida: boolean };
}

describe('Senha diária com PostgreSQL real', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let negocioId: string;
  let outroId: string;
  let painelId: string;
  let totemId: string;
  let dono: string;
  let gerente: string;
  const painel = randomUUID();
  const segundoPainel = randomUUID();
  const totem = randomUUID();
  const outroTotem = randomUUID();
  let sequence = 0;
  let senha = 0;
  function http(
    method: 'GET' | 'PATCH' | 'POST',
    url: string,
    token?: string,
    payload?: object,
    key?: string,
  ) {
    return app.inject({
      method,
      url,
      payload,
      remoteAddress: `127.0.0.${++sequence}`,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
    });
  }
  const change = (
    p: State,
    status: string,
    token: string = painel,
    key: string = randomUUID(),
  ) =>
    http(
      'PATCH',
      `/pedidos/${p.id}/status`,
      token,
      { status, versaoEsperada: p.versao },
      key,
    );
  async function order(zero = false, liberado = true, numerado = true) {
    const pedido = await prisma.pedido.create({
      data: {
        negocioId,
        dispositivoId: totemId,
        dataSequencial: '2026-10-30',
        valorTotal: 12.5,
        demo: true,
        demoAmbiente: 'transicoes-e2e',
        preparoZero: zero,
        itens: {
          create: {
            nomeProduto: 'Snapshot',
            precoNoMomento: 12.5,
            quantidade: 1,
          },
        },
      },
    });
    if (liberado) {
      const response = await http(
        'POST',
        `/pedidos/${pedido.id}/liberacao-demo`,
        dono,
        { motivo: 'Teste transições', pin: '1234', versaoEsperada: 1 },
        randomUUID(),
      );
      expect(response.statusCode).toBe(200);
    }
    // Fixture da pré-condição #31; esta entrega não atribui senha em produção.
    if (numerado)
      await prisma.pedido.updateMany({
        where: { id: pedido.id, negocioId },
        data: { senha: ++senha },
      });
    return await prisma.pedido.findFirstOrThrow({
      where: { id: pedido.id, negocioId },
    });
  }
  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    for (const other of [false, true]) {
      const n = await prisma.negocio.create({
        data: {
          nome: 'Teste transições',
          slug: randomUUID(),
          pinDonoHash: await bcrypt.hash('1234', 4),
        },
      });
      if (other) outroId = n.id;
      else negocioId = n.id;
    }
    process.env.DEMO_TENANT_IDS = negocioId;
    const jwt = app.get(JwtService);
    for (const role of [Role.DONO, Role.GERENTE]) {
      const u = await prisma.usuario.create({
        data: {
          negocioId,
          nome: role,
          email: `${randomUUID()}@example.test`,
          senhaHash: 'fixture',
          role,
        },
      });
      const token = jwt.sign({
        sub: u.id,
        negocioId,
        email: u.email,
        role,
        identity: 'USER',
      });
      if (role === Role.DONO) {
        dono = token;
      } else gerente = token;
    }
    for (const [token, tipo] of [
      [painel, TipoDispositivo.PAINEL],
      [segundoPainel, TipoDispositivo.PAINEL],
      [totem, TipoDispositivo.TOTEM],
      [outroTotem, TipoDispositivo.TOTEM],
    ] as const) {
      const d = await prisma.dispositivo.create({
        data: {
          negocioId,
          tipo,
          nome: tipo,
          tokenHash: createHmac('sha256', process.env.DEVICE_TOKEN_PEPPER!)
            .update(token)
            .digest('hex'),
        },
      });
      if (token === painel) painelId = d.id;
      if (token === totem) totemId = d.id;
    }
  });
  afterAll(async () => {
    if (prisma && negocioId) {
      await prisma.$executeRaw`DELETE FROM "TransicaoPedido" WHERE "negocioId" = ${negocioId}`;
      await prisma.atribuicaoSenha.deleteMany({ where: { negocioId } });
      await prisma.contadorSenha.deleteMany({ where: { negocioId } });
      await prisma.liberacaoDemo.deleteMany({ where: { negocioId } });
      await prisma.negocio.deleteMany({
        where: { id: { in: [negocioId, outroId] } },
      });
    }
    if (app) await app.close();
  });

  const issue = (
    p: State,
    token: string = painel,
    key: string = randomUUID(),
    body: object = {},
  ) => http('POST', '/pedidos/' + p.id + '/senha', token, body, key);
  test('primeira emissão, corrida em pedidos distintos e mesmo pedido entre KDS', async () => {
    const p = await order(false, true, false);
    const first = await issue(p);
    expect(first.statusCode).toBe(200);
    expect(first.json<Result>().pedido).toMatchObject({
      senha: 1,
      versao: p.versao + 1,
    });
    const q = await order(false, true, false);
    const r = await order(false, true, false);
    const parallel = await Promise.all([issue(q), issue(r, segundoPainel)]);
    expect(parallel.map((x) => x.statusCode)).toEqual([200, 200]);
    expect(
      new Set(parallel.map((x) => x.json<Result>().pedido.senha)).size,
    ).toBe(2);
    const s = await order(false, true, false);
    const same = await Promise.all([issue(s), issue(s, segundoPainel)]);
    expect(same.map((x) => x.statusCode)).toEqual([200, 200]);
    expect(same[0].json<Result>().pedido.senha).toBe(
      same[1].json<Result>().pedido.senha,
    );
  });
  test('replay, chave divergente, terminais e preparo zero integrado ao #30', async () => {
    const p = await order(true, true, false);
    const key = randomUUID();
    const first = await issue(p, painel, key);
    expect(first.statusCode).toBe(200);
    const current = first.json<Result>().pedido;
    expect((await change(current, 'ENTREGUE')).statusCode).toBe(200);
    const replay = await issue(p, painel, key);
    expect(replay.json<Result>().pedido).toMatchObject({
      senha: current.senha,
      status: 'ENTREGUE',
    });
    expect(replay.json<Result>().resultadoOperacao.repetida).toBe(true);
    expect(
      (await issue(await order(false, true, false), painel, key)).statusCode,
    ).toBe(409);
    await prisma.pedido.updateMany({
      where: { id: p.id, negocioId },
      data: { status: 'CANCELADO' },
    });
    expect((await issue(p, segundoPainel)).json<Result>().pedido.senha).toBe(
      current.senha,
    );
    const follow = await http(
      'GET',
      '/pedidos/' + p.id + '/acompanhamento',
      totem,
    );
    expect(follow.json<State>().senha).toBe(current.senha);
  });
  test('segurança e contrato estrito', async () => {
    const p = await order(false, true, false);
    for (const token of [totem, dono, gerente])
      expect((await issue(p, token)).statusCode).toBe(403);
    expect(
      (
        await http(
          'POST',
          '/pedidos/' + p.id + '/senha',
          undefined,
          {},
          randomUUID(),
        )
      ).statusCode,
    ).toBe(401);
    expect((await issue(p, 'invalid')).statusCode).toBe(401);
    expect((await issue(p, painel, 'invalid')).statusCode).toBe(400);
    for (const body of [
      { senha: 1 },
      { negocioId },
      { versaoEsperada: 2 },
      { dataOperacional: '2026-10-31' },
    ])
      expect((await issue(p, painel, randomUUID(), body)).statusCode).toBe(400);
    expect((await issue(await order(false, false, false))).statusCode).toBe(
      409,
    );
    const forged = await order(false, false, false);
    await prisma.pedido.updateMany({
      where: { id: forged.id, negocioId },
      data: { status: 'PENDENTE' },
    });
    expect((await issue(forged)).statusCode).toBe(409);
    const foreign = await prisma.pedido.create({
      data: { negocioId: outroId, valorTotal: 0, dataSequencial: '2026-10-30' },
    });
    expect((await issue(foreign)).statusCode).toBe(404);
  });
  test('auditoria falha e desfaz contador/pedido, retry recupera após nova conexão', async () => {
    const p = await order(false, true, false);
    const before = await prisma.contadorSenha.findMany({
      where: { negocioId },
    });
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AtribuicaoSenha" ADD CONSTRAINT "senha_rollback" CHECK ("pedidoId" <> ' +
        "'" +
        p.id +
        "'" +
        ')',
    );
    const key = randomUUID();
    try {
      expect((await issue(p, painel, key)).statusCode).toBe(500);
      expect(
        (
          await prisma.pedido.findFirstOrThrow({
            where: { id: p.id, negocioId },
          })
        ).senha,
      ).toBeNull();
      expect(
        await prisma.contadorSenha.findMany({ where: { negocioId } }),
      ).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "AtribuicaoSenha" DROP CONSTRAINT "senha_rollback"',
      );
    }
    const saved = (await issue(p, painel, key)).json<Result>().pedido;
    await prisma.$disconnect();
    expect((await issue(p, painel, key)).json<Result>().pedido).toEqual(saved);
  });
  function clockAt(iso: string) {
    return jest
      .spyOn(
        SenhaPedidoService.prototype as unknown as {
          instante(
            tx: Prisma.TransactionClient,
          ): Promise<{ instante: Date; dia: string }>;
        },
        'instante',
      )
      .mockImplementation(async (tx) => {
        const [row] = await tx.$queryRaw<
          { instante: Date; dia: string }[]
        >`SELECT t AS instante,to_char(t AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS dia FROM (SELECT ${iso}::timestamptz AS t) c`;
        return row;
      });
  }
  test('virada civil, criação anterior, histórico, reset, replay e inicialização concorrente', async () => {
    let clock = clockAt('2026-10-31T03:01:00Z');
    try {
      // Não depende da data real em que a suíte roda.
      await prisma.contadorSenha.deleteMany({ where: { negocioId } });
      await prisma.pedido.updateMany({
        where: { negocioId, senha: { not: null } },
        data: { dataSequencial: '2020-01-01' },
      });
      const history = await order(false, true, true);
      await prisma.pedido.updateMany({
        where: { id: history.id, negocioId },
        data: {
          senha: 1000,
          dataSequencial: '2026-10-31',
          status: 'CANCELADO',
        },
      });
      const p = await order(false, true, false);
      await prisma.pedido.updateMany({
        where: { id: p.id, negocioId },
        data: { createdAt: new Date('2026-10-31T02:59:00Z') },
      });
      const q = await order(false, true, false);
      const key = randomUUID();
      const results = await Promise.all([
        issue(p, painel, key),
        issue(q, segundoPainel),
      ]);
      expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
      expect(results.map((r) => r.json<Result>().pedido.senha).sort()).toEqual([
        1001, 1002,
      ]);
      const first = results[0].json<Result>().pedido;
      expect(first.dataOperacional).toBe('2026-10-31');
      const saved = await prisma.pedido.findFirstOrThrow({
        where: { id: p.id, negocioId },
      });
      expect(saved.dataSequencial).toBe('2026-10-31');
      expect(saved.senhaAtribuidaEm?.toISOString()).toBe(
        '2026-10-31T03:01:00.000Z',
      );
      clock.mockRestore();
      clock = clockAt('2026-11-01T02:59:00Z');
      const still = (
        await issue(await order(false, true, false))
      ).json<Result>().pedido;
      expect(still.dataOperacional).toBe('2026-10-31');
      expect(still.senha).toBe(1003);
      clock.mockRestore();
      clock = clockAt('2026-11-01T03:01:00Z');
      const next = (await issue(await order(false, true, false))).json<Result>()
        .pedido;
      expect(next).toMatchObject({ senha: 1, dataOperacional: '2026-11-01' });
      expect((await issue(p, painel, key)).json<Result>().pedido).toEqual(
        first,
      );
      expect((await issue(p, segundoPainel)).json<Result>().pedido).toEqual(
        first,
      );
    } finally {
      clock.mockRestore();
    }
  });
  test('revogação entre guard e lock impede emissão', async () => {
    const p = await order(false, true, false);
    const guard = app.get<DeviceTokenGuard>(DeviceTokenGuard);
    const original = guard.canActivate.bind(
      guard,
    ) as DeviceTokenGuard['canActivate'];
    const spy = jest
      .spyOn(DeviceTokenGuard.prototype, 'canActivate')
      .mockImplementation(async (ctx) => {
        const result = await original(ctx);
        await prisma.dispositivo.updateMany({
          where: { id: painelId, negocioId },
          data: { revogadoEm: new Date() },
        });
        return result;
      });
    try {
      expect((await issue(p)).statusCode).toBe(401);
    } finally {
      spy.mockRestore();
      await prisma.dispositivo.updateMany({
        where: { id: painelId, negocioId },
        data: { revogadoEm: null },
      });
    }
  });
  test('OpenAPI e limite global', async () => {
    const doc = cleanupOpenApiDoc(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      ),
    );
    const endpoint = doc.paths['/pedidos/{id}/senha'].post!;
    expect(endpoint.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(endpoint.responses)).toEqual(
      expect.arrayContaining([
        '200',
        '400',
        '401',
        '403',
        '404',
        '409',
        '429',
        '503',
      ]),
    );
    const p = await order(false, true, false);
    let last = 0;
    for (let i = 0; i < 61; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/pedidos/' + p.id + '/senha',
        payload: {},
        remoteAddress: '192.0.2.31',
        headers: {
          authorization: 'Bearer ' + painel,
          'idempotency-key': randomUUID(),
        },
      });
      last = r.statusCode;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });

  test('isolamento de sequências entre negócios e política DEMO no replay', async () => {
    const p = await order(false, true, false);
    const key = randomUUID();
    const original = (await issue(p, painel, key)).json<Result>().pedido;
    const foreign = await order(false, true, false);
    await prisma.liberacaoDemo.updateMany({
      where: { pedidoId: foreign.id, negocioId },
      data: { negocioId: outroId },
    });
    await prisma.pedido.updateMany({
      where: { id: foreign.id, negocioId },
      data: { negocioId: outroId },
    });
    const token = randomUUID();
    await prisma.dispositivo.create({
      data: {
        negocioId: outroId,
        nome: 'Outro PAINEL',
        tipo: 'PAINEL',
        tokenHash: createHmac('sha256', process.env.DEVICE_TOKEN_PEPPER!)
          .update(token)
          .digest('hex'),
      },
    });
    process.env.DEMO_TENANT_IDS = negocioId + ',' + outroId;
    try {
      expect((await issue(foreign)).statusCode).toBe(404);
      expect((await issue(foreign, token)).json<Result>().pedido.senha).toBe(1);
      expect((await issue(p, token)).statusCode).toBe(404);
      process.env.DEMO_ENABLED = 'false';
      expect((await issue(p, painel, key)).statusCode).toBe(409);
    } finally {
      process.env.DEMO_ENABLED = 'true';
      process.env.DEMO_TENANT_IDS = negocioId;
      await prisma.atribuicaoSenha.deleteMany({
        where: { negocioId: outroId },
      });
      await prisma.contadorSenha.deleteMany({ where: { negocioId: outroId } });
      await prisma.liberacaoDemo.updateMany({
        where: { pedidoId: foreign.id, negocioId: outroId },
        data: { negocioId },
      });
      await prisma.pedido.updateMany({
        where: { id: foreign.id, negocioId: outroId },
        data: { negocioId, senha: null },
      });
    }
    expect((await issue(p, painel, key)).json<Result>().pedido).toEqual(
      original,
    );
  });
  test('mesma chave concorrente, avanço EM_PREPARO e elegibilidade financeira', async () => {
    const p = await order(false, true, false);
    const key = randomUUID();
    const results = await Promise.all([
      issue(p, painel, key),
      issue(p, painel, key),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(
      results.map((r) => r.json<Result>().resultadoOperacao.repetida).sort(),
    ).toEqual([false, true]);
    const q = await order(false, true, false);
    await prisma.pedido.updateMany({
      where: { id: q.id, negocioId },
      data: { status: 'EM_PREPARO' },
    });
    expect((await issue(q)).statusCode).toBe(200);
    const linked = await order(false, true, false);
    await prisma.pagamento.create({
      data: { pedidoId: linked.id, valor: 12.5 },
    });
    expect((await issue(linked)).statusCode).toBe(409);
    const cancelled = await order(false, true, false);
    await prisma.pedido.updateMany({
      where: { id: cancelled.id, negocioId },
      data: { status: 'CANCELADO' },
    });
    expect((await issue(cancelled)).statusCode).toBe(409);
  });
  test('GET fila não emite senha e expõe período após emissão', async () => {
    const p = await order(false, true, false);
    const before = (await http('GET', '/pedidos/fila?limite=100', painel))
      .json<{ pedidos: State[] }>()
      .pedidos.find((x) => x.id === p.id)!;
    expect(before.senha).toBeNull();
    expect(before.dataOperacional).toBeNull();
    const issued = (await issue(p)).json<Result>().pedido;
    const after = (await http('GET', '/pedidos/fila?limite=100', painel))
      .json<{ pedidos: State[] }>()
      .pedidos.find((x) => x.id === p.id)!;
    expect(after.dataOperacional).toBe(issued.dataOperacional);
    expect(
      (
        await http('GET', '/pedidos/' + p.id + '/acompanhamento', totem)
      ).json<State>().dataOperacional,
    ).toBe(issued.dataOperacional);
  });

  test('banco indisponível na autenticação retorna HTTP 503', async () => {
    const dead = new PrismaService({
      datasources: {
        db: {
          url: 'postgresql://postgres@127.0.0.1:1/totemos_demo_test?connect_timeout=1',
        },
      },
    });
    const replacement = jest.spyOn(DeviceTokenGuard.prototype, 'canActivate');
    replacement.mockImplementation(async (ctx) => {
      replacement.mockRestore();
      return new DeviceTokenGuard(dead).canActivate(ctx);
    });
    try {
      expect(
        (
          await issue({
            id: randomUUID(),
            status: 'PENDENTE',
            senha: null,
            versao: 2,
          })
        ).statusCode,
      ).toBe(503);
    } finally {
      replacement.mockRestore();
      await dead.$disconnect();
    }
  });
  test('falha real de conexão transacional retorna 503 sem efeitos e mesma chave recupera', async () => {
    const p = await order(false, true, false),
      key = randomUUID();
    const dead = new PrismaService({
      datasources: {
        db: {
          url: 'postgresql://postgres@127.0.0.1:1/totemos_demo_test?connect_timeout=1',
        },
      },
    });
    const replacement = jest.spyOn(SenhaPedidoService.prototype, 'atribuir');
    replacement.mockImplementation(async (user, id, k) => {
      replacement.mockRestore();
      return new SenhaPedidoService(dead).atribuir(user, id, k);
    });
    try {
      expect((await issue(p, painel, key)).statusCode).toBe(503);
      expect(
        (
          await prisma.pedido.findFirstOrThrow({
            where: { id: p.id, negocioId },
          })
        ).senha,
      ).toBeNull();
    } finally {
      replacement.mockRestore();
      await dead.$disconnect();
    }
    expect((await issue(p, painel, key)).statusCode).toBe(200);
  });
  test('mesma chave simultânea para pedidos distintos recebe 409 sem consumir outro número', async () => {
    const p = await order(false, true, false),
      q = await order(false, true, false),
      key = randomUUID();
    const results = await Promise.all([
      issue(p, painel, key),
      issue(q, painel, key),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await prisma.atribuicaoSenha.count({
        where: { negocioId, atorId: painelId, idempotencyKey: key },
      }),
    ).toBe(1);
  });
});
