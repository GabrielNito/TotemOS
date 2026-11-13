# Configurações persistentes do estabelecimento, card #36

Card: [#36](https://trello.com/c/HS95JVaq). Roadmap: [trello.com/c/iKSJ1R4J](https://trello.com/c/iKSJ1R4J).

## Escopo implementado

- Novas rotas autenticadas em `ConfiguracoesController`:
  - `GET /negocio/config` (e alias `GET /configuracoes`)
  - `PATCH /negocio/config` (e alias `PATCH /configuracoes`)
- O `negocioId` é derivado exclusivamente de `request.user.negocioId`. Parâmetros na query string e campos desconhecidos no corpo (como `negocioId`, `id` ou `pagamentoOfflineOperacional`) são rejeitados com `400 Bad Request`.
- Nenhuma migration ou alteração em `apps/backend/prisma/schema.prisma` foi criada, aproveitando integralmente o modelo `NegocioConfig` existente.

## Controle de acesso e segurança

- `GET`: exige sessão humana com perfil `DONO` ou `GERENTE` e revalida o vínculo no banco. Dispositivos (`TOTEM`, `PAINEL`) recebem `403 Forbidden`. Resposta com cabeçalho `Cache-Control: no-store`.
- `PATCH`: exige sessão humana com perfil `DONO`, validação do vínculo no banco sob lock `FOR UPDATE` na tabela `Usuario`, lock `FOR UPDATE` na tabela `Negocio`, verificação do `pin` de 4 dígitos via `bcrypt.compare` contra `Negocio.pinDonoHash` e rate limit (`5` requisições por minuto).
  - `GERENTE` tentando alterar configurações recebe `403 Forbidden`.
  - Dispositivos (`TOTEM`, `PAINEL`) tentando ler ou alterar configurações recebem `403 Forbidden`.
  - Credencial ausente, inválida ou PIN incorreto retornam `401 Unauthorized`. O PIN nunca é registrado em logs.
- Concorrência: a escrita usa `upsert` em `NegocioConfig` serializado pelo lock na linha de `Negocio`, com até 3 retentativas para conflitos transitórios (`P2034`, `40001`, `40P01`) e conversão de indisponibilidade de conexão em `503 Service Unavailable`.

## Flag legada de pagamento offline

- O pagamento offline não possui serviço operacional no P0.
- Todas as leituras (`GET /negocio/config`, `GET /configuracoes`), atualizações (`PATCH /negocio/config`, `PATCH /configuracoes`) e projeções em `GET /dispositivos/me` retornam:
  - `permitirPagamentoOffline: false`
  - `pagamentoOfflineOperacional: false`
  - `pagamentoOfflineStatus: "NAO_OPERACIONAL"` (nas rotas de configuração)
- Enviar `permitirPagamentoOffline: true` no `PATCH` é rejeitado com `400 Bad Request`.
- Novos estabelecimentos criados em `POST /auth/registrar` nascem com `permitirPagamentoOffline: false`.

## Projeção aos dispositivos (`GET /dispositivos/me`)

- O retorno `negocio` de `GET /dispositivos/me` projeta em modo somente leitura para `TOTEM` e `PAINEL`:
  - `modoIdentificacao`: `"OPCIONAL" | "NOME" | "CODIGO"`
  - `tempoPadraoPreparo`: inteiro de `1` a `120` (default `15`)
  - `mensagemBoasVindas`: texto até 200 caracteres ou `null`
  - `pagamentoPointConfigurado`: booleano
  - `pagamentoOfflineOperacional`: `false`

## Contrato HTTP

```http
GET /negocio/config
Authorization: Bearer <jwt-humano-dono-ou-gerente>
```

```http
PATCH /negocio/config
Authorization: Bearer <jwt-humano-dono>
Content-Type: application/json

{
  "pin": "<quatro dígitos>",
  "modoIdentificacao": "NOME",
  "tempoPadraoPreparo": 20,
  "mensagemBoasVindas": "Bem-vindo ao balcão!"
}
```

Resposta (`200 OK`, com `Cache-Control: no-store`):

```json
{
  "negocioId": "11111111-1111-4111-8111-111111111111",
  "modoIdentificacao": "NOME",
  "tempoPadraoPreparo": 20,
  "mensagemBoasVindas": "Bem-vindo ao balcão!",
  "permitirPagamentoOffline": false,
  "pagamentoOfflineOperacional": false,
  "pagamentoOfflineStatus": "NAO_OPERACIONAL"
}
```

## Evidências sanitizadas de verificação

Execução realizada na branch `feature/backend-configuracoes-estabelecimento` em ambiente local isolado (`totemos_demo_test` em PostgreSQL 18 via Docker, removido após a bateria):

- `cd apps/backend && bun run test:configuracoes:e2e`: 4/4 cenários aprovados (isolamento entre dois tenants e marcação não operacional do offline; projeção de `NOME`/`CODIGO`/`OPCIONAL`, `tempoPadraoPreparo` e `pagamentoOfflineOperacional: false` aos dispositivos `TOTEM` e `PAINEL` com bloqueio `403` em `GET`/`PATCH`; `401`/`403`/`400` para sessão ausente, `GERENTE`, PIN inválido, query/campos extras, `permitirPagamentoOffline: true` e alteração de vínculo no banco; concorrência com 3 `PATCH` simultâneos sem linha prévia em `NegocioConfig` finalizando com `200 OK` sem `P2002`).
- Regressão E2E completa:
  - `bun run test:demo:e2e`: 16/16 aprovados.
  - `bun run test:operacao:e2e`: 11/11 aprovados (incluindo geração e validação OpenAPI/Swagger).
  - `bun run test:senha:e2e`: 13/13 aprovados.
  - `bun run test:pedidos:e2e`: 12/12 aprovados.
- `bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code`: `No difference detected.` (sem alterações em `schema.prisma` e sem nova migration).
- Testes unitários (`cd apps/backend && bun test`): 126/126 aprovados em 16 arquivos.
- Qualidade de código (`cd apps/backend && bun run lint`, `bunx tsc --noEmit`, `bun run build`): aprovados com 0 erros e 0 warnings.
