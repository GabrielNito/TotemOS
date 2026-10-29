import { expect, test } from 'bun:test';
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
      mensagemBoasVindas: 'Escolha seu café.',
    },
  },
};

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
      mensagemBoasVindas: 'Escolha seu café.',
      pagamentoPointConfigurado: true,
    },
  });
  expect(JSON.stringify(response)).not.toContain('private-');
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
      mensagemBoasVindas: null,
      pagamentoPointConfigurado: false,
    },
  });
});
