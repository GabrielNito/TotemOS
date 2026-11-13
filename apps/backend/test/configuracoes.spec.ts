import { describe, expect, test } from 'bun:test';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  ModoIdentificacao,
  Prisma,
  Role,
  TipoDispositivo,
} from '@prisma/client';
import type { UserPayload } from '../src/auth/decorators/current-user.decorator';
import type { PrismaService } from '../src/prisma/prisma.service';
import { ConfiguracoesService } from '../src/configuracoes/configuracoes.service';
import {
  AtualizarConfiguracaoNegocioSchema,
  ConfiguracaoQuerySchema,
} from '../src/configuracoes/dto/configuracao-negocio.dto';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const USER_A = '22222222-2222-4222-8222-222222222222';
const DEVICE_A = '33333333-3333-4333-8333-333333333333';

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

const donoUser: UserPayload = {
  sub: USER_A,
  email: 'dono@example.test',
  negocioId: TENANT_A,
  identity: 'USER',
  role: Role.DONO,
  isDispositivo: false,
};

const gerenteUser: UserPayload = {
  sub: '44444444-4444-4444-8444-444444444444',
  email: 'gerente@example.test',
  negocioId: TENANT_A,
  identity: 'USER',
  role: Role.GERENTE,
  isDispositivo: false,
};

const totemDevice: UserPayload = {
  sub: DEVICE_A,
  email: 'totem@dispositivo.totemos.local',
  negocioId: TENANT_A,
  identity: 'DEVICE',
  isDispositivo: true,
  tipoDispositivo: TipoDispositivo.TOTEM,
};

describe('DTOs de configuração do estabelecimento', () => {
  test('aceita atualização completa e parcial com validações coerentes', () => {
    const completo = AtualizarConfiguracaoNegocioSchema.safeParse({
      pin: '1234',
      modoIdentificacao: 'NOME',
      tempoPadraoPreparo: 25,
      mensagemBoasVindas: '  Bem-vindo ao balcão!  ',
      permitirPagamentoOffline: false,
    });
    expect(completo.success).toBe(true);
    if (completo.success) {
      expect(completo.data).toEqual({
        pin: '1234',
        modoIdentificacao: 'NOME',
        tempoPadraoPreparo: 25,
        mensagemBoasVindas: 'Bem-vindo ao balcão!',
        permitirPagamentoOffline: false,
      });
    }

    const apenasTempo = AtualizarConfiguracaoNegocioSchema.safeParse({
      pin: '1234',
      tempoPadraoPreparo: 1,
    });
    expect(apenasTempo.success).toBe(true);

    const limpaMensagem = AtualizarConfiguracaoNegocioSchema.safeParse({
      pin: '1234',
      mensagemBoasVindas: '   ',
    });
    expect(limpaMensagem.success).toBe(true);
    if (limpaMensagem.success) {
      expect(limpaMensagem.data.mensagemBoasVindas).toBeNull();
    }

    const mensagemNull = AtualizarConfiguracaoNegocioSchema.safeParse({
      pin: '1234',
      mensagemBoasVindas: null,
    });
    expect(mensagemNull.success).toBe(true);
  });

  test('rejeita PIN inválido, faixa inválida de preparo, mensagem longa e payload vazio', () => {
    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        modoIdentificacao: 'NOME',
      }).success,
    ).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '12ab',
        tempoPadraoPreparo: 10,
      }).success,
    ).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '1234',
        tempoPadraoPreparo: 0,
      }).success,
    ).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '1234',
        tempoPadraoPreparo: 121,
      }).success,
    ).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '1234',
        tempoPadraoPreparo: 12.5,
      }).success,
    ).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '1234',
        mensagemBoasVindas: 'a'.repeat(201),
      }).success,
    ).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '1234',
      }).success,
    ).toBe(false);
  });

  test('rejeita habilitar pagamento offline, campos extras no body e query string', () => {
    const offlineTrue = AtualizarConfiguracaoNegocioSchema.safeParse({
      pin: '1234',
      permitirPagamentoOffline: true,
    });
    expect(offlineTrue.success).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '1234',
        tempoPadraoPreparo: 20,
        negocioId: TENANT_A,
      }).success,
    ).toBe(false);

    expect(
      AtualizarConfiguracaoNegocioSchema.safeParse({
        pin: '1234',
        tempoPadraoPreparo: 20,
        pagamentoOfflineOperacional: true,
      }).success,
    ).toBe(false);

    expect(ConfiguracaoQuerySchema.safeParse({}).success).toBe(true);
    expect(
      ConfiguracaoQuerySchema.safeParse({ negocioId: TENANT_A }).success,
    ).toBe(false);
  });
});

describe('ConfiguracoesService', () => {
  test('obter retorna configuração persistida com flag offline marcada como não operacional para DONO e GERENTE', async () => {
    const queries: unknown[] = [];
    const prisma = {
      usuario: {
        findFirst: (q: unknown) => {
          queries.push({ usuario: q });
          return Promise.resolve({ id: USER_A });
        },
      },
      negocio: {
        findUnique: (q: unknown) => {
          queries.push({ negocio: q });
          return Promise.resolve({
            id: TENANT_A,
            config: {
              modoIdentificacao: ModoIdentificacao.CODIGO,
              tempoPadraoPreparo: 20,
              mensagemBoasVindas: 'Retire pelo código',
              permitirPagamentoOffline: true,
            },
          });
        },
      },
    };

    const service = new ConfiguracoesService(
      prisma as unknown as PrismaService,
    );

    const donoRes = await service.obter(donoUser);
    expect(donoRes).toEqual({
      negocioId: TENANT_A,
      modoIdentificacao: 'CODIGO',
      tempoPadraoPreparo: 20,
      mensagemBoasVindas: 'Retire pelo código',
      permitirPagamentoOffline: false,
      pagamentoOfflineOperacional: false,
      pagamentoOfflineStatus: 'NAO_OPERACIONAL',
    });

    const gerenteRes = await service.obter(gerenteUser);
    expect(gerenteRes.negocioId).toBe(TENANT_A);
    expect(gerenteRes.pagamentoOfflineOperacional).toBe(false);
    expect(queries.length).toBe(4);
  });

  test('obter usa defaults coerentes quando NegocioConfig ainda não existe', async () => {
    const prisma = {
      usuario: {
        findFirst: () => Promise.resolve({ id: USER_A }),
      },
      negocio: {
        findUnique: () =>
          Promise.resolve({
            id: TENANT_A,
            config: null,
          }),
      },
    };

    const service = new ConfiguracoesService(
      prisma as unknown as PrismaService,
    );
    expect(await service.obter(donoUser)).toEqual({
      negocioId: TENANT_A,
      modoIdentificacao: 'OPCIONAL',
      tempoPadraoPreparo: 15,
      mensagemBoasVindas: null,
      permitirPagamentoOffline: false,
      pagamentoOfflineOperacional: false,
      pagamentoOfflineStatus: 'NAO_OPERACIONAL',
    });
  });

  test('obter recusa dispositivo, usuário removido e negócio ausente', async () => {
    const serviceSemDevice = new ConfiguracoesService(
      {} as unknown as PrismaService,
    );
    expect(
      await captureError(serviceSemDevice.obter(totemDevice)),
    ).toBeInstanceOf(ForbiddenException);

    const serviceSemUsuario = new ConfiguracoesService({
      usuario: { findFirst: () => Promise.resolve(null) },
    } as unknown as PrismaService);
    expect(
      await captureError(serviceSemUsuario.obter(donoUser)),
    ).toBeInstanceOf(ForbiddenException);

    const serviceSemNegocio = new ConfiguracoesService({
      usuario: { findFirst: () => Promise.resolve({ id: USER_A }) },
      negocio: { findUnique: () => Promise.resolve(null) },
    } as unknown as PrismaService);
    expect(
      await captureError(serviceSemNegocio.obter(donoUser)),
    ).toBeInstanceOf(NotFoundException);
  });

  test('atualizar exige DONO e PIN válido e força permitirPagamentoOffline=false no upsert', async () => {
    const pinHash = await bcrypt.hash('1234', 4);
    const upserts: unknown[] = [];

    const tx = {
      $queryRaw: (strings: TemplateStringsArray) => {
        const sql = strings.join('');
        if (sql.includes('FROM "Usuario"')) {
          return Promise.resolve([{ id: USER_A }]);
        }
        return Promise.resolve([{ id: TENANT_A, pinDonoHash: pinHash }]);
      },
      negocioConfig: {
        upsert: (args: unknown) => {
          upserts.push(args);
          return Promise.resolve({
            negocioId: TENANT_A,
            modoIdentificacao: ModoIdentificacao.NOME,
            tempoPadraoPreparo: 18,
            mensagemBoasVindas: 'Olá!',
            permitirPagamentoOffline: false,
          });
        },
      },
    };

    const prisma = {
      $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    };

    const service = new ConfiguracoesService(
      prisma as unknown as PrismaService,
    );

    expect(
      await captureError(
        service.atualizar(gerenteUser, {
          pin: '1234',
          tempoPadraoPreparo: 18,
        }),
      ),
    ).toBeInstanceOf(ForbiddenException);

    expect(
      await captureError(
        service.atualizar(totemDevice, {
          pin: '1234',
          tempoPadraoPreparo: 18,
        }),
      ),
    ).toBeInstanceOf(ForbiddenException);

    expect(
      await captureError(
        service.atualizar(donoUser, { pin: '9999', tempoPadraoPreparo: 18 }),
      ),
    ).toBeInstanceOf(UnauthorizedException);

    const updated = await service.atualizar(donoUser, {
      pin: '1234',
      modoIdentificacao: ModoIdentificacao.NOME,
      tempoPadraoPreparo: 18,
      mensagemBoasVindas: 'Olá!',
    });

    expect(updated).toEqual({
      negocioId: TENANT_A,
      modoIdentificacao: 'NOME',
      tempoPadraoPreparo: 18,
      mensagemBoasVindas: 'Olá!',
      permitirPagamentoOffline: false,
      pagamentoOfflineOperacional: false,
      pagamentoOfflineStatus: 'NAO_OPERACIONAL',
    });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toEqual({
      where: { negocioId: TENANT_A },
      create: {
        negocioId: TENANT_A,
        modoIdentificacao: ModoIdentificacao.NOME,
        tempoPadraoPreparo: 18,
        mensagemBoasVindas: 'Olá!',
        permitirPagamentoOffline: false,
      },
      update: {
        modoIdentificacao: ModoIdentificacao.NOME,
        tempoPadraoPreparo: 18,
        mensagemBoasVindas: 'Olá!',
        permitirPagamentoOffline: false,
      },
      select: {
        modoIdentificacao: true,
        tempoPadraoPreparo: true,
        mensagemBoasVindas: true,
      },
    });
  });

  test('atualizar faz retry em conflito transitório P2034 e converte indisponibilidade em 503', async () => {
    const pinHash = await bcrypt.hash('1234', 4);
    let attempts = 0;

    const tx = {
      $queryRaw: (strings: TemplateStringsArray) => {
        const sql = strings.join('');
        if (sql.includes('FROM "Usuario"')) {
          return Promise.resolve([{ id: USER_A }]);
        }
        return Promise.resolve([{ id: TENANT_A, pinDonoHash: pinHash }]);
      },
      negocioConfig: {
        upsert: () =>
          Promise.resolve({
            negocioId: TENANT_A,
            modoIdentificacao: ModoIdentificacao.OPCIONAL,
            tempoPadraoPreparo: 12,
            mensagemBoasVindas: null,
            permitirPagamentoOffline: false,
          }),
      },
    };

    const prismaRetry = {
      $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => {
        attempts += 1;
        if (attempts === 1) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Write conflict', {
              code: 'P2034',
              clientVersion: '6.4.0',
            }),
          );
        }
        return fn(tx);
      },
    };

    const serviceRetry = new ConfiguracoesService(
      prismaRetry as unknown as PrismaService,
    );
    const res = await serviceRetry.atualizar(donoUser, {
      pin: '1234',
      tempoPadraoPreparo: 12,
    });
    expect(attempts).toBe(2);
    expect(res.tempoPadraoPreparo).toBe(12);

    const prismaDown = {
      $transaction: () =>
        Promise.reject(
          new Prisma.PrismaClientKnownRequestError('Connection lost', {
            code: 'P1001',
            clientVersion: '6.4.0',
          }),
        ),
    };
    const serviceDown = new ConfiguracoesService(
      prismaDown as unknown as PrismaService,
    );
    expect(
      await captureError(
        serviceDown.atualizar(donoUser, {
          pin: '1234',
          tempoPadraoPreparo: 12,
        }),
      ),
    ).toBeInstanceOf(ServiceUnavailableException);
  });
});
