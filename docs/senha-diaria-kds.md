# Senha diária única entre KDS, card #31

Implementação do [card #31](https://trello.com/c/oIgJMdHX) sobre develop em
`38417de84e7ce416a9aa0309fbf76d774ff65fc9`, merge do PR #16.
O PAINEL inicia a solicitação; o backend calcula e persiste o número.

## API efetiva

```http
POST /pedidos/11111111-1111-4111-8111-111111111111/senha
Authorization: Bearer <deviceToken-painel>
Idempotency-Key: 22222222-2222-4222-8222-222222222222
Content-Type: application/json

{}
```

```json
{
  "resultadoOperacao": { "tipo": "ATRIBUICAO_SENHA", "repetida": false },
  "pedido": {
    "id": "11111111-1111-4111-8111-111111111111",
    "status": "PENDENTE",
    "senha": 12,
    "dataOperacional": "2026-10-31",
    "versao": 3,
    "demo": true
  }
}
```

Somente DEVICE/PAINEL. TOTEM, DONO e GERENTE recebem 403. Token ausente,
inválido ou dispositivo revogado/inativo recebe 401. Tenant vem da identidade;
pedido inexistente ou estrangeiro retorna 404 uniforme. ID/chave inválidos,
body ausente ou qualquer campo extra recebem 400. Chaves UUID são normalizadas
para minúsculas. Escopo da chave: operação de senha + tenant + PAINEL.
Mesma chave/ator para outro pedido recebe 409, inclusive sob concorrência.

Primeira emissão exige PENDENTE, EM_PREPARO ou PRONTO e a política vigente do
#30: marca DEMO, ambiente/tenant habilitados, liberação auditada no mesmo
ambiente/tenant e ausência de tentativa financeira. Status sozinho não autoriza.
Pedido inelegível sem senha recebe 409. Preparo Zero já PRONTO também é numerado.
Nada nesta rota altera status, preços, total ou pagamentos.

Pedido numerado retorna o número/data existentes, inclusive ENTREGUE,
CANCELADO ou CANCELADO_AGUARDANDO_ESTORNO. Não altera contador, versão, status
ou instante da atribuição. Continua exigindo autenticação, tenant e a mesma
política DEMO, inclusive em replay. Desabilitar DEMO bloqueia a recuperação com
409 sem apagar fatos. Pagamentos e cancelamentos produtivos continuam futuros.

Replay retorna estado/versão atuais persistidos e `repetida:true`. Outra chave
para pedido numerado também retorna `repetida:true`, registrando essa recuperação
em auditoria, sem nova atribuição. Somente a primeira emissão incrementa versão.
O resultado lógico persistido inclui pedido, número/data e versões; não congela
um estado antigo. A retenção acompanha o histórico, sem expurgo automático.

O limite global existente aplica 429. Indisponibilidade de conexão/pool/transação
retorna 503, inclusive na autenticação de dispositivo. Resultado incerto exige
retry do cliente com a mesma chave. Erro de integridade inesperado continua 500
com rollback. A rota não acrescenta header Retry-After em 503; o cliente aplica
backoff e respeita o header quando presente, como no limite global.

## Transação e locks

Uma transação Prisma em READ COMMITTED, com maxWait de 5 s e timeout de 10 s:

1. Bloqueia Dispositivo por ID/tenant e revalida tipo PAINEL, ativo e revogação.
2. Serializa o escopo idempotente com advisory lock **transacional**, incluindo
   o nome da operação. Não depende de sessão persistente no pooler.
3. Bloqueia Pedido por ID/tenant; confere replay, autorização e senha anterior.
4. Se ainda sem senha, valida estado e consulta `clock_timestamp()` PostgreSQL
   após o lock. Converte o mesmo instante com `AT TIME ZONE 'America/Sao_Paulo'`.
5. Cria ContadorSenha com INSERT ON CONFLICT DO NOTHING, inicializado pelo maior
   número histórico do tenant/data, e bloqueia a linha do contador.
6. Incrementa `GREATEST(ultimoNumero, MAX histórico) + 1`, atualiza senha,
   dataSequencial, senhaAtribuidaEm e versão do pedido. O MAX é uma leitura;
   não bloqueia outras linhas de pedidos após obter o contador.
7. Grava AtribuicaoSenha, verifica novamente o ambiente e faz commit antes da
   resposta. Falha em qualquer escrita desfaz tudo.

A ordem credencial → chave → pedido → contador acompanha o #30. O lock da
credencial serializa solicitações do mesmo PAINEL e concorre com a revogação;
dois PAINÉIS continuam concorrentes. Revogação confirmada antes do lock veta a
ação. Revogação posterior aguarda o commit e não desfaz ações já confirmadas.
Nenhum lock atravessa requisições, e não há chamada externa na transação.

READ COMMITTED permite que a instrução após esperar o contador veja o histórico
confirmado por outro emissor. O UPSERT protege também a inexistência inicial da
linha. Índice único do Pedido `(negocioId, dataSequencial, senha)` permanece como
barreira adicional. Conflitos de serialização/deadlock conhecidos têm no máximo
três tentativas da transação inteira, preservando chave, com jitter de 10–40 ms.
Timeout/conexão com resultado incerto não são repetidos automaticamente.
Conflito inesperado de integridade não é mascarado nem corrige histórico sozinho.

## Modelo e período operacional

Migração `20261101010000_senha_diaria_kds`:

- Pedido.senhaAtribuidaEm: timestamptz(3) nullable, instante UTC da primeira emissão.
- ContadorSenha: PK `(negocioId, dataOperacional)`, ultimoNumero Int e FK RESTRICT
  para Negocio. Uma linha por dia civil e tenant, sem reset destrutivo.
- AtribuicaoSenha: tenant/pedido/PAINEL/chave, senha/data, versões anterior/nova,
  primeiraAtribuicao e createdAt timestamptz. Chave única por tenant/ator/UUID,
  índice para histórico e FK RESTRICT para Pedido. Não contém PIN ou token.

O dia é YYYY-MM-DD civil em America/Sao_Paulo, sem offset fixo, relógio Android
ou data UTC de criação. Sem histórico, começa em 1. Não usa módulo 999 e não
recicla números de cancelados. Não promete sequência sem lacunas. Usa Int do
PostgreSQL; não implementa numeração além de seu limite de 2.147.483.647 por dia.

Exemplo: criação 30/10 às 23:59 locais e emissão 31/10 às 00:01 usam 31/10.
Retry em 01/11 preserva 31/10 e o número. Pedidos abertos de datas anteriores
continuam na fila; exibir período com a senha quando houver ambiguidade.

dataSequencial continua provisoriamente UTC para pedidos sem senha. Somente a
primeira emissão a troca pelo dia operacional. Filtros legados por esse campo
consultam o valor persistido, não a data de criação. A fila não filtra por dia.
Fila, detalhe/lista PAINEL, transição e acompanhamento expõem dataOperacional:
NULL antes da emissão e dataSequencial depois. GET não atribui senha.

Não há backfill ou renumeração. Pedidos já numerados preservam sua data histórica
e podem ter senhaAtribuidaEm NULL, pois o instante original não é inferível.
Contadores são inicializados sob demanda a partir do histórico, incluindo
cancelados. A atualização também evita recuar abaixo do histórico existente.
Importações futuras precisam respeitar os mesmos locks/índices; não se autoriza
escrever números diretamente enquanto emissores operam.

## Concorrência e recuperação verificadas

| Cenário                                           | Resultado                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Dois PAINÉIS, mesmo pedido, chaves diferentes     | Uma atribuição/versão, mesma senha nos dois retornos                              |
| Pedidos distintos e contador inicialmente ausente | UPSERT/lock produzem números distintos                                            |
| Mesma chave/pedido simultâneos                    | Um efeito, replay 200                                                             |
| Mesma chave/ator em pedidos distintos             | Um sucesso e um 409                                                               |
| Outro tenant                                      | 404; sua sequência pode iniciar em 1                                              |
| Criação antes da virada, emissão depois           | Período da emissão; retry posterior preserva data/número                          |
| Preparo Zero                                      | PRONTO recebe senha e avança para ENTREGUE com versão atual                       |
| Auditoria rejeitada por constraint real           | HTTP 500; contador e pedido revertidos; mesma chave recupera após remover a falha |
| Conexão PostgreSQL indisponível                   | HTTP 503; sem efeito; cliente repete chave                                        |
| Reconexão do Prisma                               | Recupera resultado persistido, sem duplicar número                                |
| Revogação entre guard e transação                 | 401 antes da atribuição                                                           |

Testes novos: test/senha-pedido.spec.ts (Bun, falhas e limite de retry) e
test/senha.e2e-spec.ts (API Fastify/Jest e PostgreSQL reais). Nenhum mock substitui
locks/UPSERT nas corridas. Somente a fonte do instante é substituída nos casos de
virada, por consulta SQL com timestamptz conhecido e a mesma conversão IANA.
Não existe flag de relógio exposta em produção. Testes de falha de conexão usam
Prisma contra localhost em porta indisponível. Reinício de aplicativo inteiro
não é simulado; a reconexão real comprova recuperação fora da conexão anterior.

## Reprodução e evidências

Usar PostgreSQL **local descartável**, banco `totemos_demo_test`. A suíte recusa
outro host/nome e nunca usa DATABASE_URL operacional como fallback. As variáveis
DEMO são definidas apenas no processo de teste para tenants gerados pelos fixtures.
No diretório apps/backend, com credenciais próprias do banco isolado:

```powershell
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:25431/totemos_demo_test'
$env:DIRECT_URL=$env:DATABASE_URL
$env:DEMO_TEST_DATABASE_URL=$env:DATABASE_URL
bun install
bunx prisma generate
bunx prisma migrate deploy
bun test
bun run test:demo:e2e
bun run test:operacao:e2e
bun run test:senha:e2e
bun run lint
bunx tsc --noEmit
bun run build
bunx prisma validate
bunx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code
```

O exemplo sem senha presume autenticação trust restrita ao localhost no cluster
descartável. Nunca usar essa configuração em banco comercial. A CI fornece seu
próprio PostgreSQL e executa a suíte após aplicar migrações. Resultado local e
comandos de qualidade constam em [evidências](evidence/senha-diaria-kds/results.json).

## Divergências e pendências

Implementa a alternativa de contador recomendada na ADR §5. Acrescenta locks de
credencial/chave antes do pedido conforme #30 e explicita READ COMMITTED e o
bootstrap defensivo do histórico. Idempotência retorna estado atual, conforme
ADR §6, e audita novas chaves de recuperação sem incrementar a versão.

A regra global 4 historicamente diz que o KDS atribui e a cloud aceita números
locais. O card e a solicitação explícita do usuário autorizam este incremento
cloud-online: KDS inicia; backend calcula e persiste atomicamente. AGENTS.md tem
uma ressalva explícita, registrada também na matriz de divergências. A revisão
humana do Caio da redação normativa e da ADR ampla permanece necessária.
Esta entrega não representa aprovação de offline/LAN ou da ADR inteira.

Sem mudança de app React Native, pagamento, Point, servidor LAN, reconciliação,
deploy ou merge. Migrações anteriores e esta dependem de plano operacional e
banco DEMO isolado do #41. Nenhuma migração ou flag foi aplicada ao Neon comercial.
