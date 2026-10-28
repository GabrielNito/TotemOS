import { createHmac, randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import {
  Prisma,
  PrismaClient,
  Role,
  StatusCodigoPareamento,
  TipoDispositivo,
} from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const testDatabaseUrl = process.env.DEVICE_PAIRING_TEST_DATABASE_URL;
const testJwtSecret = 'device-pairing-red-jwt-secret';
const testPairingCodePepper = 'device-pairing-red-code-pepper';
const testDeviceTokenPepper = 'device-pairing-red-device-pepper';

interface UserFixture {
  id: string;
  email: string;
  negocioId: string;
  role: Role;
}

interface BusinessFixture {
  id: string;
  owner: UserFixture;
  manager: UserFixture;
  productId: string;
}

interface ActivationBody {
  deviceToken: string;
  dispositivo: {
    id: string;
    negocioId: string;
    tipo: TipoDispositivo;
  };
}

interface PairingCodeBody {
  codigo: string;
  expiraEm: string;
  codigoHash?: string;
  code?: string;
}

interface DeviceListBody {
  dispositivos: Array<{ id: string }>;
}

const authorization = (token: string) => `Bearer ${token}`;

function codeHash(codigo: string): string {
  return createHmac('sha256', testPairingCodePepper)
    .update(codigo)
    .digest('hex');
}

function makeUserToken(user: UserFixture): string {
  return new JwtService({ secret: testJwtSecret }).sign({
    sub: user.id,
    email: user.email,
    negocioId: user.negocioId,
    role: user.role,
  });
}

function pedidoBody(productId: string) {
  return {
    idempotencyKey: randomUUID(),
    itens: [{ produtoId: productId, quantidade: 1 }],
  };
}

function responseBody<T>(response: { body: unknown }): T {
  return response.body as T;
}

async function insertPairingCode(
  prisma: PrismaClient,
  fixture: BusinessFixture,
  codigo: string,
  status: 'ATIVO' | 'CONSUMIDO' | 'EXPIRADO',
): Promise<number> {
  const nowExpression =
    status === 'ATIVO'
      ? Prisma.sql`NOW() + INTERVAL '15 minutes'`
      : Prisma.sql`NOW() - INTERVAL '1 second'`;

  return prisma.$executeRaw`
    INSERT INTO "CodigoPareamento" (
      "id",
      "negocioId",
      "criadoPorUsuarioId",
      "nome",
      "tipo",
      "codigoHash",
      "expiraEm",
      "status",
      "createdAt"
    ) VALUES (
      ${randomUUID()},
      ${fixture.id},
      ${fixture.owner.id},
      ${`Fixture ${status}`},
      'TOTEM'::"TipoDispositivo",
      ${codeHash(codigo)},
      ${nowExpression},
      ${status}::"StatusCodigoPareamento",
      NOW()
    )
  `;
}

if (!testDatabaseUrl) {
  describe('Pareamento de dispositivos, pré-condições', () => {
    it('exige uma conexão PostgreSQL dedicada em DEVICE_PAIRING_TEST_DATABASE_URL', () => {
      throw new Error(
        'Defina DEVICE_PAIRING_TEST_DATABASE_URL para executar os testes RED contra PostgreSQL real; DATABASE_URL não é usado como fallback.',
      );
    });
  });
} else {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DIRECT_URL = testDatabaseUrl;
  process.env.JWT_SECRET = testJwtSecret;
  process.env.PAIRING_CODE_PEPPER = testPairingCodePepper;
  process.env.DEVICE_TOKEN_PEPPER = testDeviceTokenPepper;

  describe('Pareamento seguro de dispositivos, TDD GREEN', () => {
    let app: NestFastifyApplication;
    let httpServer: App;
    let prisma: PrismaService;
    let fixtureA: BusinessFixture;
    let fixtureB: BusinessFixture;

    async function generateCode(
      token: string,
      tipo: TipoDispositivo = TipoDispositivo.TOTEM,
      nome = `Fixture ${randomUUID()}`,
    ) {
      return request(httpServer)
        .post('/dispositivos/parear/codigo')
        .set('Authorization', authorization(token))
        .send({ nome, tipo });
    }

    async function activateCode(codigo: string, negocioId?: string) {
      const body: Record<string, string> = { codigo };
      if (negocioId) body.negocioId = negocioId;

      return request(httpServer).post('/dispositivos/parear/ativar').send(body);
    }

    async function createBusiness(
      suffix: string,
      emailPrefix: string,
    ): Promise<BusinessFixture> {
      const negocio = await prisma.negocio.create({
        data: {
          nome: `Negócio ${suffix}`,
          slug: `device-pairing-${suffix.toLowerCase()}`,
          pinDonoHash: '$2b$10$device-pairing-red-fixture-hash',
          usuarios: {
            create: {
              nome: `Dono ${suffix}`,
              email: `${emailPrefix}.owner@example.com`,
              senhaHash: '$2b$10$device-pairing-red-fixture-hash',
              role: Role.DONO,
            },
          },
        },
        include: { usuarios: true },
      });

      const owner = negocio.usuarios[0];
      const manager = await prisma.usuario.create({
        data: {
          nome: `Gerente ${suffix}`,
          email: `${emailPrefix}.manager@example.com`,
          senhaHash: '$2b$10$device-pairing-red-fixture-hash',
          role: Role.GERENTE,
          negocioId: negocio.id,
        },
      });
      const categoria = await prisma.categoria.create({
        data: {
          nome: `Categoria ${suffix}`,
          negocioId: negocio.id,
        },
      });
      const produto = await prisma.produto.create({
        data: {
          nome: `Produto ${suffix}`,
          negocioId: negocio.id,
          categoriaId: categoria.id,
          precoBase: 10,
          tempoEstimadoPreparo: 0,
        },
      });

      return {
        id: negocio.id,
        owner: {
          id: owner.id,
          email: owner.email,
          negocioId: negocio.id,
          role: owner.role,
        },
        manager: {
          id: manager.id,
          email: manager.email,
          negocioId: negocio.id,
          role: manager.role,
        },
        productId: produto.id,
      };
    }

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      const nestApp =
        moduleFixture.createNestApplication<NestFastifyApplication>(
          new FastifyAdapter({ trustProxy: true }),
        );
      app = nestApp;
      app.useGlobalPipes(new ZodValidationPipe());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      httpServer = app.getHttpServer();
      prisma = moduleFixture.get<PrismaService>(PrismaService);
      await prisma.pareamentoRateLimit.deleteMany();

      fixtureA = await createBusiness(randomUUID(), 'pairing-a');
      fixtureB = await createBusiness(randomUUID(), 'pairing-b');
    });

    afterAll(async () => {
      if (prisma && fixtureA) {
        await prisma.negocio.delete({ where: { id: fixtureA.id } });
      }
      if (prisma && fixtureB) {
        await prisma.negocio.delete({ where: { id: fixtureB.id } });
      }
      if (prisma) await prisma.pareamentoRateLimit.deleteMany();
      if (app) await app.close();
    });

    it('gera código válido de seis dígitos, inclusive com zeros à esquerda', async () => {
      const response = await generateCode(makeUserToken(fixtureA.owner));

      expect(response.status).toBe(201);
      const body = responseBody<PairingCodeBody>(response);

      expect(body.codigo).toMatch(/^\d{6}$/);
      expect(body.expiraEm).toBeDefined();
      expect(body.codigoHash).toBeUndefined();
    });

    it('define validade exata de quinze minutos no servidor', async () => {
      const before = Date.now();
      const response = await generateCode(makeUserToken(fixtureA.owner));
      const body = responseBody<PairingCodeBody>(response);
      const expiresAt = Date.parse(body.expiraEm);

      expect(response.status).toBe(201);
      expect(expiresAt - before).toBeGreaterThanOrEqual(14 * 60 * 1000);
      expect(expiresAt - before).toBeLessThanOrEqual(16 * 60 * 1000);
    });

    it('ativa código válido e retorna o deviceToken somente nessa resposta', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const response = await activateCode(generatedBody.codigo);
      const body = responseBody<ActivationBody>(response);

      expect(response.status).toBe(201);
      expect(body.deviceToken).toEqual(expect.any(String));
      expect(body.deviceToken.length).toBeGreaterThanOrEqual(43);
      expect(body.dispositivo.negocioId).toBe(fixtureA.id);
      expect(body.dispositivo.tipo).toBe(TipoDispositivo.TOTEM);
      expect(JSON.stringify(body)).not.toContain('tokenHash');
      expect(JSON.stringify(body)).not.toContain('codigoHash');

      const stored = await prisma.dispositivo.findUnique({
        where: { id: body.dispositivo.id },
      });
      expect(stored?.tokenHash).toBe(
        createHmac('sha256', testDeviceTokenPepper)
          .update(body.deviceToken)
          .digest('hex'),
      );

      const me = await request(httpServer)
        .get('/dispositivos/me')
        .set('Authorization', authorization(body.deviceToken));
      expect(me.status).toBe(200);
      expect(responseBody<ActivationBody>(me).dispositivo.id).toBe(
        body.dispositivo.id,
      );
    });

    it('rejeita código expirado sem criar dispositivo', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      await prisma.$executeRaw`
        UPDATE "CodigoPareamento"
        SET "expiraEm" = NOW() - INTERVAL '1 second'
        WHERE "codigoHash" = ${codeHash(generatedBody.codigo)}
      `;

      const response = await activateCode(generatedBody.codigo);
      const expired = await prisma.codigoPareamento.findFirst({
        where: { codigoHash: codeHash(generatedBody.codigo) },
      });

      expect(response.status).toBe(401);
      expect(expired?.status).toBe(StatusCodigoPareamento.EXPIRADO);
    });

    it('rejeita código já consumido', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const first = await activateCode(generatedBody.codigo);
      const second = await activateCode(generatedBody.codigo);

      expect(first.status).toBe(201);
      expect(second.status).toBe(401);
    });

    it('rejeita código malformado', async () => {
      const response = await activateCode('12345');

      expect(response.status).toBe(400);
    });

    it('rejeita código incorreto sem revelar se existe código ativo', async () => {
      const response = await activateCode('000000');

      expect(response.status).toBe(401);
      expect(responseBody<PairingCodeBody>(response).code).toBe(
        'PAIRING_CODE_UNAVAILABLE',
      );
    });

    it('mantém unicidade global somente entre ativos e preserva históricos', async () => {
      const codigo = '018273';
      await insertPairingCode(prisma, fixtureA, codigo, 'ATIVO');

      await expect(
        insertPairingCode(prisma, fixtureA, codigo, 'ATIVO'),
      ).rejects.toThrow();
      await expect(
        insertPairingCode(prisma, fixtureB, codigo, 'ATIVO'),
      ).rejects.toThrow();

      await prisma.$executeRaw`
        UPDATE "CodigoPareamento"
        SET "status" = 'EXPIRADO'::"StatusCodigoPareamento",
            "expiraEm" = NOW() - INTERVAL '1 second'
        WHERE "codigoHash" = ${codeHash(codigo)}
          AND "status" = 'ATIVO'::"StatusCodigoPareamento"
      `;

      await expect(
        insertPairingCode(prisma, fixtureA, codigo, 'EXPIRADO'),
      ).resolves.toBeDefined();
      await expect(
        insertPairingCode(prisma, fixtureB, codigo, 'CONSUMIDO'),
      ).resolves.toBeDefined();
      await expect(
        insertPairingCode(prisma, fixtureA, codigo, 'ATIVO'),
      ).resolves.toBeDefined();
    });

    it('permite somente uma ativação concorrente do mesmo código', async () => {
      const nome = `Concorrência ${randomUUID()}`;
      const generated = await generateCode(
        makeUserToken(fixtureA.owner),
        TipoDispositivo.TOTEM,
        nome,
      );

      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const responses = await Promise.all([
        activateCode(generatedBody.codigo),
        activateCode(generatedBody.codigo),
      ]);
      const successful = responses.filter(
        (response) => response.status === 201,
      );
      const rejected = responses.filter((response) =>
        [401, 409].includes(response.status),
      );
      const devices = await prisma.dispositivo.count({
        where: { negocioId: fixtureA.id, nome },
      });
      const consumedCodes = await prisma.codigoPareamento.count({
        where: {
          codigoHash: codeHash(generatedBody.codigo),
          status: StatusCodigoPareamento.CONSUMIDO,
        },
      });
      const emittedTokens = responses.filter(
        (response) =>
          response.status === 201 &&
          Boolean(responseBody<ActivationBody>(response).deviceToken),
      );

      expect(successful).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(devices).toBe(1);
      expect(consumedCodes).toBe(1);
      expect(emittedTokens).toHaveLength(1);
    });

    it('não permite ao cliente escolher negocioId na geração ou ativação', async () => {
      const ownerBToken = makeUserToken(fixtureB.owner);
      const generated = await request(httpServer)
        .post('/dispositivos/parear/codigo')
        .set('Authorization', authorization(ownerBToken))
        .send({
          nome: 'Tentativa cross-tenant',
          tipo: TipoDispositivo.TOTEM,
          negocioId: fixtureA.id,
        });
      const activation = await activateCode('123456', fixtureA.id);

      expect(generated.status).toBe(400);
      expect(activation.status).toBe(400);
    });

    it('isola listagem e revogação por negocioId', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const deviceId = responseBody<ActivationBody>(activation).dispositivo.id;

      const listFromB = await request(httpServer)
        .get('/dispositivos')
        .set('Authorization', authorization(makeUserToken(fixtureB.owner)));
      const revokeFromB = await request(httpServer)
        .delete(`/dispositivos/${deviceId}`)
        .set('Authorization', authorization(makeUserToken(fixtureB.owner)));

      expect(listFromB.status).toBe(200);
      expect(responseBody<DeviceListBody>(listFromB).dispositivos).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: deviceId })]),
      );
      expect(revokeFromB.status).toBe(404);
    });

    it('permite listagem ao GERENTE, mas mantém geração e revogação no DONO', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const body = responseBody<ActivationBody>(activation);
      const managerToken = makeUserToken(fixtureA.manager);

      const list = await request(httpServer)
        .get('/dispositivos')
        .set('Authorization', authorization(managerToken));
      const generate = await generateCode(managerToken);
      const revoke = await request(httpServer)
        .delete(`/dispositivos/${body.dispositivo.id}`)
        .set('Authorization', authorization(managerToken));

      expect(list.status).toBe(200);
      expect(generate.status).toBe(403);
      expect(revoke.status).toBe(403);

      const me = await request(httpServer)
        .get('/dispositivos/me')
        .set('Authorization', authorization(body.deviceToken));
      expect(me.status).toBe(200);
    });

    it('revoga imediatamente o token do dispositivo', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const body = responseBody<ActivationBody>(activation);

      const revoked = await request(httpServer)
        .delete(`/dispositivos/${body.dispositivo.id}`)
        .set('Authorization', authorization(makeUserToken(fixtureA.owner)));
      const session = await request(httpServer)
        .get('/dispositivos/me')
        .set('Authorization', authorization(body.deviceToken));

      expect(revoked.status).toBe(204);
      expect(session.status).toBe(401);
    });

    it('rejeita deviceToken em rota administrativa', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const body = responseBody<ActivationBody>(activation);

      const response = await request(httpServer)
        .get('/dispositivos')
        .set('Authorization', authorization(body.deviceToken));

      expect(response.status).toBe(401);
    });

    it('rejeita token TOTEM na fila restrita ao PAINEL', async () => {
      const generated = await generateCode(
        makeUserToken(fixtureA.owner),
        TipoDispositivo.TOTEM,
      );
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const body = responseBody<ActivationBody>(activation);

      const response = await request(httpServer)
        .get('/pedidos')
        .set('Authorization', authorization(body.deviceToken));

      expect(response.status).toBe(403);
    });

    it('permite token PAINEL na leitura da fila', async () => {
      const generated = await generateCode(
        makeUserToken(fixtureA.owner),
        TipoDispositivo.PAINEL,
      );
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const body = responseBody<ActivationBody>(activation);

      const response = await request(httpServer)
        .get('/pedidos')
        .set('Authorization', authorization(body.deviceToken));

      expect(response.status).toBe(200);
    });

    it('preserva autorização de usuário e Totem na criação de pedidos', async () => {
      const generated = await generateCode(
        makeUserToken(fixtureA.owner),
        TipoDispositivo.TOTEM,
      );
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const body = responseBody<ActivationBody>(activation);

      const byDevice = await request(httpServer)
        .post('/pedidos')
        .set('Authorization', authorization(body.deviceToken))
        .send(pedidoBody(fixtureA.productId));
      const byUser = await request(httpServer)
        .post('/pedidos')
        .set('Authorization', authorization(makeUserToken(fixtureA.owner)))
        .send(pedidoBody(fixtureA.productId));

      expect(byDevice.status).toBe(201);
      expect(byUser.status).toBe(201);
    });

    it('não expõe token, hash ou código na listagem administrativa', async () => {
      const generated = await generateCode(makeUserToken(fixtureA.owner));
      expect(generated.status).toBe(201);
      const generatedBody = responseBody<PairingCodeBody>(generated);
      const activation = await activateCode(generatedBody.codigo);
      expect(activation.status).toBe(201);
      const body = responseBody<ActivationBody>(activation);
      const response = await request(httpServer)
        .get('/dispositivos')
        .set('Authorization', authorization(makeUserToken(fixtureA.owner)));
      const serialized = JSON.stringify(responseBody<unknown>(response));

      expect(response.status).toBe(200);
      expect(serialized).not.toContain(body.deviceToken);
      expect(serialized).not.toContain('tokenHash');
      expect(serialized).not.toContain('codigoHash');
      expect(serialized).not.toContain('codigoPareamento');
    });

    it('aplica rate limit compartilhado para ativações por IP', async () => {
      const ip = '198.51.100.13';
      await prisma.pareamentoRateLimit.deleteMany();

      const responses: Array<{ status: number }> = [];
      for (let attempt = 0; attempt < 31; attempt += 1) {
        responses.push(
          await request(httpServer)
            .post('/dispositivos/parear/ativar')
            .set('X-Forwarded-For', ip)
            .send({ codigo: '000000' }),
        );
      }

      expect(
        responses.slice(0, 30).every((response) => response.status === 401),
      ).toBe(true);
      expect(responses[30].status).toBe(429);
    });
  });
}
