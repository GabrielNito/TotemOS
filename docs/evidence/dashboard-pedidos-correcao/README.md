# Correção do histórico de pedidos, card #34

[Card](https://trello.com/c/vcH5ikug), responsável principal Caio (Memlith).
PR original [#22](https://github.com/GabrielNito/TotemOS/pull/22), integrado em
`e034c0f60821c19ddc5d4ef4eef1392d0c3681df`.
Branch corretiva `fix/dashboard-pedidos-historico-p0` criada dessa develop em
worktree próprio. Nenhum arquivo/commit do
[PR #23, card #35](https://github.com/GabrielNito/TotemOS/pull/23) foi alterado ou
cherry-picked. O worktree anterior foi preservado no HEAD `f69af0e`.

## Auditoria e bugs

Prioridade | Problema | Correção
--- | --- | ---
P1 | Backend filtrava dataSequencial e frontend voltava a filtrar createdAt; pedido com senha atribuída no dia seguinte desaparecia | Novos filtros explícitos de criação; sem segunda filtragem por data na página
P1 | Assinatura união de Query impedia o pipe global de reconhecer o DTO: datas inválidas/negocioId arbitrário passavam pelo HTTP | ZodValidationPipe explícito na entrada, mantendo chamada legada do controller
P2 | Lista, filtros e refresh sem proteção contra resposta tardia | AbortController e geração por fonte, descarte ao trocar filtro/sessão/unmount
P2 | Detalhe A podia substituir B ou publicar após fechar | Geração própria do detalhe, cancelamento no fechamento e verificação do ID recebido
P2 | Erro de dispositivos convertido em [] silenciosamente | Fonte independente, aviso de origem limitada, pedidos continuam legíveis
P3 | Valor nominal chamado de confirmado, sem comprovação financeira | Novo campo nominal em centavos, textos explícitos, DEMO/cancelados separados, campo legado preservado
P3 | Placeholder anunciava busca #014, mas somente 14 era encontrado | Busca também considera a senha formatada exibida

## Contrato de datas antes/depois

Antes: dataIniciadaEm/dataFinalizadaEm filtravam dataSequencial inclusivamente;
a UI ainda filtrava createdAt em UTC. Pedido criado em 04/11 às 23h de São Paulo
(`2026-11-05T02:00Z`) e com senha em 05/11 podia desaparecer de ambos os dias.

Agora: `criadoEmInicio=2026-11-04&criadoEmFim=2026-11-05` é
`[2026-11-04T03:00Z, 2026-11-05T03:00Z)`. O pedido aparece pela criação,
independentemente da senha. A UI descreve início inclusivo/fim exclusivo e
apresenta a data operacional separadamente. Para selecionar um dia inteiro,
escolher o próprio dia no início e o dia seguinte no fim exclusivo.

Os filtros legados não foram renomeados nem mudaram de significado. Novos e
legados não podem ser combinados; datas inexistentes e intervalo invertido ou
vazio são 400. Filtros novos são exclusivos de humanos DONO/GERENTE; PAINEL
continua usando as rotas anteriores e TOTEM continua bloqueado no histórico.

`@js-temporal/polyfill` é a única dependência runtime adicionada ao backend;
converte cada data civil separadamente, sem fixar UTC-3 ou assumir 24h. Validamos
também 04/11/2018 (23h) e 16/02/2019 (25h) em São Paulo. Referência:
[Temporal.PlainDate.toZonedDateTime](https://tc39.es/proposal-temporal/docs/plaindate.html#toZonedDateTime).

## Concorrência, erros e segurança

`HistoricoPedidosConsulta` pertence somente à página/sessão. JWT humano é
capturado por instância, sem negocioId arbitrário na query. Troca de tenant,
usuário ou token remonta a tela. Respostas fora do tenant são rejeitadas.
Lista, cadastro e detalhe têm geração e AbortController próprios, timeout 20s.
Uma resposta ou erro obsoleto não altera dados, loading nem erro atuais.
Fechar o modal invalida o detalhe imediatamente. Não há polling/cache global.

Pedidos indisponíveis não viram contagem zero. Um refresh manual pode reter os
cards anteriores com timestamp e aviso de snapshot desatualizado; ao mudar
filtro, os dados anteriores são ocultados até a nova resposta. A tabela mostra
erro principal em falha. Cadastro pode falhar sem bloquear a lista; dados de
cadastro anteriores são identificados como desatualizados. 401/403 invalidam
todas as fontes imediatamente, incluindo detalhe; 404/429/503 e rede/timeout
têm mensagens específicas/seguras sem reproduzir payload interno do servidor.

## Dinheiro e snapshots

`valorNominalComercial`: soma de valorTotal em centavos de pedidos não DEMO e
não cancelados, incluindo AGUARDANDO_PAGAMENTO. Não é receita. Ambos os status
de cancelamento são excluídos e possuem contagem/valor nominal separados.
DEMO tem contagem e soma operacional próprias. ENTREGUE não comprova pagamento.
Faturamento permanece indisponível. Detalhe continua mostrando snapshots e
registros de pagamento recebidos, sem consultar catálogo ou executar mutações.

`valorComercialConfirmado` mantém a regra anterior para compatibilidade e está
marcado deprecated; não é utilizado como receita nesta correção. Os campos
novos do helper são aditivos. `/admin` e o PR #23 não dependem de alteração de
significado desse campo. Nenhuma regra de pagamentos, senha ou KDS foi alterada.

## TDD e validação local em 06/11/2026

Etapa | Resultado observado
--- | ---
RED backend (contrato/query) | 8 pass / 7 fail, parâmetro novo rejeitado e WHERE createdAt ausente
GREEN backend | 15 pass, datas, tenant, limites, DST e encaminhamento pelo controller
RED HTTP/PostgreSQL | 8 pass / 4 fail, pipe global não validava a query união
GREEN HTTP/PostgreSQL | 12 pass após pipe explícito
RED API frontend | 5 pass / 1 fail, novos parâmetros e signal não enviados
RED monetário | 6 pass / 1 fail, campo nominal não existia
RED estado/React | Módulo de consulta inexistente e view ainda não extraída; funções antigas sem geração auditadas
RED busca #014 | 6 pass / 1 fail, pedido existente desaparecia na busca formatada
GREEN Dashboard | **32 pass / 0 fail**, 5 arquivos, inclui as 13 regressões anteriores
GREEN backend Bun | **118 pass / 0 fail**, 15 arquivos, 214 expect calls
PostgreSQL isolado | **52 pass / 0 fail**: DEMO 16, transições 11, senha 13, criação 12
Lint Dashboard/backend | Exit 0, sem erros ou warnings
TypeScript Dashboard/backend | Exit 0 (`bun run typecheck` / `bunx tsc --noEmit`)
Build Dashboard/backend | Exit 0, Next 16.2.6 / Nest

Total local: **202 testes aprovados**, separando testes Bun/DOM de integração
real Nest/Fastify/Prisma/PostgreSQL. Logs de erro nas suítes antigas de rollback
são cenários negativos esperados (constraints fixture_rollback/senha_rollback),
com testes aprovados; não se alega ausência de logs de erro em testes negativos.
Prettier e git diff --check são conferidos nos arquivos alterados antes do commit.

Docker Desktop foi iniciado para o teste e um container dedicado PostgreSQL 18
foi criado em `127.0.0.1:55435`, banco `totemos_demo_test`. Somente migrations já
versionadas foram aplicadas nesse banco descartável; nenhuma migration nova ou
acesso ao Neon/banco operacional. Fixtures são isoladas por tenant e removidas
pelas suítes. As validações de URL recusam destinos externos/outro nome de banco.

`bun install` foi usado. O repositório ignora bun.lock; não há garantia de
instalação reproduzível via frozen lockfile. happy-dom foi adicionado apenas
como dependência de testes DOM, sem copiar os testes ou a camada do card #35.

## Compatibilidade e entrega

Arquivos compartilhados com #35: lib/api.ts (parâmetros opcionais e signal),
lib/pedidos.ts (campos aditivos) e etapa bun test na CI. Os nomes de métricas e
assinaturas existentes são preservados. O filtro de criação é aditivo e não
obriga a visão geral a migrar de estratégia neste PR. Nenhum arquivo exclusivo
do #35 foi incluído. A verificação de merge das árvores é registrada no novo PR.

A publicação deve disponibilizar o backend com novos filtros antes do frontend;
um backend antigo pode ignorar parâmetros desconhecidos e devolver todo o
histórico. Caio deve revisar o contrato. Histórico sem período continua integral,
sem paginação, e escala/custo de payload continuam limitações conhecidas.

Esta revisão usa testes de React em DOM e integração HTTP injetada com PostgreSQL
real; não é homologação visual em equipamentos ou produção. Nenhum deploy manual
foi executado. CI dos quatro aplicativos e o PR corretivo são acompanhados na
entrega; revisão humana pendente, sem merge automático. Card permanece em
Code Review & CI (PR). Homologação integrada continua no #41.
