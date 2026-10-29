import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { LiberacaoDemoService } from '../src/pedidos/liberacao-demo.service';
import type { HumanUserPayload } from '../src/auth/decorators/current-user.decorator';
import { PrismaService } from '../src/prisma/prisma.service';

const user: HumanUserPayload = {
  identity: 'USER',
  isDispositivo: false,
  role: Role.DONO,
  sub: 'dono',
  email: 'dono@example.test',
  negocioId: 'negocio',
};
const configuration = {
  NODE_ENV: 'test',
  TOTEMOS_ENV: 'demo',
  DEMO_ENABLED: 'true',
  DEMO_DATABASE_ISOLATED: 'true',
  DEMO_ENVIRONMENT_ID: 'ensaio',
  DEMO_TENANT_IDS: user.negocioId,
};
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const [name, value] of Object.entries(configuration)) {
    saved[name] = process.env[name];
    process.env[name] = value;
  }
});
afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
const key = '11111111-1111-4111-8111-111111111111';
const dto = { motivo: 'Ensaio', pin: '1234', versaoEsperada: 1 };
function setup(code: string) {
  const transaction = mock(() =>
    Promise.reject(
      new Prisma.PrismaClientKnownRequestError('Fixture sem dados sensíveis', {
        code,
        clientVersion: 'fixture',
      }),
    ),
  );
  return {
    transaction,
    service: new LiberacaoDemoService({
      $transaction: transaction,
    } as unknown as PrismaService),
  };
}

describe('Falhas da liberação DEMO', () => {
  test('produção falha antes de consultar ou alterar o banco', async () => {
    const { service, transaction } = setup('P2034');
    process.env.NODE_ENV = 'production';
    const failure = await service
      .liberar(user, 'pedido', dto, key)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
  test('conflito transacional limita retentativas a três e retorna 503', async () => {
    const { service, transaction } = setup('P2034');
    const failure = await service
      .liberar(user, 'pedido', dto, key)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect(transaction).toHaveBeenCalledTimes(3);
  });
  test('timeout do pool retorna 503, sem executar novamente uma operação incerta', async () => {
    const { service, transaction } = setup('P2024');
    const failure = await service
      .liberar(user, 'pedido', dto, key)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  test('falha de integridade na auditoria não é mascarada nem repetida', async () => {
    const { service, transaction } = setup('P2004');
    const failure = await service
      .liberar(user, 'pedido', dto, key)
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'P2004' });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
