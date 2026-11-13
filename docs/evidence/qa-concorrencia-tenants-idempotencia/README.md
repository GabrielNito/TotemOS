# Evidências de verificação: Concorrência, tenants e idempotência fim a fim (Card #39)

- Card Trello: https://trello.com/c/fcNvIDEV
- Roadmap: https://trello.com/c/iKSJ1R4J
- Branch: `feature/qa-concorrencia-tenants-idempotencia`
- Escopo: Endurecimento de idempotência/revogação em `POST /pedidos`, nova suíte E2E `apps/backend/test/fluxo-invariantes-p0.e2e-spec.ts` em PostgreSQL real isolado (`totemos_demo_test`), script CI e atualização da especificação.

## 1. Endurecimentos e suíte implementados

1. **`POST /pedidos` (`apps/backend/src/pedidos/pedidos.controller.ts` e `pedidos.service.ts`)**:
   - Validação de cabeçalho `Idempotency-Key` vazio e rejeição de divergência entre cabeçalho e `dto.idempotencyKey` (`400 Bad Request`).
   - Revalidação transacional (`FOR UPDATE`) do dispositivo `TOTEM` ativo e não revogado em `options.dispositivoId` (`401 Unauthorized` em revogação em trânsito).
   - Serialização por `pg_advisory_xact_lock` da chave de idempotência em `PedidosService.criar`, validação de compatibilidade no replay (`409 Conflict` para outro payload, outro dispositivo ou chave já usada em outro estabelecimento) e tradução de falhas de conexão Prisma para `503 Service Unavailable`.
2. **Suíte E2E dedicada (`apps/backend/test/fluxo-invariantes-p0.e2e-spec.ts`)**:
   - Exige `DEMO_TEST_DATABASE_URL` apontando estritamente para host local (`localhost`, `127.0.0.1` ou `[::1]`) e banco `/totemos_demo_test`.
   - Limpeza determinística no `afterAll` de `TransicaoPedido`, `AtribuicaoSenha`, `ContadorSenha`, `LiberacaoDemo` e `Negocio` (cascata nos dois tenants de fixture).
   - Execução reproduzível via `bun run test:invariantes:e2e` em `apps/backend/package.json` e integrada ao workflow `.github/workflows/ci.yml`.

## 2. Matriz de cenários positivos e negativos verificados

| Categoria | Cenário positivo | Cenário negativo / proteção | Resultado observado |
| --- | --- | --- | --- |
| Concorrência 2 KDS | Dois `PAINEL` pedindo senha no mesmo pedido obtêm a mesma `senha: 1` e `versao: 3`, com apenas 1 `AtribuicaoSenha` inicial | Corrida de `PATCH /pedidos/:id/status` entre dois `PAINEL` permite 1 avanço (`200`) e rejeita o concorrente (`409`); dois pedidos distintos recebem senhas `{2, 3}` | Aprovado |
| Isolamento e identidades | Cada negócio opera sua própria fila e sequência de senha independente a partir de `1`; `GET /acompanhamento` atende apenas ao `TOTEM` criador | Produto ou pedido cruzado entre tenants retorna `404`; matriz de papéis bloqueia `PAINEL`, `TOTEM`, `DONO` e `GERENTE` nas rotas indevidas com `403` | Aprovado |
| Revogação em trânsito | Operações com dispositivo ativo e `DONO` válido concluem | Revogar `TOTEM` durante `POST /pedidos`, revogar `PAINEL` durante `POST /pedidos/:id/senha` ou `PATCH /pedidos/:id/status` retorna `401` sem efeitos; rebaixar `DONO` antes do lock retorna `403` | Aprovado |
| Idempotência `POST /pedidos` e resultado incerto | Erro `503` antes do commit permite retentativa bem-sucedida; concorrência com mesma chave grava 1 pedido; replay pós-commit com alteração de preço e esgotamento preserva snapshot original e estado `EM_PREPARO` | Reuso da mesma chave com outro payload, outro `TOTEM` ou outro negócio retorna `409`; divergência entre header `Idempotency-Key` e corpo retorna `400` | Aprovado |
| Preparo Zero, status inválido e liberação DEMO | Produto `tempoEstimadoPreparo = 0` nasce `AGUARDANDO_PAGAMENTO` (`preparoZero: true`), salta para `PRONTO` na liberação DEMO (`versao: 3`, `senha: null`), recebe senha (`versao: 4`) e conclui `ENTREGUE` (`versao: 5`); replay de liberação mantém `repetida: true` | Entrega antes da senha retorna `409`; status inválidos (`AGUARDANDO_PAGAMENTO`, `PENDENTE`, `CANCELADO`) retornam `400`; retorno a `EM_PREPARO` retorna `409`; liberação repetida com nova chave ou motivo divergente retorna `409` | Aprovado |

## 3. Verificações executadas após a última edição

Ambiente: container descartável PostgreSQL 18 (`totemos_demo_test` em `127.0.0.1:5432`, removido após o ensaio), com `prisma migrate deploy` aplicando as 5 migrações sem divergência (`prisma migrate diff --exit-code` retornou `No difference detected.`):

- `bun run lint`: aprovado (`eslint`, 0 erros e 0 warnings).
- `bunx tsc --noEmit`: aprovado (0 erros).
- `bun test`: `122 pass`, `0 fail`, `220 expect() calls` em 15 arquivos.
- `bun run build` (`nest build`): aprovado.
- `bun run test:demo:e2e`: `16 passed, 16 total`.
- `bun run test:operacao:e2e`: `11 passed, 11 total`.
- `bun run test:senha:e2e`: `13 passed, 13 total`.
- `bun run test:pedidos:e2e`: `12 passed, 12 total`.
- `bun run test:invariantes:e2e`: `3 passed, 3 total`.
- Consulta após cleanup (`SELECT count(*) FROM "Negocio"` e `SELECT count(*) FROM "Pedido"`): `0` registros remanescentes.
