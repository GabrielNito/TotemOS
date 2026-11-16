# Transições seguras de pedidos, card #30

Implementação do [card #30](https://trello.com/c/2InAb3Ob), sobre
`origin/develop` em `008a0a3`, após a liberação DEMO do PR #15.

## Contrato efetivo

| Rota | Identidade | Retorno |
| --- | --- | --- |
| `PATCH /pedidos/:id/status` | PAINEL ativo ou humano DONO/GERENTE | Operação e estado atual |
| `GET /pedidos/fila` | PAINEL ou humano DONO/GERENTE | Fila paginada elegível |
| `GET /pedidos/:id/acompanhamento` | Somente TOTEM criador | Snapshot mínimo do próprio pedido |

Credencial Bearer obrigatória. Tenant vem da credencial. ID inexistente,
de outro negócio ou, no acompanhamento, de outro Totem retorna 404 uniforme.
IDs e chaves são UUIDs. As novas leituras usam `Cache-Control: no-store`.
Schemas Zod e respostas constam no OpenAPI/Scalar.

### Preparo e entrega

```http
PATCH /pedidos/11111111-1111-4111-8111-111111111111/status
Authorization: Bearer <deviceToken-painel>
Idempotency-Key: 22222222-2222-4222-8222-222222222222
Content-Type: application/json

{"status":"EM_PREPARO","versaoEsperada":2}
```

Somente `PENDENTE → EM_PREPARO → PRONTO → ENTREGUE`. A senha precisa estar
atribuída; esta entrega não emite números, não atribui senha no GET e não
implementa o card #31. Body estrito, sem campos extras. Não há liberação,
cancelamento ou estorno pelo PATCH. Ações rotineiras de preparo/entrega não
pedem PIN; a liberação DEMO mantém DONO/PIN e as proteções do #29.

```json
{
  "resultadoOperacao": { "tipo": "TRANSICAO", "repetida": false },
  "pedido": {
    "id": "11111111-1111-4111-8111-111111111111",
    "status": "EM_PREPARO",
    "senha": 12,
    "versao": 3,
    "demo": true,
    "demoAmbiente": "ensaio",
    "elegivelCozinha": true
  }
}
```

Operação exige autorização operacional persistida, versão esperada e senha.
Cada sucesso incrementa a versão uma vez e grava `TransicaoPedido` no mesmo
commit: negócio, pedido, ator/identidade, chave, hash de conteúdo, estados,
versões e instante do servidor. Não persiste token ou PIN. Falha ao auditar
desfaz a alteração de status/versão.

Identidade e vínculo são revalidados com lock na transação, antes do pedido:
PAINEL ativo/não revogado e mesmo tenant/tipo; humano com mesmo tenant/papel.
Uma chave é única por `(negocioId, identidade, atorId, idempotencyKey)`.
Lock transacional da chave também serializa usos concorrentes para pedidos
distintos. Lock do pedido e compare-and-set de versão/status protegem dois KDS.
Um vence e o outro recebe 409 quando usam a mesma versão com chaves diferentes.

Replay da chave original e mesmo conteúdo retorna 200 com `repetida:true` e
o **estado atual**, inclusive depois da entrega. Não reaplica versão antiga.
Mesmo UUID com outro pedido, alvo ou versão recebe 409. Nova chave para estado
já atingido também recebe 409, mesmo com versão atual; não há no-op implícito.
Replays continuam exigindo credencial, vínculo e configuração DEMO válidos.
Retenção desta auditoria é persistente, sem expurgo automático nesta entrega.

Preparo zero usa exclusivamente a classificação persistida na criação. A
liberação #29 já executa `AGUARDANDO_PAGAMENTO → PENDENTE → PRONTO` no mesmo
commit e registra a sequência em `LiberacaoDemo.transicoes`. O PATCH não
permite passar por EM_PREPARO nem executar esse salto manualmente. Entrega
de preparo zero exige senha e versão, como os demais pedidos.

### Elegibilidade e limites P0

A fonte de autorização operacional implementada no P0 é DEMO: marcador de
criação, ambiente/tenant ainda habilitados, liberação auditada do mesmo negócio
e ambiente, sem tentativa financeira vinculada. Nenhum `Pagamento APROVADO`
é fabricado ou exigido para DEMO. Status isolado não prova liberação.

Pedidos sem essa evidência ficam fora da fila e não podem avançar pelo PATCH.
Pagamento real/webhook, offline e autorização de mesa continuam fora do escopo.
Essas fontes precisarão de evidência própria na política de autorização;
não devem ser simuladas com status ou acopladas à obrigatoriedade de pagamento
em um futuro modo mesa. Não há cobrança nem regra de mesa implementada aqui.

`GET /pedidos/fila?limite=50&cursor=...` aceita apenas esses dois parâmetros.
Limite inteiro de 1 a 100, padrão 50. Cursor base64url validado com tenant,
criação e ID; outro negócio ou formato inválido retorna 400. Ordenação ascendente
por criação/ID, sem filtro de dia, incluindo pedidos antigos ainda abertos.
Resposta `{pedidos, proximoCursor}`; refazer a primeira página em cada ciclo,
pois não há snapshot entre páginas. Somente PENDENTE/EM_PREPARO/PRONTO
autorizados, inclusive PRONTO com senha nula para futura numeração #31.
Projeção com itens/adicionais/escolhas, versão e marca DEMO, sem pagamentos.

Também são restritos os GETs legados do PAINEL: listagem aplica elegibilidade
mesmo sem filtro ou com filtro incompatível; detalhe inelegível retorna 404.
Humanos mantêm a consulta administrativa existente. O TOTEM continua sem
acesso a esses GETs completos.

Acompanhamento filtra simultaneamente ID, negócio e dispositivo criador.
Retorna ID/status/senha/versão, marca/ambiente DEMO, valor total persistido
em string decimal e autorização DEMO ou null. Não inclui itens, identificação
do cliente, pagamentos ou trilha interna. Senha nula é válida antes do #31.
Não expõe `dataOperacional`: a numeração e sua data pertencem ao card #31.

### Erros

400 para formato/DTO/query/chave inválidos; 401 para credencial inválida ou
revogada; 403 para ator/vínculo não permitido; 404 para recurso fora do escopo;
409 para versão, origem, senha, autorização ou chave incompatível; 429 pelo
limite global. Falhas transitórias reconhecidas de persistência retornam 503.
Deadlock/conflito transacional pode repetir até três vezes; timeout incerto não
é repetido pelo servidor. Cliente preserva a mesma chave para recuperar resultado.
Erros inesperados de integridade retornam 500 e fazem rollback, sem sucesso parcial.

## Validação e reprodução

PostgreSQL local dedicado `totemos_demo_test`, sem fallback para credenciais
operacionais. `DEMO_TEST_DATABASE_URL` deve apontar explicitamente para esse
banco. As migrações foram aplicadas somente no contêiner local de teste.

```powershell
$env:DEMO_TEST_DATABASE_URL='<conexao PostgreSQL local totemos_demo_test>'
$env:DATABASE_URL=$env:DEMO_TEST_DATABASE_URL
$env:DIRECT_URL=$env:DATABASE_URL
bunx prisma migrate deploy
bun test
bun run test:demo:e2e
bun run test:operacao:e2e
bun run lint
bunx tsc --noEmit
bun run build
```

RED inicial: oito cenários E2E falharam por ausência das rotas. Outro RED
confirmou que falha de conexão na fila precisava de tradução para 503.
GREEN: 98 testes Bun, 19 E2E de pareamento, 16 E2E DEMO e 11 E2E operacionais aprovados em
PostgreSQL 18. Os E2E novos verificam ciclo humano/PAINEL, snapshots,
preparo zero/trilha, dois PAINÉIS concorrentes, replay/chave divergente,
tenant/DTO/senha/estados inválidos, projeções, paginação, revogação após
o guard, configuração desabilitada, rollback de auditoria e OpenAPI.
Lint sem erros/warnings, TypeScript completo, build e Prettier validados.
Comparação do banco migrado com o schema Prisma sem diferenças.

Os testes atribuem senha somente como fixture da pré-condição do #31.
O caso de rollback provoca deliberadamente violação de constraint no banco
isolado; seu HTTP 500 e log de erro são esperados. A constraint é removida no
`finally`. Revisão humana/merge do PR e deploy permanecem etapas separadas.
