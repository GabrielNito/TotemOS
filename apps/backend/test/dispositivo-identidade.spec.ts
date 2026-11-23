import { beforeEach, expect, test } from 'bun:test';
import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service';
import { DispositivosService } from '../src/dispositivos/dispositivos.service';

const device = {
  id: 'device-a',
  negocioId: 'tenant-a',
  nome: 'Totem do salão',
  tipo: 'TOTEM',
  ativo: true,
  revogadoEm: null,
  pareadoEm: null,
  createdAt: new Date('2026-10-29T00:00:00Z'),
  tokenHash: 'private-token-hash',
  mpPointDeviceId: 'private-point-id',
  negocio: {
    id: 'tenant-a',
    nome: 'Cafeteria da Praça',
    pinDonoHash: 'private-owner-pin',
    config: {
      modoIdentificacao: 'NOME',
      tempoPadraoPreparo: 22,
      mensagemBoasVindas: 'Escolha seu café.',
    },
  },
};

beforeEach(() => {
  process.env.DEVICE_TOKEN_PEPPER = 'pepper-de-teste-com-32-bytes-minimo';
});

test('retorna identidade do estabelecimento somente no tenant autenticado e sem segredos', async () => {
  const queries: unknown[] = [];
  const prisma = {
    dispositivo: {
      findFirst: (query: unknown) => {
        queries.push(query);
        return Promise.resolve(device);
      },
    },
  };
  const service = new DispositivosService(prisma as unknown as PrismaService);
  const response = await service.me('tenant-a', 'device-a');
  expect(queries).toEqual([
    expect.objectContaining({
      where: {
        id: 'device-a',
        negocioId: 'tenant-a',
        ativo: true,
        revogadoEm: null,
      },
    }),
  ]);
  expect(response).toMatchObject({
    negocio: {
      id: 'tenant-a',
      nome: 'Cafeteria da Praça',
      modoIdentificacao: 'NOME',
      tempoPadraoPreparo: 22,
      mensagemBoasVindas: 'Escolha seu café.',
      pagamentoPointConfigurado: true,
      pagamentoOfflineOperacional: false,
    },
  });
  expect(response.negocio.lanCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(JSON.stringify(response)).not.toContain('private-');
});

test('deriva a mesma credencial LAN no tenant e outra credencial em tenant distinto', async () => {
  const prisma = {
    dispositivo: {
      findFirst: ({ where }: { where: { negocioId: string } }) =>
        Promise.resolve({
          ...device,
          negocioId: where.negocioId,
          negocio: { ...device.negocio, id: where.negocioId },
        }),
    },
  };
  const service = new DispositivosService(prisma as unknown as PrismaService);

  const primeiro = await service.me('tenant-a', 'totem-a');
  const segundo = await service.me('tenant-a', 'painel-a');
  const outro = await service.me('tenant-b', 'totem-b');

  expect(primeiro.negocio.lanCredential).toBe(segundo.negocio.lanCredential);
  expect(outro.negocio.lanCredential).not.toBe(primeiro.negocio.lanCredential);
});

test('recusa dispositivo ausente e identidade de outro estabelecimento', async () => {
  for (const result of [
    null,
    { ...device, negocio: { ...device.negocio, id: 'tenant-b' } },
  ]) {
    const prisma = {
      dispositivo: { findFirst: () => Promise.resolve(result) },
    };
    const service = new DispositivosService(prisma as unknown as PrismaService);
    const error = await service.me('tenant-a', 'device-a').then(
      () => null,
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(UnauthorizedException);
  }
});

test('usa identificação opcional quando o negócio ainda não tem configuração', async () => {
  const prisma = {
    dispositivo: {
      findFirst: () =>
        Promise.resolve({
          ...device,
          mpPointDeviceId: null,
          negocio: { ...device.negocio, config: null },
        }),
    },
  };
  const service = new DispositivosService(prisma as unknown as PrismaService);
  expect(await service.me('tenant-a', 'device-a')).toMatchObject({
    negocio: {
      modoIdentificacao: 'OPCIONAL',
      tempoPadraoPreparo: 15,
      mensagemBoasVindas: null,
      pagamentoPointConfigurado: false,
      pagamentoOfflineOperacional: false,
    },
  });
});
