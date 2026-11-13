# Evidências de verificação: Configurações operacionais conectadas à API (Card #37)

- Card Trello: https://trello.com/c/0nXyMoFp
- Roadmap: https://trello.com/c/iKSJ1R4J
- Branch: `feature/dashboard-configuracoes-operacionais`
- Escopo: Dashboard (`/admin/configuracoes`, cliente HTTP, schemas Zod e documentação) conectado aos endpoints reais de `NegocioConfig` (`GET /negocio/config`, `PATCH /negocio/config`) e `POST /auth/validar-pin`.

## 1. Resumo das alterações implementadas

1. **Contratos e Schemas Zod**:
   - `apps/dashboard/lib/types/models.ts`: adição dos tipos `ModoIdentificacao`, `PagamentoOfflineStatus` e `ConfiguracaoNegocio`.
   - `apps/dashboard/lib/schemas/configuracoes.ts`: criação de `ModoIdentificacaoSchema`, `ConfiguracaoNegocioResponseSchema` (exige `permitirPagamentoOffline: false`, `pagamentoOfflineOperacional: false` e `pagamentoOfflineStatus: "NAO_OPERACIONAL"`), `ConfiguracaoOperacionalFormSchema` (tempo inteiro entre 1 e 120, boas-vindas com até 200 caracteres convertendo string vazia para `null`, PIN numérico de 4 dígitos) e `ValidarPinFormSchema`.
2. **Camada de API e Gerenciador de Estado**:
   - `apps/dashboard/lib/api.ts`: criação de `getConfiguracaoNegocio` (`GET /negocio/config`, `cache: "no-store"`, Bearer explícito e `AbortSignal`) e `updateConfiguracaoNegocio` (`PATCH /negocio/config` sem `negocioId` nem flags offline no payload).
   - `apps/dashboard/lib/configuracoes-operacionais.ts`: gerenciador `GerenciadorConfiguracaoOperacional` com timeout de 20 s, controle de versão para evitar respostas obsoletas em chamadas concorrentes, bloqueio local de mutação para `GERENTE`, rejeição defensiva de `negocioId` divergente do tenant autenticado, limpeza em `401`/`403` e descarte imediato em troca de sessão/token.
3. **Interface `/admin/configuracoes`**:
   - `apps/dashboard/app/admin/configuracoes/page.tsx`: substituição integral do estado mockado local por leitura e gravação real na API, remoção de `Math.random()` e simulações com `setTimeout`, remoção do switch interativo de pagamento offline (substituído por aviso `Não operacional no P0` e status desativado no servidor), bloqueio visual e funcional de edição para `GERENTE`, validação de formulário com preservação de rascunho em erro de envio, aba `Equipe` exibindo apenas o usuário autenticado da sessão (`Indisponível no P0` para gestão de equipe adicional) e aba `PIN & Segurança` com `Alteração indisponível no P0` mais verificação do PIN atual contra `POST /auth/validar-pin`.
4. **Especificação**:
   - `docs/dashboard-SPEC.md`: atualização da árvore de rotas, tipos e inclusão da seção 7 documentando o contrato do card #37.

## 2. Cobertura TDD (RED e GREEN)

Foram escritos testes antes da implementação e validados contra os requisitos do card:

- `apps/dashboard/test/configuracoes-api.test.ts` (6 testes):
  - Validação positiva e negativa do schema `ConfiguracaoNegocioResponseSchema` (rejeita flags de offline operacional).
  - Validação de `ConfiguracaoOperacionalFormSchema` (intervalo `1..120`, limite de 200 caracteres, trim/normalização para `null`, PIN de 4 dígitos).
  - Envio de `GET /negocio/config` com Bearer, `cache: "no-store"` e `signal`, sem `negocioId` na URL.
  - Envio de `PATCH /negocio/config` sem `negocioId` nem flags offline no corpo.
  - Fluxo completo do `GerenciadorConfiguracaoOperacional`: carregamento, salvamento por `DONO`, recarregamento do estado persistido e bloqueio de `GERENTE` sem disparar HTTP.
  - Rejeição de payload cruzado entre tenants e tratamento seguro de HTTP `401`, `403`, `429` e `503`.
- `apps/dashboard/test/configuracoes-ui.test.tsx` (5 testes com `happy-dom` e React 19):
  - Carregamento real de configuração, exibição explícita de offline não operacional, edição, envio de `PATCH` com PIN do dono, limpeza do campo de PIN após envio e recarregamento persistido pelo botão `Recarregar configurações`.
  - Modo somente leitura para `GERENTE` (campos desabilitados, sem campo de PIN, sem envio de `PATCH`).
  - Rejeição de formulário inválido no cliente sem HTTP e preservação do texto editado quando `PATCH` retorna `401`.
  - Abas `Equipe` (apenas usuário autenticado, sem `Adicionar Usuário` ou mocks) e `PIN & Segurança` (`Alteração indisponível no P0`, sem alteração falsa e chamada real a `POST /auth/validar-pin`).
  - Limpeza completa de dados em `401` na leitura e na troca de tenant/token.

## 3. Verificações executadas após a última edição de código

Todos os comandos abaixo foram executados em `apps/dashboard/` com saída integral sem falhas:

- `bunx prettier --check app/admin/configuracoes/page.tsx lib/configuracoes-operacionais.ts lib/schemas/configuracoes.ts lib/api.ts lib/types/models.ts test/configuracoes-api.test.ts test/configuracoes-ui.test.tsx`: aprovado (`All matched files use Prettier code style!`).
- `bun run lint`: aprovado (`eslint`, 0 erros e 0 warnings).
- `bun run typecheck`: aprovado (`tsc --noEmit`, 0 erros).
- `bun test`: `132 pass`, `0 fail`, `326 expect() calls` em 12 arquivos de teste (inclui `test/configuracoes-api.test.ts` e `test/configuracoes-ui.test.tsx`, sem regressão nos demais testes do Dashboard).
- `bun run build`: aprovado (`next build` Next.js 16.2.6 com Turbopack, compilação e TypeScript concluídos para todas as rotas administrativas e públicas).
