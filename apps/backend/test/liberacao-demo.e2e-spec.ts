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
  beforeEach,
  describe,
  expect,
  test,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LiberacaoDemoService } from '../src/pedidos/liberacao-demo.service';

const database = process.env.DEMO_TEST_DATABASE_URL;
if (!database)
  throw new Error(
    'DEMO_TEST_DATABASE_URL deve apontar para PostgreSQL local dedicado.',
  );
const target = new URL(database);
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  target.pathname !== '/totemos_demo_test'
) {
  throw new Error(
    'Testes DEMO só executam no banco local totemos_demo_test, sem fallback operacional.',
  );
}
process.env.DATABASE_URL = database;
process.env.DIRECT_URL = database;
process.env.JWT_SECRET = 'demo-e2e-jwt-only';
process.env.DEVICE_TOKEN_PEPPER = 'demo-e2e-pepper-only';
process.env.PAIRING_CODE_PEPPER = 'demo-e2e-pairing-only';

interface Fixture {
  negocioId: string;
  donoId: string;
  dono: string;
  outroDono: string;
  gerente: string;
  totem: string;
  painel: string;
  dispositivoId: string;
  produtoId: string;
}
interface PedidoDto {
  id: string;
  status: string;
  demo: boolean;
  demoAmbiente: string | null;
  versao: number;
  senha: number | null;
  valorTotal: string;
  itens: { precoNoMomento: string }[];
}
interface LiberacaoDto {
  resultadoOperacao: { repetida: boolean };
  pedido: PedidoDto & { elegivelCozinha: boolean };
}

describe('Liberação operacional DEMO com PostgreSQL isolado', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let a: Fixture;
  let b: Fixture;
  let sequence = 0;

  async function fixture(): Promise<Fixture> {
    const suffix = randomUUID();
    const negocio = await prisma.negocio.create({
      data: {
        nome: 'Fixture DEMO',
        slug: `demo-${suffix}`,
        pinDonoHash: await bcrypt.hash('1234', 4),
      },
    });
    const dono = await prisma.usuario.create({
      data: {
        negocioId: negocio.id,
        nome: 'Dono',
        email: `dono-${suffix}@example.test`,
        senhaHash: 'fixture',
        role: Role.DONO,
      },
    });
    const gerente = await prisma.usuario.create({
      data: {
        negocioId: negocio.id,
        nome: 'Gerente',
        email: `gerente-${suffix}@example.test`,
        senhaHash: 'fixture',
        role: Role.GERENTE,
      },
    });
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const outroDono = await prisma.usuario.create({
      data: {
        negocioId: negocio.id,
        nome: 'Outro dono',
        email: `outro-dono-${suffix}@example.test`,
        senhaHash: 'fixture',
        role: Role.DONO,
      },
    });
    const sign = (user: typeof dono) =>
      jwt.sign({
        sub: user.id,
        email: user.email,
        negocioId: negocio.id,
        role: user.role,
        identity: 'USER',
      });
    const tokens = { totem: randomUUID(), painel: randomUUID() };
    const devices: { id: string }[] = [];
    for (const tipo of [TipoDispositivo.TOTEM, TipoDispositivo.PAINEL]) {
      const token =
        tipo === TipoDispositivo.TOTEM ? tokens.totem : tokens.painel;
      devices.push(
        await prisma.dispositivo.create({
          data: {
            negocioId: negocio.id,
            nome: tipo,
            tipo,
            tokenHash: createHmac('sha256', process.env.DEVICE_TOKEN_PEPPER!)
              .update(token)
              .digest('hex'),
          },
        }),
      );
    }
    const categoria = await prisma.categoria.create({
      data: { negocioId: negocio.id, nome: 'Fixture' },
    });
    const produto = await prisma.produto.create({
      data: {
        negocioId: negocio.id,
        categoriaId: categoria.id,
        nome: 'Lanche',
        precoBase: 12.5,
        tempoEstimadoPreparo: 5,
      },
    });
    return {
      negocioId: negocio.id,
      donoId: dono.id,
      dono: sign(dono),
      outroDono: sign(outroDono),
      gerente: sign(gerente),
      ...tokens,
      dispositivoId: devices[0].id,
      produtoId: produto.id,
    };
  }

  async function http(
    method: 'POST' | 'GET',
    url: string,
    token?: string,
    payload?: object,
    key?: string,
    remoteAddress?: string,
  ) {
    return app.inject({
      method,
      url,
      payload,
      remoteAddress: remoteAddress ?? `127.0.0.${++sequence}`,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
    });
  }
  async function criar(tenant = a) {
    const response = await http(
      'POST',
      '/pedidos',
      tenant.totem,
      { itens: [{ produtoId: tenant.produtoId, quantidade: 2 }] },
      randomUUID(),
    );
    expect(response.statusCode).toBe(201);
    return response.json<PedidoDto>();
  }
  const liberar = (
    id: string,
    key = randomUUID(),
    token?: string,
    extra: object = {},
  ) =>
    http(
      'POST',
      `/pedidos/${id}/liberacao-demo`,
      token ?? a.dono,
      { motivo: 'Ensaio', pin: '1234', versaoEsperada: 1, ...extra },
      key,
    );
  async function evidencias(id: string, negocioId = a.negocioId) {
    return prisma.$queryRaw<{ transicoes: string[]; motivo: string }[]>`
      SELECT "transicoes", "motivo" FROM "LiberacaoDemo" WHERE "pedidoId" = ${id} AND "negocioId" = ${negocioId}
    `;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { logger: false },
    );
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = module.get(PrismaService);
    a = await fixture();
    b = await fixture();
  });

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.TOTEMOS_ENV = 'demo';
    process.env.DEMO_ENABLED = 'true';
    process.env.DEMO_DATABASE_ISOLATED = 'true';
    process.env.DEMO_ENVIRONMENT_ID = 'demo-e2e';
    process.env.DEMO_TENANT_IDS = `${a.negocioId},${b.negocioId}`;
    delete process.env.VERCEL_ENV;
    delete process.env.DEPLOYMENT_ENV;
    await prisma.produto.updateMany({
      where: { id: a.produtoId, negocioId: a.negocioId },
      data: { tempoEstimadoPreparo: 5, precoBase: 12.5 },
    });
  });

  afterAll(async () => {
    if (prisma && a && b) {
      const negocioId = { in: [a.negocioId, b.negocioId] };
      await prisma.$executeRaw`DELETE FROM "LiberacaoDemo" WHERE "negocioId" IN (${a.negocioId}, ${b.negocioId})`;
      await prisma.negocio.deleteMany({ where: { id: negocioId } });
    }
    if (app) await app.close();
  });

  test('criação marca DEMO no servidor e liberação preserva total/snapshots, senha NULL e zero pagamentos', async () => {
    const pedido = await criar();
    expect(pedido).toMatchObject({
      demo: true,
      demoAmbiente: 'demo-e2e',
      status: 'AGUARDANDO_PAGAMENTO',
      senha: null,
      versao: 1,
    });
    await prisma.produto.updateMany({
      where: { id: a.produtoId, negocioId: a.negocioId },
      data: { precoBase: 99, tempoEstimadoPreparo: 0 },
    });
    const response = await liberar(pedido.id);
    expect(response.statusCode).toBe(200);
    expect(response.json<LiberacaoDto>().pedido).toMatchObject({
      status: 'PENDENTE',
      senha: null,
      demo: true,
      versao: 2,
      elegivelCozinha: true,
    });
    const saved = await prisma.pedido.findFirst({
      where: { id: pedido.id, negocioId: a.negocioId },
      include: { itens: true, pagamentos: true },
    });
    expect(saved!.valorTotal.toString()).toBe('25');
    expect(saved!.itens[0].precoNoMomento.toString()).toBe('12.5');
    expect(saved!.pagamentos).toHaveLength(0);
    expect(await evidencias(pedido.id)).toEqual([
      { transicoes: ['AGUARDANDO_PAGAMENTO', 'PENDENTE'], motivo: 'Ensaio' },
    ]);
  });

  test('Preparo Zero só avança após liberação e registra o salto até PRONTO no mesmo commit', async () => {
    await prisma.produto.updateMany({
      where: { id: a.produtoId, negocioId: a.negocioId },
      data: { tempoEstimadoPreparo: 0 },
    });
    const pedido = await criar();
    expect(pedido.status).toBe('AGUARDANDO_PAGAMENTO');
    await prisma.produto.updateMany({
      where: { id: a.produtoId, negocioId: a.negocioId },
      data: { tempoEstimadoPreparo: 5 },
    });
    const result = await liberar(pedido.id);
    expect(result.statusCode).toBe(200);
    expect(result.json<LiberacaoDto>().pedido).toMatchObject({
      status: 'PRONTO',
      senha: null,
      versao: 3,
    });
    expect((await evidencias(pedido.id))[0].transicoes).toEqual([
      'AGUARDANDO_PAGAMENTO',
      'PENDENTE',
      'PRONTO',
    ]);
  });

  test('retentativas concorrentes e resposta perdida retornam uma única liberação, inclusive após avanço', async () => {
    const pedido = await criar();
    const key = randomUUID();
    const results = await Promise.all([
      liberar(pedido.id, key),
      liberar(pedido.id, key),
    ]);
    expect(results.map((x) => x.statusCode)).toEqual([200, 200]);
    expect(
      results
        .map((x) => x.json<LiberacaoDto>().resultadoOperacao.repetida)
        .sort(),
    ).toEqual([false, true]);
    expect(await evidencias(pedido.id)).toHaveLength(1);
    await prisma.pedido.updateMany({
      where: { id: pedido.id, negocioId: a.negocioId },
      data: { status: 'ENTREGUE', versao: 4 },
    });
    const replay = await liberar(pedido.id, key);
    expect(replay.statusCode).toBe(200);
    expect(replay.json<LiberacaoDto>().pedido.status).toBe('ENTREGUE');
    expect(await evidencias(pedido.id)).toHaveLength(1);
  });

  test('chaves distintas concorrentes não liberam duas vezes', async () => {
    const pedido = await criar();
    const results = await Promise.all([
      liberar(pedido.id),
      liberar(pedido.id, randomUUID(), a.outroDono),
    ]);
    expect(results.map((x) => x.statusCode).sort()).toEqual([200, 409]);
    expect(await evidencias(pedido.id)).toHaveLength(1);
  });

  test('mesma chave com conteúdo ou pedido divergente retorna 409', async () => {
    const primeiro = await criar();
    const segundo = await criar();
    const key = randomUUID();
    expect((await liberar(primeiro.id, key)).statusCode).toBe(200);
    expect(
      (await liberar(primeiro.id, key, undefined, { motivo: 'Outro motivo' }))
        .statusCode,
    ).toBe(409);
    expect((await liberar(segundo.id, key)).statusCode).toBe(409);
    expect(await evidencias(segundo.id)).toHaveLength(0);
  });

  test('PRODUÇÃO e configuração ausente vetam ação e replay sem alterar fatos anteriores', async () => {
    const pedido = await criar();
    const key = randomUUID();
    expect((await liberar(pedido.id, key)).statusCode).toBe(200);
    process.env.NODE_ENV = 'production';
    expect((await liberar(pedido.id, key)).statusCode).toBe(403);
    const real = await criar();
    expect(real.demo).toBe(false);
    expect(real.demoAmbiente).toBeNull();
    expect((await liberar(real.id)).statusCode).toBe(403);
    process.env.NODE_ENV = 'test';
    delete process.env.DEMO_ENABLED;
    expect((await liberar(pedido.id, key)).statusCode).toBe(403);
    expect(await evidencias(pedido.id)).toHaveLength(1);
  });

  test('pedido real não pode virar DEMO ao habilitar configuração posteriormente', async () => {
    delete process.env.DEMO_ENABLED;
    const real = await criar();
    process.env.DEMO_ENABLED = 'true';
    expect((await liberar(real.id)).statusCode).toBe(409);
    expect(await evidencias(real.id)).toHaveLength(0);
  });

  test('GERENTE, TOTEM e PAINEL não aprovam, mesmo com PIN; token inválido é 401', async () => {
    const pedido = await criar();
    for (const token of [a.gerente, a.totem, a.painel])
      expect((await liberar(pedido.id, randomUUID(), token)).statusCode).toBe(
        403,
      );
    expect(
      (await liberar(pedido.id, randomUUID(), 'invalido')).statusCode,
    ).toBe(401);
    expect(await evidencias(pedido.id)).toHaveLength(0);
  });

  test('Dono de outro tenant recebe 404 sem ler ou alterar a liberação', async () => {
    const pedido = await criar();
    const key = randomUUID();
    expect((await liberar(pedido.id, key)).statusCode).toBe(200);
    expect((await liberar(pedido.id, key, b.dono)).statusCode).toBe(404);
    expect(await evidencias(pedido.id, b.negocioId)).toHaveLength(0);
    const proprio = await criar(b);
    expect((await liberar(proprio.id, key, b.dono)).statusCode).toBe(200);
    expect(await evidencias(proprio.id, b.negocioId)).toHaveLength(1);
  });

  test('PIN incorreto e vínculo DONO revogado impedem inclusive replay', async () => {
    const pedido = await criar();
    const key = randomUUID();
    expect(
      (await liberar(pedido.id, key, undefined, { pin: '9999' })).statusCode,
    ).toBe(401);
    expect((await liberar(pedido.id, key)).statusCode).toBe(200);
    await prisma.usuario.updateMany({
      where: { id: a.donoId, negocioId: a.negocioId },
      data: { role: Role.GERENTE },
    });
    try {
      expect((await liberar(pedido.id, key)).statusCode).toBe(403);
    } finally {
      await prisma.usuario.updateMany({
        where: { id: a.donoId, negocioId: a.negocioId },
        data: { role: Role.DONO },
      });
    }
  });

  test('campos arbitrários, chave ausente e versão inválida são rejeitados sem liberação', async () => {
    const pedido = await criar();
    expect(
      (await liberar(pedido.id, randomUUID(), undefined, { aprovado: true }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await liberar(pedido.id, randomUUID(), undefined, {
          versaoEsperada: 99,
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await http('POST', `/pedidos/${pedido.id}/liberacao-demo`, a.dono, {
          motivo: 'Ensaio',
          pin: '1234',
          versaoEsperada: 1,
        })
      ).statusCode,
    ).toBe(400);
    expect(await evidencias(pedido.id)).toHaveLength(0);
    expect(
      (
        await http('POST', '/pedidos', a.totem, {
          demo: true,
          itens: [{ produtoId: a.produtoId, quantidade: 1 }],
        })
      ).statusCode,
    ).toBe(400);
  });

  test('cancelado, outro ambiente e tentativa financeira vinculada não podem ser liberados', async () => {
    const cancelado = await criar();
    await prisma.pedido.updateMany({
      where: { id: cancelado.id, negocioId: a.negocioId },
      data: { status: 'CANCELADO' },
    });
    expect((await liberar(cancelado.id)).statusCode).toBe(409);
    const financeiro = await criar();
    await prisma.pagamento.create({
      data: { pedidoId: financeiro.id, valor: 25, status: 'PENDENTE' },
    });
    expect((await liberar(financeiro.id)).statusCode).toBe(409);
    const outroAmbiente = await criar();
    process.env.DEMO_ENVIRONMENT_ID = 'outro-ensaio';
    expect((await liberar(outroAmbiente.id)).statusCode).toBe(409);
  });

  test('falha ao gravar auditoria faz rollback do status e permite repetir a mesma operação', async () => {
    const pedido = await criar();
    const key = randomUUID();
    await prisma.$executeRaw`ALTER TABLE "LiberacaoDemo" ADD CONSTRAINT "demo_e2e_rollback" CHECK ("motivo" <> 'ROLLBACK_TEST')`;
    try {
      expect(
        (await liberar(pedido.id, key, undefined, { motivo: 'ROLLBACK_TEST' }))
          .statusCode,
      ).toBe(500);
      const saved = await prisma.pedido.findFirst({
        where: { id: pedido.id, negocioId: a.negocioId },
      });
      expect(saved).toMatchObject({
        status: 'AGUARDANDO_PAGAMENTO',
        versao: 1,
        senha: null,
      });
      expect(await evidencias(pedido.id)).toHaveLength(0);
    } finally {
      await prisma.$executeRaw`ALTER TABLE "LiberacaoDemo" DROP CONSTRAINT "demo_e2e_rollback"`;
    }
    expect(
      (await liberar(pedido.id, key, undefined, { motivo: 'ROLLBACK_TEST' }))
        .statusCode,
    ).toBe(200);
    expect(await evidencias(pedido.id)).toHaveLength(1);
  });

  test('novo serviço e nova conexão recuperam liberação persistida após reinício', async () => {
    const pedido = await criar();
    const key = randomUUID();
    expect((await liberar(pedido.id, key)).statusCode).toBe(200);
    const connection = new PrismaService();
    try {
      const restarted = new LiberacaoDemoService(connection);
      const result = await restarted.liberar(
        {
          identity: 'USER',
          isDispositivo: false,
          role: Role.DONO,
          sub: a.donoId,
          negocioId: a.negocioId,
          email: 'fixture@example.test',
        },
        pedido.id,
        { motivo: 'Ensaio', pin: '1234', versaoEsperada: 1 },
        key,
      );
      expect(result.resultadoOperacao.repetida).toBe(true);
      expect(result.pedido).toMatchObject({
        status: 'PENDENTE',
        versao: 2,
        senha: null,
      });
      expect(await evidencias(pedido.id)).toHaveLength(1);
    } finally {
      await connection.$disconnect();
    }
  });

  test('JWT expirado, dispositivo revogado e tenant fora da allowlist são negados', async () => {
    const pedido = await criar();
    const expired = new JwtService({ secret: process.env.JWT_SECRET }).sign(
      {
        identity: 'USER',
        sub: a.donoId,
        email: 'fixture@example.test',
        negocioId: a.negocioId,
        role: Role.DONO,
      },
      { expiresIn: -1 },
    );
    expect((await liberar(pedido.id, randomUUID(), expired)).statusCode).toBe(
      401,
    );
    await prisma.dispositivo.updateMany({
      where: { id: a.dispositivoId, negocioId: a.negocioId },
      data: { ativo: false, revogadoEm: new Date() },
    });
    try {
      expect((await liberar(pedido.id, randomUUID(), a.totem)).statusCode).toBe(
        401,
      );
    } finally {
      await prisma.dispositivo.updateMany({
        where: { id: a.dispositivoId, negocioId: a.negocioId },
        data: { ativo: true, revogadoEm: null },
      });
    }
    process.env.DEMO_TENANT_IDS = b.negocioId;
    expect((await liberar(pedido.id)).statusCode).toBe(403);
    expect(await evidencias(pedido.id)).toHaveLength(0);
  });

  test('ação sensível limita tentativas de PIN a cinco por minuto', async () => {
    const pedido = await criar();
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await http(
        'POST',
        `/pedidos/${pedido.id}/liberacao-demo`,
        a.dono,
        { motivo: 'Ensaio', pin: '9999', versaoEsperada: 1 },
        randomUUID(),
        '127.0.0.250',
      );
      expect(response.statusCode).toBe(attempt < 5 ? 401 : 429);
    }
    expect(await evidencias(pedido.id)).toHaveLength(0);
  });
});
