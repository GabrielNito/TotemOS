# Guia de Contribuição e Fluxo de Trabalho — TotemOS

Este documento estabelece o fluxo de trabalho obrigatório para todos os desenvolvedores e agentes de IA que contribuem para o repositório TotemOS.

---

## 1. Estratégia de Branches (Git Flow Simplificado)

O repositório opera com duas branches principais e branches temporárias de trabalho:

```
[main] (Produção)
   ▲
   │ (Pull Request Aprovado + CI Verde)
   │
[develop] (Ambiente de Integração)
   ▲
   ├─────── feature/backend-autenticacao-jwt (Desenvolvimento)
   └─────── fix/totem-reset-carrinho (Correções)
```

1. **`main` (Produção)**:
   - Código estável e testado. Representa o que está rodando em produção.
   - Bloqueada para push direto. Recebe código apenas via Pull Request vindo de `develop`.

2. **`develop` (Integração/Staging)**:
   - Branch principal de desenvolvimento onde a equipe integra as funcionalidades concluídas.
   - Onde o pipeline de CI valida a convivência de todas as novas features.

3. **Branches de Trabalho (Features & Fixes)**:
   - `feature/<escopo>-<nome-curto>` (ex: `feature/backend-autenticacao-jwt`)
   - `fix/<escopo>-<nome-curto>` (ex: `fix/totem-reset-carrinho`)
   - `docs/<nome-curto>` (ex: `docs/especificacao-backend`)

---

## 2. Metodologia de Desenvolvimento (TDD)

O TotemOS adota estritamente o desenvolvimento guiado por testes (**Test-Driven Development**):

```
    [1. RED]               [2. GREEN]              [3. REFACTOR]
Escrever o teste    ──►  Escrever o código   ──►  Melhorar o código
 que falha primeiro        mínimo que passa        mantendo o teste verde
```

1. **RED (Escrever o Teste Primeiro)**:
   - Crie o arquivo de teste descrevendo a regra de negócio e cenários de erro antes de alterar a aplicação.
   - Execute `bun test` para confirmar a falha inicial.

2. **GREEN (Implementação Mínima)**:
   - Escreva apenas o código necessário para os testes passarem.

3. **REFACTOR (Refatoração)**:
   - Melhore o código mantendo a suíte de testes verde.

---

## 3. Convenção de Commits (Conventional Commits)

Todas as mensagens de commit devem estar em **português**, no modo **imperativo**:

```
<tipo>(<escopo>): <descrição direta no imperativo>
```

### Exemplos
- `feat(backend): adiciona rota de reconciliacao de pedidos em lote`
- `fix(totem): corrige validacao de identificacao opcional`
- `test(backend): adiciona teste unitario para calculo de snapshot de preco`
- `docs(specs): atualiza diagrama de arquitetura de redes v1`

---

## 4. Checklist para Pull Requests (PRs)

- [ ] A branch foi criada a partir de `develop`.
- [ ] Todos os testes unitários e de integração estão passando (`bun test`).
- [ ] O build compila sem erros (`bun run build`).
- [ ] As regras de negócio descritas no [`AGENTS.md`](file:///c:/Users/Nito/www/TotemOS/AGENTS.md) foram respeitadas.
- [ ] Nenhum arquivo `.env` ou credencial privada foi commitado.
