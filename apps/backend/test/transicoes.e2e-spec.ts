import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { Role, TipoDispositivo } from '@prisma/client';
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
}
interface Result {
  pedido: State;
  resultadoOperacao: { repetida: boolean };
}

describe('Transições e fila com PostgreSQL real', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let negocioId: string;
  let outroId: string;
  let painelId: string;
  let donoId: string;
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
        donoId = u.id;
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
      await prisma.liberacaoDemo.deleteMany({ where: { negocioId } });
      await prisma.negocio.deleteMany({
        where: { id: { in: [negocioId, outroId] } },
      });
    }
    if (app) await app.close();
  });
  test('ciclo PAINEL/humano preserva snapshots e audita, replay antigo retorna estado atual', async () => {
    const p = await order();
    const key = randomUUID();
    const first = await change(p, 'EM_PREPARO', painel, key);
    expect(first.statusCode).toBe(200);
    const next = first.json<Result>().pedido;
    expect(next).toMatchObject({ status: 'EM_PREPARO', versao: p.versao + 1 });
    const ready = await change(next, 'PRONTO', gerente);
    expect(ready.statusCode).toBe(200);
    const delivered = await change(
      ready.json<Result>().pedido,
      'ENTREGUE',
      dono,
    );
    expect(delivered.statusCode).toBe(200);
    const replay = await change(p, 'EM_PREPARO', painel, key);
    expect(replay.json<Result>()).toMatchObject({
      resultadoOperacao: { repetida: true },
      pedido: { status: 'ENTREGUE' },
    });
    const rows = await prisma.$queryRaw<
      { statusAnterior: string; statusNovo: string }[]
    >`SELECT "statusAnterior", "statusNovo" FROM "TransicaoPedido" WHERE "negocioId" = ${negocioId} AND "pedidoId" = ${p.id} ORDER BY "createdAt"`;
    expect(rows.map((r) => r.statusNovo)).toEqual([
      'EM_PREPARO',
      'PRONTO',
      'ENTREGUE',
    ]);
    const saved = await prisma.pedido.findFirstOrThrow({
      where: { id: p.id, negocioId },
      include: { itens: true, pagamentos: true },
    });
    expect(saved.valorTotal.toString()).toBe('12.5');
    expect(saved.itens[0].precoNoMomento.toString()).toBe('12.5');
    expect(saved.pagamentos).toHaveLength(0);
  });
  test('corrida de versões tem um vencedor; mesma chave é idempotente', async () => {
    const p = await order();
    const responses = await Promise.all([
      change(p, 'EM_PREPARO', segundoPainel),
      change(p, 'EM_PREPARO'),
    ]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const q = await order();
    const key = randomUUID();
    const repeated = await Promise.all([
      change(q, 'EM_PREPARO', painel, key),
      change(q, 'EM_PREPARO', painel, key),
    ]);
    expect(repeated.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(
      repeated.map((r) => r.json<Result>().resultadoOperacao.repetida).sort(),
    ).toEqual([false, true]);
    expect((await change(q, 'PRONTO', painel, key)).statusCode).toBe(409);
    expect(
      (await change(await order(), 'EM_PREPARO', painel, key)).statusCode,
    ).toBe(409);
  });
  test('falha de auditoria desfaz status e versão no PostgreSQL', async () => {
    const p = await order();
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "TransicaoPedido" ADD CONSTRAINT "fixture_rollback" CHECK ("pedidoId" <> '${p.id}')`,
    );
    try {
      expect((await change(p, 'EM_PREPARO')).statusCode).toBe(500);
      const saved = await prisma.pedido.findFirstOrThrow({
        where: { id: p.id, negocioId },
      });
      expect(saved.status).toBe('PENDENTE');
      expect(saved.versao).toBe(p.versao);
    } finally {
      await prisma.$executeRaw`ALTER TABLE "TransicaoPedido" DROP CONSTRAINT "fixture_rollback"`;
    }
  });
  test('revogação após o guard e antes da transação impede a mutação', async () => {
    const p = await order();
    const guard = app.get<DeviceTokenGuard>(DeviceTokenGuard);
    const original = guard.canActivate.bind(
      guard,
    ) as DeviceTokenGuard['canActivate'];
    const spy = jest
      .spyOn(DeviceTokenGuard.prototype, 'canActivate')
      .mockImplementation(async (context) => {
        const result = await original(context);
        await prisma.dispositivo.updateMany({
          where: { id: painelId, negocioId },
          data: { ativo: false },
        });
        return result;
      });
    try {
      expect((await change(p, 'EM_PREPARO')).statusCode).toBe(401);
    } finally {
      spy.mockRestore();
      await prisma.dispositivo.updateMany({
        where: { id: painelId, negocioId },
        data: { ativo: true },
      });
    }
  });
  test('OpenAPI publica rotas, DTOs e respostas operacionais', () => {
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      ),
    );
    expect(document.paths['/pedidos/fila'].get?.responses['200']).toBeDefined();
    const patch = document.paths['/pedidos/{id}/status'].patch;
    expect(patch?.requestBody).toBeDefined();
    expect(patch?.security).toEqual([{ bearer: [] }]);
    expect(Object.keys(patch!.responses)).toEqual(
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
    expect(
      document.paths['/pedidos/{id}/acompanhamento'].get?.responses['200'],
    ).toBeDefined();
  });
  test('rejeita saltos, versão velha, ausência de senha/autorização e estados terminais', async () => {
    const p = await order();
    expect((await change(p, 'PRONTO')).statusCode).toBe(409);
    expect((await change({ ...p, versao: 99 }, 'EM_PREPARO')).statusCode).toBe(
      409,
    );
    expect(
      (await change(await order(false, true, false), 'EM_PREPARO')).statusCode,
    ).toBe(409);
    expect(
      (await change(await order(false, false), 'EM_PREPARO')).statusCode,
    ).toBe(409);
    const forged = await order(false, false);
    await prisma.pedido.updateMany({
      where: { id: forged.id, negocioId },
      data: { status: 'PENDENTE' },
    });
    expect((await change(forged, 'EM_PREPARO')).statusCode).toBe(409);
    const ended = await order();
    await prisma.pedido.updateMany({
      where: { id: ended.id, negocioId },
      data: { status: 'CANCELADO' },
    });
    expect((await change(ended, 'EM_PREPARO')).statusCode).toBe(409);
  });
  test('preparo zero já está PRONTO com trilha DEMO e só permite entrega após senha', async () => {
    const p = await order(true, true, false);
    expect(p.status).toBe('PRONTO');
    expect((await change(p, 'EM_PREPARO')).statusCode).toBe(409);
    expect((await change(p, 'ENTREGUE')).statusCode).toBe(409);
    await prisma.pedido.updateMany({
      where: { id: p.id, negocioId },
      data: { senha: ++senha },
    });
    expect((await change(p, 'ENTREGUE')).statusCode).toBe(200);
    const audit = await prisma.liberacaoDemo.findFirstOrThrow({
      where: { pedidoId: p.id, negocioId },
    });
    expect(audit.transicoes).toEqual([
      'AGUARDANDO_PAGAMENTO',
      'PENDENTE',
      'PRONTO',
    ]);
  });
  test('autenticação, TOTEM, tenant, DTO e chave inválidos não alteram pedido', async () => {
    const p = await order();
    expect(
      (
        await http(
          'PATCH',
          `/pedidos/${p.id}/status`,
          undefined,
          { status: 'EM_PREPARO', versaoEsperada: p.versao },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(401);
    expect((await change(p, 'EM_PREPARO', totem)).statusCode).toBe(403);
    for (const status of ['PENDENTE', 'CANCELADO', 'AGUARDANDO_PAGAMENTO'])
      expect((await change(p, status)).statusCode).toBe(400);
    expect((await change(p, 'EM_PREPARO', painel, 'invalid')).statusCode).toBe(
      400,
    );
    expect(
      (
        await http(
          'PATCH',
          `/pedidos/${p.id}/status`,
          painel,
          { status: 'EM_PREPARO', versaoEsperada: p.versao, negocioId },
          randomUUID(),
        )
      ).statusCode,
    ).toBe(400);
    const foreign = await prisma.pedido.create({
      data: { negocioId: outroId, valorTotal: 0, dataSequencial: '2026-10-30' },
    });
    expect((await change(foreign, 'EM_PREPARO')).statusCode).toBe(404);
  });
  test('fila e GETs legados PAINEL não vazam retidos ou pagamentos; paginação e acompanhamento restritos', async () => {
    const p = await order(false, true, false);
    const retained = await order(false, false);
    const q = await http('GET', '/pedidos/fila?limite=1', painel);
    expect(q.statusCode).toBe(200);
    const page = q.json<{ pedidos: State[]; proximoCursor: string | null }>();
    expect(page.pedidos).toHaveLength(1);
    expect(page.proximoCursor).toBeTruthy();
    const secondPage = await http(
      'GET',
      `/pedidos/fila?limite=1&cursor=${page.proximoCursor}`,
      painel,
    );
    expect(secondPage.json<{ pedidos: State[] }>().pedidos[0].id).not.toBe(
      page.pedidos[0].id,
    );
    const foreignCursor = Buffer.from(
      JSON.stringify({
        negocioId: outroId,
        id: p.id,
        createdAt: p.createdAt.toISOString(),
      }),
    ).toString('base64url');
    expect(
      (await http('GET', `/pedidos/fila?cursor=${foreignCursor}`, painel))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await http(
          'GET',
          `/pedidos/fila?limite=1&cursor=${page.proximoCursor}`,
          painel,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await http('GET', '/pedidos/fila?status=AGUARDANDO_PAGAMENTO', painel))
        .statusCode,
    ).toBe(400);
    expect(
      (await http('GET', '/pedidos/fila?cursor=invalid', painel)).statusCode,
    ).toBe(400);
    expect((await http('GET', '/pedidos/fila', totem)).statusCode).toBe(403);
    expect(
      (await http('GET', `/pedidos/${retained.id}`, painel)).statusCode,
    ).toBe(404);
    const legacy = await http(
      'GET',
      '/pedidos?status=AGUARDANDO_PAGAMENTO',
      painel,
    );
    expect(legacy.json()).toEqual([]);
    const detail = await http('GET', `/pedidos/${p.id}`, painel);
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).not.toHaveProperty('pagamentos');
    const forged = await order(false, false);
    await prisma.pedido.updateMany({
      where: { id: forged.id, negocioId },
      data: { status: 'PENDENTE' },
    });
    const linked = await order();
    await prisma.pagamento.create({
      data: { pedidoId: linked.id, valor: 12.5 },
    });
    expect((await change(linked, 'EM_PREPARO')).statusCode).toBe(409);
    const queue = (await http('GET', '/pedidos/fila?limite=100', painel)).json<{
      pedidos: State[];
    }>();
    expect(queue.pedidos.map((item) => item.id)).toContain(p.id);
    for (const id of [retained.id, forged.id, linked.id])
      expect(queue.pedidos.map((item) => item.id)).not.toContain(id);
    const follow = await http('GET', `/pedidos/${p.id}/acompanhamento`, totem);
    expect(follow.statusCode).toBe(200);
    expect(follow.headers['cache-control']).toBe('no-store');
    expect(follow.json()).not.toHaveProperty('itens');
    expect(follow.json()).not.toHaveProperty('pagamentos');
    expect(
      (await http('GET', `/pedidos/${p.id}/acompanhamento`, outroTotem))
        .statusCode,
    ).toBe(404);
    expect(
      (await http('GET', `/pedidos/${p.id}/acompanhamento`, dono)).statusCode,
    ).toBe(403);
  });
  test('configuração DEMO desabilitada veta fila, mutação e replay', async () => {
    const p = await order();
    const key = randomUUID();
    expect((await change(p, 'EM_PREPARO', painel, key)).statusCode).toBe(200);
    process.env.DEMO_ENABLED = 'false';
    try {
      expect((await change(p, 'EM_PREPARO', painel, key)).statusCode).toBe(409);
      expect((await http('GET', '/pedidos/fila', painel)).json()).toMatchObject(
        { pedidos: [] },
      );
    } finally {
      process.env.DEMO_ENABLED = 'true';
    }
  });
  test('credenciais revogadas e vínculo humano removido são revalidados', async () => {
    const p = await order();
    await prisma.dispositivo.updateMany({
      where: { id: painelId, negocioId },
      data: { ativo: false },
    });
    expect((await change(p, 'EM_PREPARO')).statusCode).toBe(401);
    await prisma.dispositivo.updateMany({
      where: { id: painelId, negocioId },
      data: { ativo: true },
    });
    await prisma.usuario.updateMany({
      where: { id: donoId, negocioId },
      data: { negocioId: outroId },
    });
    expect((await change(p, 'EM_PREPARO', dono)).statusCode).toBe(403);
    await prisma.usuario.updateMany({
      where: { id: donoId, negocioId: outroId },
      data: { negocioId },
    });
  });
});
