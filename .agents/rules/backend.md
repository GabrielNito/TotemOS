# Regras Específicas do Backend (NestJS + Fastify + Prisma + Bun)

Diretrizes obrigatórias para o desenvolvimento e manutenção na aplicação `apps/backend/`.

---

## 1. Stack e Infraestrutura

- **Runtime**: Bun (`bun test`, `bun run build`, `bun run lint`).
- **Framework**: NestJS com **FastifyAdapter** (`@nestjs/platform-fastify`).
- **Banco de Dados**: PostgreSQL (Neon DB) gerenciado via **Prisma ORM**.
  - O `schema.prisma` deve utilizar `url = env("DATABASE_URL")` e `directUrl = env("DIRECT_URL")` para compatibilidade com pooler pgBouncer e migrações DDL.
  - Injeção global via `PrismaModule` e `PrismaService`.

---

## 2. Validação, DTOs e Tipagem Estrita (Zod)

- **DTOs com Zod**: Todos os DTOs devem utilizar a biblioteca `nestjs-zod` estendendo `createZodDto(...)` com schemas descritivos.
- **Validação Global**: Utilizar `ZodValidationPipe` registrado globalmente no `main.ts`.
- **Tipagem Estrita**: Proibido o uso de tipos `any` inseguros em handlers, guards e decorators. Declarar interfaces estritas para requests com headers e usuário (`RequestWithUserAndHeaders`).

---

## 3. Documentação de Rotas (OpenAPI & Scalar Reference)

- Todas as rotas devem ser anotadas com decorators do `@nestjs/swagger` (`@ApiTags`, `@ApiOperation`, `@ApiBody({ type: Dto })`, `@ApiBearerAuth()`, `@ApiResponse`).
- Documentar explicitamente respostas de sucesso e erros HTTP (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict`, `429 Too Many Requests`).
- A documentação interativa é servida nativamente no Fastify através da rota `/reference` com o **Scalar API Reference**.

---

## 4. Segurança e Hardening

- **Rate Limiting**: Aplicar `@Throttle({ default: { limit: 5, ttl: 60000 } })` em endpoints de autenticação e validações sensíveis (como PIN do dono e login).
- **Isolamento de Tenant**: Todo endpoint de mutação ou verificação de tenant deve validar explicitamente se o `user.negocioId` do token JWT confere com o `negocioId` do recurso solicitado.
- **Cabeçalhos de Segurança**: Registrar `@fastify/helmet` no bootstrap da aplicação.
- **Segredos e Variáveis de Ambiente**: Proibido utilizar strings de fallback hardcoded para `JWT_SECRET`. Se a variável não estiver presente no ambiente, a inicialização deve falhar de forma explícita.
- **CORS Restritivo**: Configurar origens permitidas via variável `CORS_ALLOWED_ORIGINS` com credenciais ativadas.

---

## 5. Qualidade de Código, Linter e TDD

- **Linter Obrigatório**: Antes de finalizar qualquer alteração, executar obrigatoriamente:
  ```bash
  bun run lint
  ```
  O código deve passar com **0 erros e 0 warnings** no ESLint.
- **Formatação**: Código formatado estritamente de acordo com o `.prettierrc` (padrão 80 caracteres com trailing comma).
- **TDD**: Escrever os testes unitários (`bun test`) primeiro (*RED*), implementar a solução mínima (*GREEN*) e refatorar (*REFACTOR*).
