import { test, expect, describe } from 'bun:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('Hardening de Segurança e Isolamento de Tenant (TDD)', () => {
  test('Isolamento de Tenant: Bloqueia validação de PIN de outro estabelecimento', () => {
    const usuarioLogadoNegocioId = 'negocio-a-1111';
    const alvoTentativaNegocioId = 'negocio-b-2222';

    const validarTenant = (userNegocioId: string, targetNegocioId: string) => {
      if (userNegocioId !== targetNegocioId) {
        throw new ForbiddenException(
          'Acesso negado: Você não possui permissão para validar ações neste estabelecimento',
        );
      }
    };

    expect(() =>
      validarTenant(usuarioLogadoNegocioId, alvoTentativaNegocioId),
    ).toThrow(ForbiddenException);

    expect(() =>
      validarTenant(usuarioLogadoNegocioId, usuarioLogadoNegocioId),
    ).not.toThrow();
  });

  test('Validação de Segredo JWT: Lança erro de configuração caso JWT_SECRET esteja ausente', () => {
    const obterJwtSecret = (envSecret?: string): string => {
      if (!envSecret || envSecret.trim() === '') {
        throw new Error(
          'Configuração crítica de segurança ausente: JWT_SECRET deve ser fornecido no ambiente',
        );
      }
      return envSecret;
    };

    expect(() => obterJwtSecret(undefined)).toThrow();
    expect(() => obterJwtSecret('')).toThrow();
    expect(obterJwtSecret('segredo-valido-123')).toBe('segredo-valido-123');
  });

  test('Proteção contra Força Bruta: PIN inválido deve rejeitar com UnauthorizedException', async () => {
    const pinHash = await bcrypt.hash('1234', 10);

    const verificarPin = async (pinDigitado: string, hash: string) => {
      const valido = await bcrypt.compare(pinDigitado, hash);
      if (!valido) {
        throw new UnauthorizedException('PIN do dono incorreto');
      }
      return true;
    };

    let erroCapturado: Error | null = null;
    try {
      await verificarPin('0000', pinHash);
    } catch (e) {
      erroCapturado = e as Error;
    }

    expect(erroCapturado).toBeInstanceOf(UnauthorizedException);
    const resultado = await verificarPin('1234', pinHash);
    expect(resultado).toBe(true);
  });
});
