# TotemOS — Diretrizes e Regras Globais para Agentes AI

Este arquivo estabelece os princípios invioláveis e as regras de arquitetura que TODOS os agentes de IA devem seguir estritamente ao trabalhar neste repositório.

---

## 1. Regras Invioláveis de Negócio (Non-Negotiables)

1. **Isolamento Estrito de Tenant (`negocioId`)**:
   - Todas as entidades e consultas no banco de dados pertencem a um `Negocio`.
   - Nenhuma consulta ou mutação pode ser executada sem filtrar explicitamente pelo `negocioId` correspondente ao dispositivo ou usuário autenticado.

2. **Preço Snapshot em Pedidos (`precoNoMomento`)**:
   - O preço de produtos, adicionais e deltas de combos gravados em um pedido é SEMPRE um snapshot (`precoNoMomento` / `deltaNoMomento`).
   - NUNCA recalcular o valor de um pedido passado a partir dos preços atuais do catálogo.

3. **Confirmação de Pagamento**:
   - Pedidos iniciados no Totem nascem com o status `AGUARDANDO_PAGAMENTO`.
   - O pedido SÓ entra na fila da cozinha (`PENDENTE`) após a confirmação assíncrona do webhook do Mercado Pago ou aceitação de pagamento offline.

4. **Autoridade de Senha no Painel (KDS)**:
   - A senha sequencial diária do pedido é atribuída pelo **Painel de Pedidos (KDS)** no momento em que o pedido é recebido.
   - O backend cloud DEVE aceitar e persistir a senha atribuída pelo Painel durante sincronizações e reconciliações offline.

5. **Segurança e PIN do Dono**:
   - Operações sensíveis (alteração de configurações do negócio, cancelamentos e confirmação de estornos) exigem validação prévia do PIN do dono (verificado via hash bcrypt e isolamento de tenant).
   - Dispositivos (Totem e Painel) utilizam `deviceToken` persistente e possuem escopo restrito a vendas e fila.

6. **Produtos com Preparo Zero (`tempoEstimadoPreparo = 0`)**:
   - Se todos os itens de um pedido tiverem `tempoEstimadoPreparo = 0` (ex: bebidas enlatadas), o status do pedido avança automaticamente de `PENDENTE` diretamente para `PRONTO`.

---

## 2. Metodologia de Desenvolvimento: TDD e Qualidade de Código

Para a construção e modificação de código no TotemOS, os agentes e desenvolvedores devem utilizar obrigatoriamente a abordagem **TDD** e validação de linter:

1. **Escrever o Teste Primeiro (RED)**:
   - Crie os arquivos de teste (ex: `bun test` no backend) codificando as regras de negócio e cenários limite antes de escrever o código da funcionalidade.
2. **Implementar a Solução Mínima (GREEN)**:
   - Escreva apenas o código estritamente necessário para fazer os testes passarem limpos.
3. **Refatorar com Segurança e Linter (REFACTOR)**:
   - Execute obrigatoriamente `bun run lint` garantindo 0 erros e 0 warnings no ESLint e formatação Prettier.

---

## 3. Convenção de Git e Branches

1. **Estratégia de Branches**:
   - `main`: Código de produção (bloqueada para push direto).
   - `develop`: Branch principal de desenvolvimento. Novas branches de trabalho DEVEM ser criadas a partir da `develop`.
   - Formato: `feature/<escopo>-<nome>` ou `fix/<escopo>-<nome>`.

2. **Conventional Commits**:
   - `<tipo>(<escopo>): <descrição no imperativo em português>`
   - Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
   - Exemplo: `feat(backend): adiciona reconciliacao de pedidos offline em lote`.

---

## 4. Padrões de Código e Comunicação (Unslop)

- **Sem código desnecessário**: Não crie arquivos de código sem solicitação explícita do usuário.
- **Redação Natural**: Evite clichês de IA (como "vale ressaltar", "é importante destacar", "robusto", "inovador", "tapeçaria"). Use tom direto e factual.
- **Pontuação**: Evite travessões (—) no meio de frases. Use vírgulas ou pontos finais.

---

## 5. Estrutura da Documentação do Repositório

- **Contratos e Especificações**: Consulte os arquivos em `docs/` (`backend-SPEC.md`, `totem-SPEC.md`, `painel-SPEC.md`, `dashboard-SPEC.md`).
- **Regras do Backend**: Consulte [`.agents/rules/backend.md`](file:///c:/Users/Nito/www/TotemOS/.agents/rules/backend.md).
- **Fluxo de Trabalho**: Consulte [`CONTRIBUTING.md`](file:///c:/Users/Nito/www/TotemOS/CONTRIBUTING.md).
- **Skills Operacionais**: Consulte `.agents/skills/` para procedimentos de setup, migração e testes.
