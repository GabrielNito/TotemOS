# Regras Específicas do Backend (NestJS + Prisma)

Diretrizes para desenvolvimento e manutenção na aplicação `backend/` ou `apps/backend/`.

---

## Estrutura e Padrões

1. **Framework e Adaptador**:
   - Runtime: **Bun**.
   - Framework: **NestJS** com **FastifyAdapter** (`@nestjs/platform-fastify`).

2. **Validação e DTOs**:
   - Todas as rotas usam `ValidationPipe` do NestJS e schemas de validação com **Zod**.

3. **Banco de Dados (Prisma)**:
   - Respeitar estritamente o esquema em `backend/prisma/schema.prisma`.
   - Utilizar a estratégia `PrismaModule` global para injeção de dependência do `PrismaService`.

4. **Tratamento de Exceções**:
   - Retornar status HTTP semânticos (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found).
   - Não engolir exceções em blocos `try/catch` vazios.

5. **Testes**:
   - Testes do backend utilizam o runner nativo `bun:test`.
