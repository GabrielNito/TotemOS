import { describe, expect, test } from 'bun:test';
import { demoEnvironmentFor } from '../src/pedidos/demo-policy';

const negocioId = '11111111-1111-4111-8111-111111111111';
const configured = {
  NODE_ENV: 'test',
  TOTEMOS_ENV: 'demo',
  DEMO_ENABLED: 'true',
  DEMO_DATABASE_ISOLATED: 'true',
  DEMO_ENVIRONMENT_ID: 'ensaio-local',
  DEMO_TENANT_IDS: negocioId,
};

describe('Política DEMO do servidor', () => {
  test('habilita somente tenant explícito e retorna identificador estável', () => {
    expect(demoEnvironmentFor(negocioId, configured)).toBe('ensaio-local');
    expect(demoEnvironmentFor('outro-negocio', configured)).toBeNull();
    expect(
      demoEnvironmentFor(negocioId, { ...configured, TOTEMOS_ENV: 'test' }),
    ).toBe('ensaio-local');
  });

  test('qualquer indicação de produção veta DEMO, mesmo com flags ligadas', () => {
    for (const variable of [
      'NODE_ENV',
      'TOTEMOS_ENV',
      'VERCEL_ENV',
      'DEPLOYMENT_ENV',
    ]) {
      expect(
        demoEnvironmentFor(negocioId, {
          ...configured,
          [variable]: 'production',
        }),
      ).toBeNull();
    }
  });

  test('configuração ausente, desconhecida ou incompleta falha fechada', () => {
    expect(demoEnvironmentFor(negocioId, {})).toBeNull();
    for (const variable of Object.keys(configured)) {
      expect(
        demoEnvironmentFor(negocioId, { ...configured, [variable]: '' }),
      ).toBeNull();
    }
    for (const override of [
      { NODE_ENV: 'unknown' },
      { TOTEMOS_ENV: 'staging' },
      { DEMO_ENABLED: '1' },
      { DEMO_DATABASE_ISOLATED: 'false' },
      { DEMO_ENVIRONMENT_ID: 'ambiente com espaços' },
    ]) {
      expect(
        demoEnvironmentFor(negocioId, { ...configured, ...override }),
      ).toBeNull();
    }
  });
});
