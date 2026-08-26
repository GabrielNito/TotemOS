import { test, expect, describe } from 'bun:test';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { RegistrarSchema } from '../src/auth/dto/registrar.dto';

interface JwtPayloadDecoded {
  sub: string;
  email: string;
  negocioId: string;
  role: Role;
}

describe('Módulo de Autenticação (TDD)', () => {
  const jwtService = new JwtService({
    secret: 'super-segredo-totemos-jwt-v1',
    signOptions: { expiresIn: '7d' },
  });

  test('Hash e verificação de senha com bcrypt', async () => {
    const senhaPlana = 'senha123admin';
    const hash = await bcrypt.hash(senhaPlana, 10);

    const matchValido = await bcrypt.compare('senha123admin', hash);
    const matchInvalido = await bcrypt.compare('senhaErrada', hash);

    expect(matchValido).toBe(true);
    expect(matchInvalido).toBe(false);
  });

  test('Emissão e decodificação do JWT Token', () => {
    const payload: JwtPayloadDecoded = {
      sub: 'usr-uuid-123',
      email: 'admin@totemos.com.br',
      negocioId: 'neg-uuid-456',
      role: Role.DONO,
    };

    const token = jwtService.sign(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = jwtService.verify<JwtPayloadDecoded>(token);
    expect(decoded.sub).toBe('usr-uuid-123');
    expect(decoded.email).toBe('admin@totemos.com.br');
    expect(decoded.role).toBe(Role.DONO);
  });

  test('Validação de permissão por Roles (DONO vs GERENTE)', () => {
    const usuarioDono = { role: Role.DONO };
    const usuarioGerente = { role: Role.GERENTE };

    const rolesPermitidasParaConfig: Role[] = [Role.DONO];

    const donoPodeAcessar = rolesPermitidasParaConfig.includes(
      usuarioDono.role,
    );
    const gerentePodeAcessar = rolesPermitidasParaConfig.includes(
      usuarioGerente.role,
    );

    expect(donoPodeAcessar).toBe(true);
    expect(gerentePodeAcessar).toBe(false);
  });

  test('Validação de PIN do Dono (4 dígitos)', async () => {
    const pinHash = await bcrypt.hash('1234', 10);

    const pinValido = await bcrypt.compare('1234', pinHash);
    const pinInvalido = await bcrypt.compare('9999', pinHash);

    expect(pinValido).toBe(true);
    expect(pinInvalido).toBe(false);
  });

  test('Validação Zod do DTO de Registro (RegistrarSchema)', () => {
    const payloadValido = {
      nomeNegocio: 'Burgers & Fries',
      slugNegocio: 'burgers-fries',
      pinDono: '5678',
      nomeUsuario: 'Carlos Dono',
      email: 'carlos@burgers.com',
      senhaPlana: 'senhaForte123',
    };

    const resultadoValido = RegistrarSchema.safeParse(payloadValido);
    expect(resultadoValido.success).toBe(true);

    const payloadInvalido = {
      nomeNegocio: 'AB', // curto
      slugNegocio: 'Slug Inválido Com Espaço',
      pinDono: '12', // menos de 4 digitos
      nomeUsuario: '',
      email: 'email-invalido',
      senhaPlana: '123', // menos de 6 caracteres
    };

    const resultadoInvalido = RegistrarSchema.safeParse(payloadInvalido);
    expect(resultadoInvalido.success).toBe(false);
  });
});
