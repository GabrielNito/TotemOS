import { describe, expect, test } from 'bun:test';
import { SenhaPedidoService } from '../src/pedidos/senha-pedido.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { UserPayload } from '../src/auth/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';
const user: UserPayload = {
  identity: 'DEVICE',
  isDispositivo: true,
  sub: 'painel',
  negocioId: 'tenant',
  email: '',
  tipoDispositivo: 'PAINEL',
};
describe('Persistência de senha', () => {
  for (const [code, count] of [
    ['P2028', 1],
    ['P2034', 3],
    ['P1001', 1],
  ] as const)
    test(code, async () => {
      let calls = 0;
      const service = new SenhaPedidoService({
        $transaction: () => {
          calls++;
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('fixture', {
              code,
              clientVersion: 'test',
            }),
          );
        },
      } as unknown as PrismaService);
      const error = await service
        .atribuir(user, 'id', '11111111-1111-4111-8111-111111111111')
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ status: 503 });
      expect(calls).toBe(count);
    });
});
