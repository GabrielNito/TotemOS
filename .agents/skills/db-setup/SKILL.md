---
name: db-setup
description: Runbook e comandos para gerar o Prisma Client, executar migrações no PostgreSQL e popular o banco de dados do TotemOS.
---

# Runbook — Setup do Banco de Dados PostgreSQL (Prisma)

Procedimento para inicializar e manter o banco de dados relacional da plataforma.

---

## Passos de Execução

1. **Configurar variáveis de ambiente**:
   Garantir que a variável `DATABASE_URL` no arquivo `.env` da pasta `apps/backend/` aponte para uma instância válida do PostgreSQL:
   ```env
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/totemos?schema=public"
   ```

2. **Gerar o Prisma Client**:
   Navegar até a pasta `apps/backend/` e rodar a geração dos tipos:
   ```bash
   bunx prisma generate
   ```

3. **Executar as Migrações (Development)**:
   ```bash
   bunx prisma migrate dev --name init
   ```

4. **Visualizar o Banco via Prisma Studio**:
   ```bash
   bunx prisma studio
   ```
