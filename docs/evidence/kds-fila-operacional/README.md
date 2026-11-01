# Evidências do KDS operacional, card #23

Base: origin/develop 65b306d10554ed6f8b51597ee7f343485f8b0ded,
contendo PRs #15 (DEMO), #16 (transições) e #17 (senha diária).
Branch feature/kds-fila-operacional em worktree separado; a branch e as
alterações/evidências preexistentes do usuário foram preservadas.

## TDD

RED inicial: controller.test.ts falhou porque o módulo controller não existia.
Os cenários adicionais de retorno do background e repetição automática após
409 também falharam antes das correções. A validação de recuperação revelou
banner de erro persistindo após reconexão e uso de página antiga no loop de
numeração; ambos foram corrigidos com cobertura de regressão.

GREEN: 69 testes em 13 suítes Jest, sem failures ou snapshots pendentes.
O relatório estruturado está em jest-results.json, com caminhos normalizados.

Cobertura comportamental: sessão PAINEL, token ausente/revogado, rede preservando
credencial; Bearer, bodies estritos e Retry-After; paginação/deduplicação;
fila vazia, senha NULL, preparo zero, atribuição confirmada, persistência antes
do envio, resposta perdida/reinício/replay, duplo toque, preparo/pronto/entrega,
401/403/404/409/429/503, entrega fora da fila, polling serial, foco/background,
respostas antigas, alerta único, duas instâncias com conflito de versão,
falha de armazenamento, observação completa e ação touch acessível.

## Verificações locais

Sequência equivalente ao job KDS: npm ci, npm run lint, npm run typecheck,
npm test -- --runInBand e npx expo export --platform android --output-dir
dist/ci --clear --max-workers 2. Comandos executados em apps/kds.
Lint sem erros/warnings; TypeScript aprovado; Jest aprovado; export Android
produziu bundle Hermes e metadata.json. Resultado resumido em results.json.

A biblioteca de testes usa versão compatível com React 19.2.3 e renderer
fixado na mesma versão.

## Limites da evidência

- adb devices retornou lista vazia, sem aparelho ou emulador conectado.
- docker ps falhou por daemon Docker Desktop indisponível. Nenhum banco isolado
  operacional #41 foi fornecido ou provisionado nesta execução.
- API real + PostgreSQL + Android não foram executados. Testes Jest usam fixtures
  e API mock somente nos testes, sem fallback fictício no aplicativo.
- Sem captura visual de aparelho. Componentes touch/observações/acessibilidade
  foram exercitados por React Native Testing Library; isso não comprova layout
  em hardware, legibilidade física, instalação nem operação prolongada.
- Não houve acesso/migração ao Neon comercial, ativação DEMO produtiva ou deploy.
- Resultado remoto da CI é consultável no PR; a validação local acima não o substitui.

Roteiro de validação física e contratos em [README do KDS](../../../apps/kds/README.md).
#32 mantém resiliência/sincronização avançada entre vários KDS, e #41 mantém
provisionamento isolado, migrações operacionais e homologação integrada/física.
Som não foi incluído, por ser opcional. LAN/offline completo continua fora do P0.
