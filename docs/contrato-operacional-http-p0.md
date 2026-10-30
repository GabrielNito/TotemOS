# Contratos HTTP operacionais P0, PROPOSTOS

Parte da [ADR 0001](adr/0001-contrato-operacional-p0.md), card
[#28](https://trello.com/c/T6hZ5Npz). Aguardam revisão do Caio.
Na entrega documental #28, nenhuma rota desta proposta foi criada. Os endpoints então existentes de pedidos
são `POST /pedidos`, `GET /pedidos`, `GET /pedidos/:id`, conforme o
[controller auditado](../apps/backend/src/pedidos/pedidos.controller.ts).

Atualização #29: `POST /pedidos/:id/liberacao-demo` foi implementado nesta branch,
conforme [contrato efetivo e configuração](liberacao-demo.md). As demais rotas
abaixo continuam propostas; acompanhar a evolução por card sem tratar exemplos
históricos como API entregue.

Atualização #30: PATCH de status, GET de fila e acompanhamento foram
implementados. O [contrato efetivo](transicoes-pedidos.md) prevalece sobre os
exemplos propostos abaixo: nova chave para estado já atingido retorna 409;
data operacional/numeração dependem do #31; autorização P0 é DEMO auditada.

## Convenções propostas

- HTTPS, JSON e `Authorization: Bearer <credencial>`. USER = JWT humano;
  DEVICE = deviceToken opaco, ativo e não revogado. Não permitir que payload
  transforme DEVICE em USER, TOTEM em PAINEL ou GERENTE em DONO.
- Tenant derivado da credencial, nunca recebido como fonte de autoridade no
  body/query. Consultas de pedido, operação idempotente e relações sempre
  incluem `negocioId`. ID inexistente ou não acessível retorna 404 uniforme.
- Mutações exigem `Idempotency-Key` UUID e payload estrito. Campos extras como
  `negocioId`, `senha`, `pago`, `aprovado` e `valorTotal` são rejeitados (400).
  Mesma chave com conteúdo/pedido diferente retorna 409. Replay autenticado da
  operação concluída retorna 200 e estado atual, sem novo efeito ou regressão.
- Hash/resultado idempotente não incluem PIN/token. Autenticar e verificar
  ambiente antes de recuperar replay. Escopo e retenção estão na ADR §6.
- `versao`, `demo`, `elegivelCozinha`, `autorizacaoOperacional`,
  `resultadoOperacao` e `dataOperacional` abaixo são campos de **DTO proposto**,
  sem afirmar sua existência no schema atual. Versão é contador monotônico
  persistente futuro. Valores financeiros são strings decimais BRL.
- Todas as mutações confirmam somente depois de commit com auditoria. Sem
  confirmação, cliente mantém a chave e exibe resultado incerto. 503 não prova
  ausência de commit: recuperar resultado pela mesma operação.
- Revalidar credencial/vínculo na transação e serializar com revogação conforme
  ADR §6; o guard atual sozinho não garante revogação durante uma mutação.

## Tabela de rotas sugeridas

| Método e rota PROPOSTOS            | Ator permitido                               | Entrada resumida                               | Sucesso                                          | Responsável futuro                |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ | --------------------------------- |
| `POST /pedidos/:id/liberacao-demo` | USER/DONO + PIN, ambiente/tenant DEMO        | motivo, PIN, versão esperada; chave no header  | 200, evidência e estado PENDENTE ou PRONTO       | #29                               |
| `PATCH /pedidos/:id/status`        | DEVICE/PAINEL ou USER/DONO/GERENTE explícito | status alvo e versão esperada; chave no header | 200, resultado e estado atual                    | #30                               |
| `POST /pedidos/:id/senha`          | Somente DEVICE/PAINEL                        | `{}`; chave no header                          | 200, mesma senha/data por pedido                 | #31                               |
| `GET /pedidos/:id/acompanhamento`  | Somente DEVICE/TOTEM que criou o pedido      | ID, sem body                                   | 200, projeção mínima do pedido próprio           | Proposto em #30, consumido em #33 |
| `GET /pedidos/fila`                | DEVICE/PAINEL ou USER/DONO/GERENTE           | Sem body; cursor/limite opcionais              | 200, apenas elegíveis PENDENTE/EM_PREPARO/PRONTO | #30                               |

`GET /pedidos/fila` é nova rota estática, diferente da antiga sugestão não
implementada `/pedidos/fila/:negocioId`. Deve preceder `GET /pedidos/:id` no
roteamento. Manter listagem administrativa existente separada da semântica de
fila; restringir DEVICE/PAINEL à elegibilidade no servidor em #30, inclusive
no GET genérico, impedindo bypass por filtro ausente ou status arbitrário.

## 1. Liberação DEMO

Exemplo de requisição, com IDs e credenciais ilustrativos:

```http
POST /pedidos/11111111-1111-4111-8111-111111111111/liberacao-demo
Authorization: Bearer <jwt-humano-dono>
Idempotency-Key: 22222222-2222-4222-8222-222222222222
Content-Type: application/json

{"motivo":"Ensaio do atendimento","pin":"<PIN do dono>","versaoEsperada":1}
```

`motivo`: texto não vazio até 255 caracteres; `pin`: quatro dígitos verificados
via bcrypt, nunca logados; `versaoEsperada`: inteiro positivo. O placeholder
do exemplo deve ser substituído por quatro dígitos na futura execução.

```json
{
  "resultadoOperacao": { "tipo": "LIBERACAO_DEMO", "repetida": false },
  "pedido": {
    "id": "11111111-1111-4111-8111-111111111111",
    "status": "PENDENTE",
    "senha": null,
    "versao": 2,
    "demo": true,
    "elegivelCozinha": true,
    "autorizacaoOperacional": { "tipo": "DEMO", "financeira": false }
  }
}
```

Se preparoZero, resposta inicial é PRONTO, com versão posterior às duas
transições. Não retorna recibo de aprovação nem insere Pagamento fictício.
Pedido deve ter marca DEMO imutável desde a criação, sem pagamentos vinculados,
estar AGUARDANDO_PAGAMENTO e pertencer ao tenant autenticado/allowlist do
servidor. Configuração ausente ou deploy produtivo veta a ação.

| HTTP | Condição proposta                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Liberação e auditoria confirmadas; ou replay da mesma operação, sem repetir efeitos.                                                     |
| 400  | ID/chave/DTO/PIN malformado ou campo extra.                                                                                              |
| 401  | JWT ausente, inválido, expirado; ou PIN incorreto.                                                                                       |
| 403  | GERENTE/DEVICE, usuário sem vínculo atual, ambiente/configuração desabilitados, tenant não autorizado para DEMO.                         |
| 404  | Pedido inexistente ou de outro tenant, sem revelar qual.                                                                                 |
| 409  | Versão divergente, pedido sem marca DEMO, financeiro vinculado, já liberado com outra chave, cancelado ou chave com conteúdo divergente. |
| 429  | Limite da ação sensível excedido; respeitar Retry-After.                                                                                 |
| 503  | Falha transitória de persistência/lock, sem sucesso presumido.                                                                           |

Concorrência: lock do pedido, autorização+status+auditoria+resultado no mesmo
commit. Dois DONOs com chaves distintas: um sucesso e um 409. Mesma chave:
um efeito, dois retornos idempotentes. Revalidar ambiente/autorização no replay;
PIN validado não é reaproveitado como booleano controlado pelo cliente.

## 2. Transições de preparo/entrega

```http
PATCH /pedidos/11111111-1111-4111-8111-111111111111/status
Authorization: Bearer <deviceToken-painel>
Idempotency-Key: 33333333-3333-4333-8333-333333333333
Content-Type: application/json

{"status":"EM_PREPARO","versaoEsperada":3}
```

```json
{
  "resultadoOperacao": { "tipo": "TRANSICAO", "repetida": false },
  "pedido": {
    "id": "11111111-1111-4111-8111-111111111111",
    "status": "EM_PREPARO",
    "senha": 12,
    "dataOperacional": "2026-10-29",
    "versao": 4,
    "demo": true,
    "elegivelCozinha": true
  }
}
```

Somente destinos EM_PREPARO, PRONTO e ENTREGUE neste endpoint P0. Origem e
pré-condições seguem a matriz da ADR §3. Não aceitar PENDENTE, liberação,
cancelamento ou estorno nesta rota. Preparo Zero é automático e não pode passar
por EM_PREPARO. Exigir senha antes de preparo/entrega; usuário humano não pode
fabricar senha por esta rota.

Validar tenant no SELECT/UPDATE e papéis explicitamente; o bypass USER atual
do DeviceTypeGuard sozinho não implementa essa política. Transação usa lock ou
compare-and-set de versão, status e elegibilidade com auditoria persistente.
Uma ação aceita incrementa versão uma vez. Duas ações com mesma versão e chaves
distintas têm um vencedor; perdedora recebe 409, inclusive se pretendia o mesmo
alvo. Uma ação com versão atual e status já igual pode retornar 200 sem efeito.
Replay da chave original retorna operação existente e estado atual mesmo se
o pedido já avançou para outro estado; não exigir versão antiga novamente.

HTTP: 200 sucesso/replay/no-op documentado; 400 formato ou destino fora do DTO;
401 credencial inválida/revogada; 403 TOTEM ou papel não permitido; 404 recurso
fora do escopo; 409 versão/origem inválida, sem autorização operacional, senha
ausente ou chave divergente; 429 limite global; 503 indisponibilidade transitória.
Receber 409 exige refetch; não mudar versão e reenviar ação cegamente.

## 3. Solicitação de senha pelo KDS

```http
POST /pedidos/11111111-1111-4111-8111-111111111111/senha
Authorization: Bearer <deviceToken-painel>
Idempotency-Key: 44444444-4444-4444-8444-444444444444
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
    "dataOperacional": "2026-10-29",
    "versao": 3,
    "demo": true
  }
}
```

Não recebe número, relógio/data, negócio ou versão esperada. Autoridade de
iniciar emissão pertence ao PAINEL; USER é 403 nesta proposta, mesmo DONO.
Backend valida `(negocioId,id)` e elegibilidade. Ainda sem senha e retido/cancelado: 409. Já numerado: devolver senha/data históricas sem incremento, inclusive
após entrega/cancelamento, para recuperar ação incerta. Isso não reativa pedido.

HTTP: 200 primeira emissão/replay/mesmo pedido numerado por outro KDS;
400 ID/chave/body inválidos ou campos extras; 401 token inválido/revogado;
403 TOTEM/USER; 404 outro tenant/inexistente; 409 inelegível sem senha ou chave
com outro pedido/conteúdo; 429 limite global; 503 retry transacional esgotado.

Consistência: algoritmo da ADR §5, índice composto existente preservado.
Dois KDS com chaves distintas para o mesmo pedido recebem a mesma senha.
Pedidos distintos não compartilham número no mesmo tenant/data. Restart e
resposta perdida são recuperados do PostgreSQL. Nenhum contador Android.

## 4. Consulta do Totem

```http
GET /pedidos/11111111-1111-4111-8111-111111111111/acompanhamento
Authorization: Bearer <deviceToken-totem-criador>
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "status": "PRONTO",
  "senha": 12,
  "dataOperacional": "2026-10-29",
  "valorTotal": "48.00",
  "versao": 5,
  "demo": true,
  "autorizacaoOperacional": { "tipo": "DEMO", "financeira": false }
}
```

Consulta exige `id`, `negocioId` da sessão e `dispositivoId = sub` do TOTEM
criador, na mesma busca. Pedido criado por USER, outro Totem ou novo dispositivo
após revogação não é automaticamente acessível; recuperação assistida fica para
contrato próprio. Não liberar o atual GET completo a todos os TOTEMs do tenant.
Não retornar nome/código do cliente, dados pessoais, IDs/credenciais financeiros
ou trilha interna. `valorTotal` vem do pedido persistido.

HTTP: 200 projeção atual; 400 ID inválido; 401 token inválido/revogado;
403 USER/PAINEL; 404 fora do tenant/dispositivo ou inexistente;
429 limite global; 503 indisponibilidade. Sem body e sem Idempotency-Key:
leitura não causa efeitos. Usar Cache-Control: no-store.

Leitura de snapshot confirmado, sem inventar estado a partir do cache do app.
Pode observar avanço no próximo polling. Senha NULL é válida antes da emissão,
inclusive após liberação. DEMO deve ser visível como demonstração, sem texto
“pago”. Estado financeiro verdadeiro dependerá de contrato P2, não desta flag.

## 5. Consulta de fila elegível

```http
GET /pedidos/fila?limite=50
Authorization: Bearer <deviceToken-painel>
```

```json
{
  "pedidos": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "status": "PENDENTE",
      "senha": null,
      "dataOperacional": null,
      "createdAt": "2026-10-29T22:00:00.000Z",
      "versao": 2,
      "demo": true,
      "preparoZero": false,
      "elegivelCozinha": true,
      "itens": [
        {
          "nomeProduto": "Lanche",
          "quantidade": 2,
          "variacaoNome": "Duplo",
          "observacao": null,
          "adicionais": [{ "nomeAdicional": "Queijo", "quantidade": 1 }]
        }
      ]
    }
  ],
  "proximoCursor": null
}
```

Sem corpo. `limite` inteiro de 1 a 100, padrão 50; cursor opaco validado e
vinculado ao tenant, ordenação estável por criação/ID. Cliente percorre páginas
e revalida desde a primeira em cada ciclo; não presumir snapshot entre páginas
enquanto a fila muda. Consulta não atribui senha nem inicia preparo.

Backend aplica tenant + autorização operacional + estados permitidos, mesmo
que cliente peça filtro incompatível. Proposta P0 não oferece filtro de status
nesta rota; parâmetros desconhecidos são 400. Incluir pedidos ainda abertos de
dias anteriores, sem restringir ao dia atual. Não retornar transações financeiras
ou aguardando pagamento; PRONTO com senha NULL continua elegível para #31.

HTTP: 200 lista inclusive vazia; 400 cursor/limite/query inválidos;
401 credencial inválida/revogada; 403 TOTEM/papel não permitido;
429 limite global; 503 indisponibilidade. Cache-Control: no-store.
Leitura não muda estado; um item pode ficar obsoleto logo após a resposta.
Versão nas mutações e refetch resolvem concorrência, conforme ADR §6.

## Compatibilidade e dependências de implementação

Não alterar silenciosamente o contrato de criação: hoje header idempotente é
opcional e replay continua HTTP 201. As exigências acima valem para novas
mutações. A futura correção da criação precisa documentar hash, corrida,
escopo de dispositivo e colisão global, sem se apoiar apenas nos mocks atuais.
O cliente atual aceita apenas `AGUARDANDO_PAGAMENTO`; #33 precisa ajustar essa
validação para recuperar criação já avançada após resposta perdida.

O [bootstrap atual](../apps/backend/src/main.ts) não inclui Idempotency-Key na
allowlist CORS. Se DONO operar pelo Dashboard web, #29/#30 devem permitir esse
header nas origens autorizadas; apps nativos não fazem preflight de navegador.
Isso é gap de implementação, sem alteração neste card.

Rotas de cancelamento/estorno, webhook, intenção de cobrança, reconciliação e
mesa não ganham contrato executável nesta entrega. Seus estados aparecem na
ADR para delimitar o ciclo completo e impedir atalhos nas rotas de preparo.
