---
name: git-commit-standards
description: Padrões de commits do Git (Conventional Commits), convenção de branches e fluxo de pull requests para a equipe do TotemOS.
---

# Skill — Padrões de Git e Commit (Conventional Commits)

Esta skill estabelece a convenção obrigatoriamente utilizada para mensagens de commit, criação de branches e revisão de código no repositório TotemOS.

---

## 1. Nomenclatura e Estrutura de Branches

O repositório possui duas branches duradouras (`main` e `develop`):
- Novas branches de desenvolvimento **SEMPRE devem ser ramificadas a partir da `develop`**.
- `feature/<escopo>-<descricao-curta>` (ex: `feature/backend-offline-reconcile`)
- `fix/<escopo>-<descricao-curta>` (ex: `fix/totem-cart-reset`)
- `docs/<descricao-curta>` (ex: `docs/arquitetura-v1`)

---

## 2. Formato das Mensagens de Commit

Todos os commits devem seguir a convenção **Conventional Commits**:

```
<tipo>(<escopo>): <descrição curta no imperativo em português>
```

### Tipos Permitidos
- `feat`: Nova funcionalidade (ex: `feat(backend): adiciona rota de reconciliacao de pedidos offline`).
- `fix`: Correção de bug (ex: `fix(totem): corrige reinicializacao do carrinho apos recusa de cartao`).
- `docs`: Alterações na documentação (ex: `docs(specs): atualiza modelo de dados do prisma`).
- `refactor`: Refatoração de código sem alterar comportamento externo.
- `test`: Adição ou ajuste de testes unitários/integração.
- `chore`: Atualização de dependências ou configurações de build.

### Regras
- Escreva a descrição em **português**, no **imperativo** (ex: "adiciona", "corrige", "remove", não "adicionado" nem "adicionando").
- Mantenha a primeira linha com no máximo 72 caracteres.
- Não use ponto final na mensagem do commit.

---

## 3. Checklist de Pre-Commit / PR

Antes de criar um commit ou abrir um Pull Request:
1. Confirmar que a branch foi criada a partir de `develop`.
2. Verificar se os testes estão passando (`bun test`).
3. Verificar se o build compila sem erros (`bun run build`).
4. Confirmar que nenhum arquivo contendo `.env` ou segredos foi adicionado.
5. Garantir que as regras de negócio em `AGENTS.md` e `docs/*-SPEC.md` foram respeitadas.
