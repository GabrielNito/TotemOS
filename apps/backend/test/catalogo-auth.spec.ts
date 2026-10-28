import { describe, expect, test } from 'bun:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, TipoDispositivo } from '@prisma/client';
import { CatalogoController } from '../src/catalogo/catalogo.controller';
import { DeviceTokenGuard } from '../src/auth/guards/device-token.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

process.env.JWT_SECRET = 'segredo-de-teste';
process.env.DEVICE_TOKEN_PEPPER = 'pepper-device-teste';

const usuario = {
  sub: 'usuario-1',
  email: 'dono@teste.com',
  negocioId: 'negocio-a',
  role: Role.DONO,
};

function handlerAdministrativo(): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(
    CatalogoController.prototype,
    'getCatalogoAdministrativo',
  );
  if (!descriptor || typeof descriptor.value !== 'function') {
    throw new Error('Handler administrativo não encontrado');
  }
  return descriptor.value as () => void;
}

function contexto(authorization?: string) {
  const request = { headers: { authorization }, user: undefined as unknown };
  return {
    request,
    context: {
      getHandler: handlerAdministrativo,
      getClass: () => CatalogoController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never,
  };
}

describe('Autorização do catálogo administrativo', () => {
  test('GET admin sem token é rejeitado', async () => {
    const { context } = contexto();
    const guard = new JwtAuthGuard({
      verifyAsync: () => Promise.resolve(usuario),
    } as never);
    let erro: unknown;
    try {
      await guard.canActivate(context);
    } catch (capturado) {
      erro = capturado;
    }
    expect(erro).toBeInstanceOf(UnauthorizedException);
  });

  test('JWT de usuário humano é permitido', async () => {
    const { context } = contexto('Bearer jwt-usuario');
    const jwt = { verifyAsync: () => Promise.resolve(usuario) };
    const auth = new JwtAuthGuard(jwt as never);
    expect(await auth.canActivate(context)).toBe(true);
    expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true);
  });

  for (const tipo of [TipoDispositivo.TOTEM, TipoDispositivo.PAINEL]) {
    test(`deviceToken ${tipo} é rejeitado no catálogo administrativo`, async () => {
      const { context } = contexto('Bearer token-dispositivo');
      const prisma = {
        dispositivo: {
          findFirst: () =>
            Promise.resolve({
              id: 'device-1',
              negocioId: 'negocio-a',
              ativo: true,
              tipo,
              tokenHash: 'hash-do-token',
              revogadoEm: null,
            }),
        },
      };
      const auth = new DeviceTokenGuard(prisma as never);
      expect(await auth.canActivate(context)).toBe(true);
      expect(() =>
        new RolesGuard(new Reflector()).canActivate(context),
      ).toThrow(ForbiddenException);
    });
  }
});
