# Liberação operacional DEMO, card #29

Implementado no [card #29](https://trello.com/c/XrQjjKto). A fila e a senha foram
integradas nos cards seguintes. A [ADR 0001](../adr/0001-contrato-operacional-p0.md)
continua sujeita à revisão do Caio.

## Comportamento em uso

- `POST /pedidos` mantém estado `AGUARDANDO_PAGAMENTO` e senha NULL. Somente a
  configuração confiável do servidor marca `demo: true` e `demoAmbiente` na
  criação. Body não aceita marca DEMO, negócio, aprovação ou preços.
- Nova rota `POST /pedidos/:id/liberacao-demo`: USER/DONO, PIN de quatro dígitos,
  motivo, versão esperada e header UUID `Idempotency-Key`. PAINEL, TOTEM e
  GERENTE não podem liberar, mesmo com PIN correto.
- Liberação passa a PENDENTE ou, se `preparoZero` já persistido, registra também
  PENDENTE → PRONTO na mesma transação. Não atribui senha nem cria/atualiza
  Pagamento, e não chama serviço financeiro.
- A resposta e as leituras atuais do pedido incluem identificação DEMO; DEMO
  significa autorização operacional de ensaio, nunca aprovação financeira.
  KDS e Totem exibem a identificação DEMO nos fluxos conectados.
- Não converte pedido real, antigo ou marcado em outro ambiente. Tentativa
  financeira vinculada, senha preexistente, versão/estado divergentes ou segunda
  liberação com outra chave retornam 409.

## Configuração e isolamento

Todos os requisitos abaixo são cumulativos, definidos **no processo servidor**:

| Variável                 | Valor necessário                                                   |
| ------------------------ | ------------------------------------------------------------------ |
| `NODE_ENV`               | `development` ou `test`                                            |
| `TOTEMOS_ENV`            | `demo` ou `test`                                                   |
| `DEMO_ENABLED`           | Exatamente `true`                                                  |
| `DEMO_DATABASE_ISOLATED` | Exatamente `true`, declaração de provisionamento de banco separado |
| `DEMO_ENVIRONMENT_ID`    | Identificador estável de 1 a 64 letras ASCII, dígitos, `_` ou `-`  |
| `DEMO_TENANT_IDS`        | UUIDs explícitos dos negócios de ensaio, separados por vírgula     |

`NODE_ENV=production`, `TOTEMOS_ENV=production`, `VERCEL_ENV=production` ou
`DEPLOYMENT_ENV=production` vetam DEMO, mesmo com as demais flags corretas.
Ausência, vazio e valores desconhecidos dos requisitos desabilitam o mecanismo.
NODE_ENV de produção também veta em previews: não habilitar a exceção para
contornar esse bloqueio. Não há flag controlada pelo app cliente.

O provisionamento deve apontar `DATABASE_URL`/`DIRECT_URL` para banco ou branch
PostgreSQL dedicado, com credenciais próprias e sem dados comerciais. O marcador
`DEMO_DATABASE_ISOLATED` é uma declaração de configuração, não uma prova técnica
de que o operador escolheu um banco isolado. A verificação de destino/segredos
e o provisionamento reproduzível pertencem ao #41; nunca copiar flags DEMO para
o ambiente operacional. Esta entrega não alterou o Neon ou flags de deploy.

Desabilitar configuração bloqueia novas ações e replay; não apaga histórico.
Habilitar depois não converte pedidos criados sem marca. Reinícios devem manter
o mesmo DEMO_ENVIRONMENT_ID para recuperar o ensaio anterior. Outro ID não pode
liberar pedidos desse ensaio. A criação continua disponível como antes quando
DEMO está desabilitado, com marca falsa e sem autorização operacional.

## Contrato HTTP

```http
POST /pedidos/11111111-1111-4111-8111-111111111111/liberacao-demo
Authorization: Bearer <jwt-humano-dono>
Idempotency-Key: 22222222-2222-4222-8222-222222222222
Content-Type: application/json

{"motivo":"Ensaio do atendimento","pin":"<quatro dígitos>","versaoEsperada":1}
```

```json
{
  "resultadoOperacao": { "tipo": "LIBERACAO_DEMO", "repetida": false },
  "pedido": {
    "id": "11111111-1111-4111-8111-111111111111",
    "status": "PENDENTE",
    "senha": null,
    "versao": 2,
    "demo": true,
    "demoAmbiente": "ensaio-local",
    "elegivelCozinha": true,
    "autorizacaoOperacional": { "tipo": "DEMO", "financeira": false }
  }
}
```

Preparo Zero termina PRONTO com versão incrementada duas vezes. Campos extras
são 400. Chave ausente/inválida ou UUID inválido: 400. Credencial inválida,
expirada/revogada ou PIN incorreto: 401. Perfil sem permissão, vínculo DONO
removido ou DEMO desabilitado: 403. Pedido inexistente/outro tenant: 404 uniforme.
Conflitos de pedido/conteúdo/versão: 409. Limite de cinco tentativas por minuto: 429. Falhas transitórias de persistência ou retry transacional esgotado: 503.
Erro de integridade inesperado é 500 com rollback, sem sucesso parcial.

O PIN é revalidado via bcrypt na própria ação. `{valido:true}` recebido do
cliente ou de uma validação anterior não concede permissão. O header
Idempotency-Key foi incluído na allowlist CORS existente para consumidores web.
Swagger/Scalar documenta o endpoint e respostas, sem expor PIN em retornos.

## Persistência, auditoria e concorrência

Migração `20261030010000_liberacao_operacional_demo` adiciona em Pedido:
`demo` (false por padrão), `demoAmbiente` nullable e `versao` (1 por padrão).
Registros existentes continuam sem marca e não são liberáveis por esta rota.
A migração não muda senhas, preços ou pagamentos. Aplicar ao destino revisado
antes de publicar o backend; não foi aplicada ao banco operacional nesta entrega.

`LiberacaoDemo` é a evidência persistida, única por pedido e por
`(negocioId, usuarioId, idempotencyKey)`. Guarda ambiente, ator, motivo,
hash SHA-256 de pedido/motivo normalizado/versão, versões anterior/liberada,
sequência de estados e instante do banco. Nunca grava PIN ou token. Não há rota
para editar/excluir marca ou auditoria. FKs RESTRICT impedem apagar pedido/ator/
negócio com auditoria sem tratamento explícito de retenção.

A transação bloqueia o usuário DONO pelo tenant, revalida vínculo e PIN,
bloqueia pedido por `(id, negocioId)`, verifica marca/financeiro/replay e faz
update condicional de estado/versão. Auditoria e atualização compartilham commit.
Mudar o papel do usuário concorre com o mesmo lock; revogação confirmada antes
da ação impede liberação. Commits anteriores não são revertidos retroativamente.

Mesma chave e conteúdo retornam uma só liberação e o estado atual, inclusive
após avanço/cancelamento legítimos. Outra chave para pedido já liberado: 409.
Mesma chave com outro conteúdo/pedido: 409. Chaves pertencem ao tenant/ator;
outro DONO não herda o replay, e outro tenant não lê o pedido. Dois DONOs
concorrentes têm um vencedor, sem duplicar liberação ou incrementar versão duas
vezes. Erros de serialização/deadlock têm até três tentativas com jitter.
Timeout de conexão/pool/transação resulta em 503 sem reexecução automática
incerta. O cliente preserva chave e payload, inclusive após resposta perdida.

## Testes e reprodução

Pré-requisito: PostgreSQL local dedicado chamado `totemos_demo_test`.
Os testes não usam DATABASE_URL operacional como fallback e recusam host
não local ou outro nome de banco. Configurar a conexão dedicada somente no
processo de teste:

```powershell
$env:DATABASE_URL='postgresql://postgres:test-only@127.0.0.1:5432/totemos_demo_test?schema=public'
$env:DIRECT_URL=$env:DATABASE_URL
$env:DEMO_TEST_DATABASE_URL=$env:DATABASE_URL
bunx prisma generate
bunx prisma migrate deploy
bun run test:demo:e2e
bun test
bun run lint
bun run build
```

Credenciais acima são ilustrativas do banco descartável. Não substituir por
credenciais de produção. A CI cria PostgreSQL dedicado, aplica migrações e roda
o mesmo comando, sem segredos operacionais. Os fixtures usam tokens/usuários
de teste e limpam somente os negócios que criaram.

TDD: política ausente falhou no RED. Caso de timeout do pool também falhou
antes do tratamento 503. E2E exercita API Fastify e PostgreSQL reais: snapshot,
Preparo Zero, replay, dois DONOs, outros tenants, produção/configuração ausente,
pedido real, permissões, token expirado/revogado, PIN, versão, campos extras,
financeiro vinculado, ambiente diferente, falha de auditoria com rollback,
recuperação por novo serviço/conexão e rate limit. Não simula cobrança real.

Validação local desta entrega: 93 testes unitários e 16 E2E aprovados;
lint sem erros/warnings, TypeScript completo, build e formatação aprovados.
Migrações aplicadas apenas no banco temporário PostgreSQL 18.6; comparação
do banco com schema Prisma sem diferenças. OpenAPI gerado com a rota, DTO,
Bearer e respostas esperadas. Dois fixtures preexistentes tiveram apenas seus
tipos corrigidos para permitir a checagem TypeScript completa também na CI.

## Limites atuais

A liberação autoriza a entrada do pedido DEMO na cozinha. O [contrato de fila,
transições e acompanhamento](transicoes-pedidos.md) descreve a leitura da fila
e os comandos de preparo e entrega, além da leitura restrita ao Totem criador.
O PAINEL solicita a [senha diária](senha-diaria-kds.md) em uma operação própria.

A autorização é operacional. O pedido DEMO segue identificado na fila e no
acompanhamento e fica fora do faturamento comercial. Pagamento financeiro,
cancelamento, estorno e venda offline exigem contratos próprios. A validação
de concorrência, tenant e replay está nas
[evidências do #39](../evidence/qa-concorrencia-tenants-idempotencia/README.md).
