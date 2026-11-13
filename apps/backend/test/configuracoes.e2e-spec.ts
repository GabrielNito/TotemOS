import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { ModoIdentificacao, Role, TipoDispositivo } from '@prisma/client';
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

const database = process.env.DEMO_TEST_DATABASE_URL;
if (!database) {
  throw new Error(
    'DEMO_TEST_DATABASE_URL deve apontar para PostgreSQL local dedicado.',
  );
}
const target = new URL(database);
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  target.pathname !== '/totemos_demo_test'
) {
  throw new Error(
    'Testes E2E só executam no banco local totemos_demo_test, sem fallback operacional.',
  );
}
process.env.DATABASE_URL = database;
process.env.DIRECT_URL = database;
process.env.JWT_SECRET = 'config-e2e-jwt-only';
process.env.DEVICE_TOKEN_PEPPER = 'config-e2e-pepper-only';
process.env.PAIRING_CODE_PEPPER = 'config-e2e-pairing-only';

interface TenantFixture {
  negocioId: string;
  donoId: string;
  donoToken: string;
  gerenteToken: string;
  totemToken: string;
  painelToken: string;
}

interface ConfigResponseDto {
  negocioId: string;
  modoIdentificacao: ModoIdentificacao;
  tempoPadraoPreparo: number;
  mensagemBoasVindas: string | null;
  permitirPagamentoOffline: boolean;
  pagamentoOfflineOperacional: boolean;
  pagamentoOfflineStatus: string;
}

interface DispositivoMeDto {
  dispositivo: { id: string; tipo: TipoDispositivo };
  negocio: {
    id: string;
    nome: string;
    modoIdentificacao: ModoIdentificacao;
    tempoPadraoPreparo: number;
    mensagemBoasVindas: string | null;
    pagamentoPointConfigurado: boolean;
    pagamentoOfflineOperacional: boolean;
  };
}

describe('Configurações persistentes do estabelecimento (PostgreSQL isolado)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;
  let sequence = 0;

  async function criarTenantFixture(
    nome: string,
    comConfigInicial: boolean,
  ): Promise<TenantFixture> {
    const suffix = randomUUID();
    const negocio = await prisma.negocio.create({
      data: {
        nome,
        slug: `cfg-${suffix}`,
        pinDonoHash: await bcrypt.hash('1234', 4),
        ...(comConfigInicial
          ? {
              config: {
                create: {
                  modoIdentificacao: ModoIdentificacao.OPCIONAL,
                  tempoPadraoPreparo: 15,
                  permitirPagamentoOffline: true,
                  mensagemBoasVindas: `Olá ${nome}`,
                },
              },
            }
          : {}),
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
    const sign = (usuario: typeof dono) =>
      jwt.sign({
        sub: usuario.id,
        email: usuario.email,
        negocioId: negocio.id,
        role: usuario.role,
        identity: 'USER',
      });

    const totemToken = randomUUID();
    const painelToken = randomUUID();
    for (const [tipo, token] of [
      [TipoDispositivo.TOTEM, totemToken],
      [TipoDispositivo.PAINEL, painelToken],
    ] as const) {
      await prisma.dispositivo.create({
        data: {
          negocioId: negocio.id,
          nome: `${tipo}-${nome}`,
          tipo,
          tokenHash: createHmac('sha256', process.env.DEVICE_TOKEN_PEPPER!)
            .update(token)
            .digest('hex'),
        },
      });
    }

    return {
      negocioId: negocio.id,
      donoId: dono.id,
      donoToken: sign(dono),
      gerenteToken: sign(gerente),
      totemToken,
      painelToken,
    };
  }

  function http(
    method: 'GET' | 'PATCH',
    url: string,
    token?: string,
    payload?: object,
    remoteAddress?: string,
  ) {
    return app.inject({
      method,
      url,
      payload,
      remoteAddress: remoteAddress ?? `127.0.1.${(++sequence % 250) + 1}`,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
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
    tenantA = await criarTenantFixture('Tenant A', true);
    tenantB = await criarTenantFixture('Tenant B', true);
  });

  beforeEach(async () => {
    await prisma.negocioConfig.upsert({
      where: { negocioId: tenantA.negocioId },
      create: {
        negocioId: tenantA.negocioId,
        modoIdentificacao: ModoIdentificacao.OPCIONAL,
        tempoPadraoPreparo: 15,
        permitirPagamentoOffline: true,
        mensagemBoasVindas: 'Olá Tenant A',
      },
      update: {
        modoIdentificacao: ModoIdentificacao.OPCIONAL,
        tempoPadraoPreparo: 15,
        permitirPagamentoOffline: true,
        mensagemBoasVindas: 'Olá Tenant A',
      },
    });
    await prisma.negocioConfig.upsert({
      where: { negocioId: tenantB.negocioId },
      create: {
        negocioId: tenantB.negocioId,
        modoIdentificacao: ModoIdentificacao.OPCIONAL,
        tempoPadraoPreparo: 15,
        permitirPagamentoOffline: true,
        mensagemBoasVindas: 'Olá Tenant B',
      },
      update: {
        modoIdentificacao: ModoIdentificacao.OPCIONAL,
        tempoPadraoPreparo: 15,
        permitirPagamentoOffline: true,
        mensagemBoasVindas: 'Olá Tenant B',
      },
    });
  });

  afterAll(async () => {
    if (prisma && tenantA && tenantB) {
      await prisma.negocio.deleteMany({
        where: { id: { in: [tenantA.negocioId, tenantB.negocioId] } },
      });
    }
    if (app) await app.close();
  });

  test('isolamento entre dois tenants e marcação não operacional do pagamento offline', async () => {
    const patchA = await http('PATCH', '/negocio/config', tenantA.donoToken, {
      pin: '1234',
      modoIdentificacao: 'NOME',
      tempoPadraoPreparo: 25,
      mensagemBoasVindas: 'Bem-vindo ao Tenant A',
    });
    expect(patchA.statusCode).toBe(200);
    expect(patchA.headers['cache-control']).toBe('no-store');
    expect(patchA.json<ConfigResponseDto>()).toEqual({
      negocioId: tenantA.negocioId,
      modoIdentificacao: 'NOME',
      tempoPadraoPreparo: 25,
      mensagemBoasVindas: 'Bem-vindo ao Tenant A',
      permitirPagamentoOffline: false,
      pagamentoOfflineOperacional: false,
      pagamentoOfflineStatus: 'NAO_OPERACIONAL',
    });

    const getA = await http('GET', '/configuracoes', tenantA.gerenteToken);
    expect(getA.statusCode).toBe(200);
    expect(getA.headers['cache-control']).toBe('no-store');
    expect(getA.json<ConfigResponseDto>()).toEqual({
      negocioId: tenantA.negocioId,
      modoIdentificacao: 'NOME',
      tempoPadraoPreparo: 25,
      mensagemBoasVindas: 'Bem-vindo ao Tenant A',
      permitirPagamentoOffline: false,
      pagamentoOfflineOperacional: false,
      pagamentoOfflineStatus: 'NAO_OPERACIONAL',
    });

    // Tenant B permanece intocado e flag legada true é projetada como não operacional.
    const getB = await http('GET', '/negocio/config', tenantB.donoToken);
    expect(getB.statusCode).toBe(200);
    expect(getB.json<ConfigResponseDto>()).toEqual({
      negocioId: tenantB.negocioId,
      modoIdentificacao: 'OPCIONAL',
      tempoPadraoPreparo: 15,
      mensagemBoasVindas: 'Olá Tenant B',
      permitirPagamentoOffline: false,
      pagamentoOfflineOperacional: false,
      pagamentoOfflineStatus: 'NAO_OPERACIONAL',
    });
  });

  test('projeta modoIdentificacao (NOME/CODIGO/OPCIONAL) e tempoPadraoPreparo aos dispositivos sem permitir alteração por eles', async () => {
    for (const modo of [
      ModoIdentificacao.NOME,
      ModoIdentificacao.CODIGO,
      ModoIdentificacao.OPCIONAL,
    ]) {
      const update = await http('PATCH', '/negocio/config', tenantA.donoToken, {
        pin: '1234',
        modoIdentificacao: modo,
        tempoPadraoPreparo: 30,
        mensagemBoasVindas: `Modo ${modo}`,
      });
      expect(update.statusCode).toBe(200);

      for (const deviceToken of [tenantA.totemToken, tenantA.painelToken]) {
        const me = await http('GET', '/dispositivos/me', deviceToken);
        expect(me.statusCode).toBe(200);
        expect(me.json<DispositivoMeDto>().negocio).toMatchObject({
          id: tenantA.negocioId,
          modoIdentificacao: modo,
          tempoPadraoPreparo: 30,
          mensagemBoasVindas: `Modo ${modo}`,
          pagamentoOfflineOperacional: false,
        });
      }
    }

    for (const deviceToken of [tenantA.totemToken, tenantA.painelToken]) {
      const deviceGet = await http('GET', '/negocio/config', deviceToken);
      expect(deviceGet.statusCode).toBe(403);

      const devicePatch = await http('PATCH', '/negocio/config', deviceToken, {
        pin: '1234',
        tempoPadraoPreparo: 99,
      });
      expect(devicePatch.statusCode).toBe(403);
    }
  });

  test('aplica 401/403 e 400 para sessão ausente, role GERENTE, PIN inválido, payload inválido e alteração de vínculo no banco', async () => {
    expect((await http('GET', '/negocio/config')).statusCode).toBe(401);
    expect(
      (await http('GET', '/negocio/config', 'token-invalido')).statusCode,
    ).toBe(401);

    // GERENTE pode ler, mas nunca alterar configurações.
    expect(
      (await http('GET', '/negocio/config', tenantA.gerenteToken)).statusCode,
    ).toBe(200);
    expect(
      (
        await http('PATCH', '/negocio/config', tenantA.gerenteToken, {
          pin: '1234',
          tempoPadraoPreparo: 20,
        })
      ).statusCode,
    ).toBe(403);

    // PIN incorreto retorna 401.
    expect(
      (
        await http('PATCH', '/negocio/config', tenantA.donoToken, {
          pin: '9999',
          tempoPadraoPreparo: 20,
        })
      ).statusCode,
    ).toBe(401);

    // Payload inválido: offline true, tempo fora da faixa, campo extra negocioId, query ?negocioId=...
    expect(
      (
        await http('PATCH', '/negocio/config', tenantA.donoToken, {
          pin: '1234',
          permitirPagamentoOffline: true,
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await http('PATCH', '/negocio/config', tenantA.donoToken, {
          pin: '1234',
          tempoPadraoPreparo: 0,
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await http('PATCH', '/negocio/config', tenantA.donoToken, {
          pin: '1234',
          tempoPadraoPreparo: 20,
          negocioId: tenantB.negocioId,
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await http(
          'GET',
          `/negocio/config?negocioId=${tenantB.negocioId}`,
          tenantA.donoToken,
        )
      ).statusCode,
    ).toBe(400);

    // Rebaixamento de DONO no banco antes de nova chamada resulta em 403 mesmo com JWT ainda válido.
    await prisma.usuario.update({
      where: { id: tenantB.donoId },
      data: { role: Role.GERENTE },
    });
    expect(
      (await http('GET', '/negocio/config', tenantB.donoToken)).statusCode,
    ).toBe(403);
    expect(
      (
        await http('PATCH', '/negocio/config', tenantB.donoToken, {
          pin: '1234',
          tempoPadraoPreparo: 25,
        })
      ).statusCode,
    ).toBe(403);
    await prisma.usuario.update({
      where: { id: tenantB.donoId },
      data: { role: Role.DONO },
    });
  });

  test('concorrência em PATCH simultâneo serializa no PostgreSQL sem erro P2002 mesmo sem linha prévia em NegocioConfig', async () => {
    const tenantSemConfig = await criarTenantFixture(
      'Sem Config Inicial',
      false,
    );
    try {
      const results = await Promise.all([
        http('PATCH', '/negocio/config', tenantSemConfig.donoToken, {
          pin: '1234',
          modoIdentificacao: 'CODIGO',
        }),
        http('PATCH', '/negocio/config', tenantSemConfig.donoToken, {
          pin: '1234',
          tempoPadraoPreparo: 42,
        }),
        http('PATCH', '/negocio/config', tenantSemConfig.donoToken, {
          pin: '1234',
          mensagemBoasVindas: 'Atualizado em concorrência',
        }),
      ]);

      expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);

      const finalState = await http(
        'GET',
        '/negocio/config',
        tenantSemConfig.donoToken,
      );
      expect(finalState.statusCode).toBe(200);
      expect(finalState.json<ConfigResponseDto>()).toEqual({
        negocioId: tenantSemConfig.negocioId,
        modoIdentificacao: 'CODIGO',
        tempoPadraoPreparo: 42,
        mensagemBoasVindas: 'Atualizado em concorrência',
        permitirPagamentoOffline: false,
        pagamentoOfflineOperacional: false,
        pagamentoOfflineStatus: 'NAO_OPERACIONAL',
      });
    } finally {
      await prisma.negocio.delete({
        where: { id: tenantSemConfig.negocioId },
      });
    }
  });
});
