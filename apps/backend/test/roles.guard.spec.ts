import { describe, expect, test } from 'bun:test';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { RolesGuard } from '../src/auth/guards/roles.guard';

class RotaAdministrativa {
  @Roles(Role.DONO, Role.GERENTE)
  catalogo() {}
}

function handlerDa(prototipo: object, nome: string): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(prototipo, nome);
  if (!descriptor || typeof descriptor.value !== 'function') {
    throw new Error('Handler de teste não encontrado');
  }
  return descriptor.value as () => void;
}

function contextoPara(user: { role: Role; isDispositivo?: boolean }) {
  return {
    getHandler: () => handlerDa(RotaAdministrativa.prototype, 'catalogo'),
    getClass: () => RotaAdministrativa,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  test('permite DONO quando a rota permite DONO', () => {
    expect(guard.canActivate(contextoPara({ role: Role.DONO }))).toBe(true);
  });

  test('permite GERENTE quando a rota permite GERENTE', () => {
    expect(guard.canActivate(contextoPara({ role: Role.GERENTE }))).toBe(true);
  });

  test('rejeita role fora dos requisitos da rota', () => {
    class RotaDoDono {
      @Roles(Role.DONO)
      executar() {}
    }
    const context = {
      getHandler: () => handlerDa(RotaDoDono.prototype, 'executar'),
      getClass: () => RotaDoDono,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.GERENTE } }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  test('rejeita dispositivo mesmo quando seu role coincide com a rota', () => {
    expect(() =>
      guard.canActivate(
        contextoPara({ role: Role.GERENTE, isDispositivo: true }),
      ),
    ).toThrow(ForbiddenException);
  });
});
