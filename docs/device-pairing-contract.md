# Card #13, contrato de pareamento de dispositivos

Este documento consolida o contrato implementado para o pareamento de Totens e
Painéis/KDS. O schema Prisma e os controllers do backend são a fonte executável
do contrato.

## Identidades

- `USER` é autenticado exclusivamente por JWT humano. O JWT contém `sub`,
  `email`, `negocioId`, `role` e `identity: USER`.
- `DEVICE` é autenticado exclusivamente por `deviceToken` opaco. O token tem
  32 bytes aleatórios no mínimo, é emitido em base64url e não é JWT.
- O banco armazena somente o HMAC-SHA-256 do `deviceToken`, usando
  `DEVICE_TOKEN_PEPPER`. O valor bruto só aparece na resposta de ativação.
- Dispositivo não recebe `role` artificial. A autorização usa a identidade e o
  `tipo` persistido (`TOTEM` ou `PAINEL`).
- `negocioId` nunca vem do cliente como fonte de autorização. Ele é obtido do
  JWT humano ou do registro do dispositivo após a validação do token.

## Endpoints canônicos

| Método e rota | Identidade | Autorização | Resultado sensível |
| --- | --- | --- | --- |
| `POST /dispositivos/parear/codigo` | `USER` | `DONO` | retorna o código e a expiração |
| `POST /dispositivos/parear/ativar` | pública | rate limit por IP | retorna o `deviceToken` uma única vez |
| `GET /dispositivos` | `USER` | `DONO` ou `GERENTE` | nunca retorna token, hash ou código |
| `DELETE /dispositivos/:id` | `USER` | `DONO` | revogação imediata |
| `GET /dispositivos/me` | `DEVICE` | dispositivo ativo | nunca retorna token ou hash |

O código de pareamento é um número aleatório criptograficamente seguro no
intervalo `000000` a `999999`, com zeros à esquerda, validade de 15 minutos e
uso único. O corpo de ativação aceita somente `{ codigo }`.

## Persistência e concorrência

`CodigoPareamento` mantém o histórico com os estados `ATIVO`, `CONSUMIDO` e
`EXPIRADO`. O código é comparado por HMAC e não é armazenado em claro. O
consumo usa transação PostgreSQL `SERIALIZABLE` e um `UPDATE` condicional por
`id`, `status` e validade antes de criar o dispositivo.

Prisma 6.x não suporta a preview feature `partialIndexes`. Por isso o índice
deve permanecer como SQL explícito na migration:

```sql
CREATE UNIQUE INDEX "CodigoPareamento_codigoHash_ativo_key"
ON "CodigoPareamento" ("codigoHash")
WHERE "status" = 'ATIVO';
```

Esse índice é global entre todos os negócios de forma intencional: um código
ativo não pode ser ambíguo entre tenants. Depois de expirado ou consumido, o
histórico pode conter o mesmo hash novamente.

As ativações usam `PareamentoRateLimit`, uma tabela compartilhada entre
instâncias, além do `@Throttle` local como camada adicional. O rate limit não
depende somente de memória de processo.

## Migração e dados legados

O repositório não possuía histórico Prisma de migrations. A migration inicial
`20261028160000_card13_initial_schema` foi gerada a partir do schema atual e
inclui o índice parcial. Ela foi validada em um PostgreSQL descartável, mas não
foi aplicada a nenhum ambiente existente.

Um banco já provisionado com `db push` precisa ser baselined antes de usar
`prisma migrate deploy`. Se houver linhas antigas com o campo bruto
`Dispositivo.token`, a conversão deve ser feita em uma etapa operacional
separada, calculando o HMAC com `DEVICE_TOKEN_PEPPER`, validando os tokens e só
depois removendo o campo bruto. A migration inicial não tenta adivinhar nem
copiar segredos existentes.

## Compatibilidade de autorização

- Catálogo administrativo e rotas administrativas de autenticação aceitam
  somente JWT humano. `JwtAuthGuard` não consulta mais tokens de dispositivo.
- `POST /pedidos` aceita JWT humano e `TOTEM`.
- `GET /pedidos` e `GET /pedidos/:id` aceitam JWT humano e `PAINEL`.
- Um `TOTEM` em rota de fila recebe `403`; um dispositivo revogado recebe
  `401` antes do controller.
- As consultas de pedidos, dispositivos, códigos e revogações filtram o
  `negocioId` derivado da identidade autenticada.

## Interfaces para os cards consumidores

### Card #20, Dashboard

O Dashboard usa JWT humano. O DONO solicita códigos com `nome` e `tipo`, mostra
`codigo` e `expiraEm` ao operador e consulta a lista sem receber segredos. O
DONO revoga por `id`; o GERENTE pode apenas listar.

### Card #21, Mobile e dispositivos

O cliente de ativação envia o código de seis dígitos sem `negocioId`, persiste o
`deviceToken` em armazenamento seguro do sistema operacional e usa
`Authorization: Bearer <deviceToken>`. Deve chamar `/dispositivos/me` para
confirmar `tipo` e `negocioId` atribuídos pelo backend. Painéis usam a fila;
Totens usam criação de pedidos. Nenhum cliente define o tipo, o tenant ou a
permissão.

## Matriz TDD GREEN

A suíte `apps/backend/test/device-pairing.red.e2e-spec.ts`, executada agora
como regressão GREEN contra PostgreSQL real, cobre:

- código válido, formato de seis dígitos e zeros à esquerda;
- expiração de 15 minutos e transição lógica para `EXPIRADO`;
- código consumido e código incorreto sem enumeração;
- payload malformado e tentativa de informar `negocioId`;
- colisão global entre códigos ativos e reutilização histórica;
- duas ativações simultâneas, com uma vencedora, um dispositivo, um código
  consumido e um token emitido;
- isolamento entre negócios e revogação por outro negócio;
- armazenamento HMAC do token e revogação imediata;
- restrição de `TOTEM` na fila e aceitação de usuário humano;
- aceitação de `PAINEL` na leitura da fila e rate limit após excesso de ativações;
- autorização de `GERENTE` para listar e de `DONO` para gerar/revogar;
- ausência de token, hash e código em respostas administrativas;
- preservação da autorização nas rotas de pedidos.
