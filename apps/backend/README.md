# TotemOS Backend

API NestJS com Fastify e Prisma, executada com Bun. A [spec](../../docs/backend-SPEC.md) resume as rotas, papéis e regras em uso.

## Desenvolvimento local

1. Disponibilize um PostgreSQL local e copie [`.env.example`](.env.example) para `.env`.
2. Ajuste `DATABASE_URL` e `DIRECT_URL` para o banco local. Defina `JWT_SECRET`, `PAIRING_CODE_PEPPER` e `DEVICE_TOKEN_PEPPER` com valores próprios.
3. A partir de `apps/backend`, instale as dependências, aplique as migrações no banco local e suba a API.

```bash
bun install
bunx prisma migrate deploy
bun run start:dev
```

A API usa a porta 3001 por padrão. Consulte `/reference` para Scalar ou `/swagger-json` para o contrato OpenAPI. `ALLOWED_ORIGINS` controla origens adicionais em produção. O exemplo ainda lista `MP_ACCESS_TOKEN` para a integração futura.

A liberação DEMO começa desabilitada. Use o [contrato DEMO](../../docs/contratos/liberacao-demo.md) para configurar um banco isolado e tenants de ensaio.

## Validação

```bash
bun run lint
bunx tsc --noEmit
bun test
bun run build
```

A [CI](../../.github/workflows/ci.yml) executa também as suítes `test:demo:e2e`, `test:operacao:e2e`, `test:senha:e2e`, `test:pedidos:e2e`, `test:configuracoes:e2e` e `test:invariantes:e2e`. Use PostgreSQL local dedicado chamado `totemos_demo_test`, com as migrações aplicadas e `DEMO_TEST_DATABASE_URL` apontando para essa instância.
