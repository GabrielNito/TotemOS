import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { Role, TipoDispositivo } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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
  JWT_SECRET: 'pedidos-criacao-test-only',
  DEVICE_TOKEN_PEPPER: 'pedidos-criacao-test-only',
  PAIRING_CODE_PEPPER: 'pedidos-criacao-test-only',
  NODE_ENV: 'test',
});

describe('Histórico por criação com PostgreSQL isolado', () => {
  let app: NestFastifyApplication, prisma: PrismaService;
  const tenants: string[] = [],
    tokens: string[] = [];
  const dono: string[] = [],
    gerente: string[] = [];
  const deviceToken = randomUUID();
  let painelToken = '';
  let seq = 0;
  const ids: Record<string, string> = {};
  const get = (query: string, token = dono[0]) =>
    app.inject({
      method: 'GET',
      url: '/pedidos' + query,
      remoteAddress: `127.0.0.${++seq}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    for (let i = 0; i < 2; i++) {
      const n = await prisma.negocio.create({
        data: {
          nome: 'Fixture histórico',
          slug: randomUUID(),
          pinDonoHash: 'fixture',
        },
      });
      tenants.push(n.id);
      for (const role of [Role.DONO, Role.GERENTE]) {
        const u = await prisma.usuario.create({
          data: {
            negocioId: n.id,
            nome: role,
            email: randomUUID() + '@example.test',
            senhaHash: 'fixture',
            role,
          },
        });
        const token = jwt.sign({
          sub: u.id,
          negocioId: n.id,
          email: u.email,
          role,
          identity: 'USER',
        });
        tokens.push(token);
        (role === Role.DONO ? dono : gerente).push(token);
      }
    }
    for (const [token, tipo] of [
      [deviceToken, TipoDispositivo.TOTEM],
      [randomUUID(), TipoDispositivo.PAINEL],
    ] as const) {
      await prisma.dispositivo.create({
        data: {
          negocioId: tenants[0],
          nome: tipo,
          tipo,
          tokenHash: createHmac('sha256', process.env.DEVICE_TOKEN_PEPPER!)
            .update(token)
            .digest('hex'),
        },
      });
      if (tipo === TipoDispositivo.PAINEL) painelToken = token;
    }
    for (const [nome, createdAt, dataSequencial, senha] of [
      ['cruzado', '2026-11-05T02:00:00Z', '2026-11-05', 1],
      ['mesmoDia', '2026-11-04T20:00:00Z', '2026-11-04', 2],
      ['inicioSemSenha', '2026-11-04T03:00:00Z', '2026-11-04', null],
      ['fimExclusivo', '2026-11-05T03:00:00Z', '2026-11-04', 3],
      ['anterior', '2026-11-04T02:59:59.999Z', '2026-11-04', null],
      ['mes', '2026-12-01T02:59:59.999Z', '2026-12-01', 4],
      ['ano', '2027-01-01T02:59:59.999Z', '2027-01-01', 5],
      ['dst23', '2018-11-04T03:00:00Z', '2018-11-05', 6],
      ['dst25', '2019-02-17T02:59:59.999Z', '2019-02-18', 7],
    ] as const) {
      const p = await prisma.pedido.create({
        data: {
          negocioId: tenants[0],
          createdAt: new Date(createdAt),
          dataSequencial,
          senha,
          valorTotal: '12.35',
          itens: {
            create: {
              nomeProduto: 'Snapshot histórico',
              precoNoMomento: '12.35',
              quantidade: 1,
            },
          },
        },
      });
      ids[nome] = p.id;
    }
    const outro = await prisma.pedido.create({
      data: {
        negocioId: tenants[1],
        createdAt: new Date('2026-11-05T02:00:00Z'),
        dataSequencial: '2026-11-04',
        valorTotal: '99.99',
      },
    });
    ids.outro = outro.id;
  }, 30000);
  afterAll(async () => {
    if (prisma && tenants.length)
      await prisma.negocio.deleteMany({ where: { id: { in: tenants } } });
    if (app) await app.close();
  });
  test('criação filtra início inclusivo/fim exclusivo e ignora dia da senha', async () => {
    for (const token of [dono[0], gerente[0]]) {
      const res = await get(
        '?criadoEmInicio=2026-11-04&criadoEmFim=2026-11-05',
        token,
      );
      expect(res.statusCode).toBe(200);
      const lista = res.json<
        Array<{
          id: string;
          negocioId: string;
          senha: number | null;
          itens: Array<{ nomeProduto: string }>;
        }>
      >();
      expect(lista.map((p) => p.id).sort()).toEqual(
        [ids.cruzado, ids.mesmoDia, ids.inicioSemSenha].sort(),
      );
      expect(lista.every((p) => p.negocioId === tenants[0])).toBe(true);
      expect(lista.find((p) => p.id === ids.inicioSemSenha)?.senha).toBeNull();
      expect(lista[0].itens[0].nomeProduto).toBe('Snapshot histórico');
    }
  });
  test('outro tenant recebe somente o próprio pedido e detalhe cruzado é 404', async () => {
    const res = await get(
      '?criadoEmInicio=2026-11-04&criadoEmFim=2026-11-05',
      dono[1],
    );
    expect(res.json<Array<{ id: string }>>().map((p) => p.id)).toEqual([
      ids.outro,
    ]);
    const detalhe = await app.inject({
      method: 'GET',
      url: '/pedidos/' + ids.cruzado,
      headers: { authorization: 'Bearer ' + dono[1] },
      remoteAddress: `127.0.0.${++seq}`,
    });
    expect(detalhe.statusCode).toBe(404);
  });
  test.each([
    ['2026-11-30', '2026-12-01', 'mes'],
    ['2026-12-31', '2027-01-01', 'ano'],
    ['2018-11-04', '2018-11-05', 'dst23'],
    ['2019-02-16', '2019-02-17', 'dst25'],
  ])(
    'virada/DST %s até %s preserva registro correto',
    async (inicio, fim, nome) => {
      const res = await get(`?criadoEmInicio=${inicio}&criadoEmFim=${fim}`);
      expect(res.statusCode).toBe(200);
      expect(res.json<Array<{ id: string }>>().map((p) => p.id)).toEqual([
        ids[nome],
      ]);
    },
  );
  test('legado continua filtrando dataSequencial com fim inclusivo', async () => {
    const res = await get(
      '?dataIniciadaEm=2026-11-04&dataFinalizadaEm=2026-11-04',
    );
    expect(res.statusCode).toBe(200);
    const lista = res.json<Array<{ id: string }>>().map((p) => p.id);
    expect(lista).toContain(ids.fimExclusivo);
    expect(lista).not.toContain(ids.cruzado);
  });
  test.each([
    'criadoEmInicio=2026-02-30',
    'criadoEmInicio=2026-11-05&criadoEmFim=2026-11-04',
    'criadoEmInicio=2026-11-04&dataSequencial=2026-11-05',
    'criadoEmInicio=2026-11-04&negocioId=outro',
  ])('validação estrita rejeita %s', async (query) =>
    expect((await get('?' + query)).statusCode).toBe(400),
  );
  test('sem sessão é 401; TOTEM não acessa; PAINEL mantém rota legada sem novos filtros', async () => {
    expect((await get('', '')).statusCode).toBe(401);
    expect((await get('', deviceToken)).statusCode).toBe(403);
    expect((await get('', painelToken)).statusCode).toBe(200);
    expect(
      (await get('?criadoEmInicio=2026-11-04', painelToken)).statusCode,
    ).toBe(403);
  });
});
