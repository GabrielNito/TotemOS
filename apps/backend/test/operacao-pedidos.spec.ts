import { describe, expect, mock, test } from 'bun:test';
import { Prisma, Role } from '@prisma/client';
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OperacaoPedidosService } from '../src/pedidos/operacao-pedidos.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { UserPayload } from '../src/auth/decorators/current-user.decorator';

const user: UserPayload = {
  identity: 'USER',
  isDispositivo: false,
  sub: 'fixture',
  negocioId: 'fixture',
  email: 'fixture@example.test',
  role: Role.DONO,
};
const dto = { status: 'EM_PREPARO' as const, versaoEsperada: 2 };
function setup(code: string) {
  const fail = mock(() =>
    Promise.reject(
      new Prisma.PrismaClientKnownRequestError('Fixture', {
        code,
        clientVersion: 'fixture',
      }),
    ),
  );
  const service = new OperacaoPedidosService({
    $transaction: fail,
    pedido: { findMany: fail, findFirst: fail },
  } as unknown as PrismaService);
  return { fail, service };
}
describe('Falhas de persistência operacionais', () => {
  test('timeout incerto não é repetido automaticamente', async () => {
    const { service, fail } = setup('P2028');
    expect(
      await service
        .transicionar(user, 'id', dto, '11111111-1111-4111-8111-111111111111')
        .catch((e: unknown) => e),
    ).toBeInstanceOf(ServiceUnavailableException);
    expect(fail).toHaveBeenCalledTimes(1);
  });
  test('deadlock limita retry a três e retorna 503', async () => {
    const { service, fail } = setup('P2034');
    expect(
      await service
        .transicionar(user, 'id', dto, '11111111-1111-4111-8111-111111111111')
        .catch((e: unknown) => e),
    ).toBeInstanceOf(ServiceUnavailableException);
    expect(fail).toHaveBeenCalledTimes(3);
  });
  test('fila indisponível responde 503 conforme contrato', async () => {
    const { service } = setup('P1001');
    expect(
      await service.fila(user, { limite: 50 }).catch((e: unknown) => e),
    ).toBeInstanceOf(ServiceUnavailableException);
  });
  test('falha de integridade não é repetida ou mascarada', async () => {
    const { service, fail } = setup('P2004');
    expect(
      await service
        .transicionar(user, 'id', dto, '11111111-1111-4111-8111-111111111111')
        .catch((e: unknown) => e),
    ).toMatchObject({ code: 'P2004' });
    expect(fail).toHaveBeenCalledTimes(1);
  });
  test('papel humano desconhecido não usa bypass do DeviceTypeGuard', async () => {
    const { service, fail } = setup('P1001');
    expect(
      await service
        .fila({ ...user, role: 'OUTRO' as Role }, { limite: 50 })
        .catch((e: unknown) => e),
    ).toBeInstanceOf(ForbiddenException);
    expect(fail).not.toHaveBeenCalled();
  });
});
