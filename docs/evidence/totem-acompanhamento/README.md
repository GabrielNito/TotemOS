# Acompanhamento do pedido, card #33

Card: https://trello.com/c/kuhb9Ehh. Base conferida após `git fetch origin`:
`8dc522d967295f9d9d4d95c7beb5636c927e8bb3`. Branch criada diretamente de
origin/develop: `feature/totem-acompanhamento-pedido`. Evidências locais
preexistentes em docs/evidence/totem-v2 foram preservadas e não integram este PR.

## IMPLEMENTADO

- HTTP: `POST /pedidos` com Bearer e Idempotency-Key existente; replay retorna o
  estado corrente, validado contra negócio e dispositivo autenticados.
  `GET /pedidos/:id/acompanhamento` com Bearer TOTEM, sem negocioId na URL/body,
  cache no-store, validação estrutural, erros tipados, AbortController e timeout.
  Nenhuma rota, migração ou alteração de backend foi necessária.
- DTO efetivo: id UUID, status conhecido, senha inteiro positivo/null,
  dataOperacional YYYY-MM-DD/null, versao inteiro positivo, demo boolean,
  demoAmbiente string/null, valorTotal decimal string,
  autorizacaoOperacional `{tipo:"DEMO", financeira:false}`/null.
  Projeção local remove campos adicionais, inclusive dados pessoais.
- Todos os sete estados reais, total da API e referência curta; senha nula sem
  substituto; senha ampliada em PRONTO e data operacional quando disponível.
  Preparo Zero avança diretamente a PRONTO. DEMO e liberação operacional são
  explícitos, sem aprovação financeira.
- Polling: 5 s após sucesso, pausa/background e retomada/foreground, requisições
  serializadas, gerações canceladas ignoradas. Backoff 10/20/40/60 s para falhas;
  Retry-After em segundos/data HTTP para 429, inclusive botão manual. 400/403/404
  param o polling automático e pedem assistência; 401 abre pareamento. Erros
  HTTP/rede não provam inexistência ou autorizam descarte. Snapshot preservado e
  sinalizado como desatualizado; versões antigas não regredem a tela.
- Recuperação: UUID/payload antes do POST, referência depois do POST e snapshot
  validado depois do GET. POST perdido repete chave/payload; replay avançado
  recupera ID e segue pelo GET. Leitura/conteúdo inválido bloqueia catálogo/envio
  sem sobrescrever o armazenamento. Falha na gravação inicial mantém a tentativa
  em memória e exige persistência antes de transmitir.
- Novo atendimento: somente ENTREGUE confirmado por GET e persistido. POST com
  ENTREGUE sozinho não basta. Cancelamentos/estorno ficam retidos para assistência.
  Marca durável `closing:true` precede limpeza do carrinho, que aguarda gravações
  antigas; a tentativa é removida por último. Falha mantém bloqueio, restore
  retoma antes de ler o carrinho. Nome/CPF, edição e avisos são removidos antes
  do próximo cliente. Pareamento não é limpo.
- Standby: acompanhamento visível durante inatividade. Standby manual não descarta
  pedido e retoma a mesma tela. Identificação em memória é limpa ao entrar em standby.
  Nenhuma modificação no checkout da prévia Brioche.

## TESTADO COM MOCKS

TDD com Jest. UI e hook usam React Native Testing Library; BusinessKiosk usa
também react-test-renderer existente. Timers falsos e promises controladas,
sem sleeps de rede. RNTL é dependência exclusiva de teste.

RED observado antes das respectivas correções:

| Cenário                                       | Falha observada                                                   |
| --------------------------------------------- | ----------------------------------------------------------------- |
| POST perdido/replay em seis estados avançados | validateResult rejeitava “Não foi possível confirmar o resultado” |
| HTTP e polling                                | Módulos order-tracking/order-tracking-api inexistentes            |
| Replay de outro dispositivo no mesmo negócio  | Promise resolveu com PRONTO em vez de rejeitar                    |
| Limpeza recuperável                           | clearBusinessCart não existia                                     |
| Tela conectada e novo atendimento             | Texto autorização/senha ausente, onNew não existia                |
| Falha na persistência inicial                 | attempt.key undefined em vez do UUID preservado                   |
| Tentativa salva estruturalmente inválida      | restore resolveu em vez de bloquear                               |
| Standby com pedido aberto                     | Overlay ainda presente após 60 segundos                           |

GREEN e regressões registrados nos logs de validação deste diretório.

Resultado local final em 02/11/2026: **193 testes em 34 suítes aprovados**.
`npm ci`, `npm run lint`, `bun run lint` e `npm run typecheck` com exit 0.
Lint sem erros ou warnings. Exportações Android conectado e prévia com exit 0.
Logs: [Jest](jest.txt), [lint](lint.txt), [TypeScript](typecheck.txt),
[instalação](npm-ci.txt), [Android conectado](export-android.txt) e
[Android prévia](export-android-preview.txt). Warnings de dependências no npm e
de reconstrução de cache Metro não são falhas de lint. Renderer de testes
fixado em 1.2.0, compatível com React 19.2.3, sem alterar o runtime do aplicativo.

| Critérios da tarefa                                                                  | Testes                                                     |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1, 14–17: autenticação, HTTP, token, Retry-After, indisponibilidade                  | order-tracking-api, use-order-tracking, order-tracking     |
| 2–10: autorização, DEMO, preparo/retirada/entrega, senha/data nullable, Preparo Zero | order-status, order-tracking                               |
| 11–13: versões, ciclo RN, rede, backoff, snapshot preservado                         | order-tracking, use-order-tracking                         |
| 18–21: resposta perdida, replay, reinícios confirmados/incertos                      | order-submission, business-kiosk                           |
| 22–24: terminal válido, limpeza interrompida, duplo toque, privacidade               | order-submission, cart-storage, business-kiosk             |
| 25–26: standby e prévia independente                                                 | business-kiosk e regressões kiosk/checkout/preview-session |

## TESTADO COM BACKEND REAL

Não executado nesta entrega. Nenhum ambiente DEMO isolado foi provisionado ou
ativado. Contrato auditado no código vigente, incluindo replay de PedidosService
e filtro ID/negócio/dispositivo de OperacaoPedidosService. Mocks não comprovam
integração cloud/KDS ou controles transacionais do servidor.

## TESTADO NO ANDROID

Exportação Metro/Hermes conectado/prévia: consultar resultados de validação.
Teste físico não executado: `adb devices -l` retornou lista vazia em 02/11/2026.
Exportar bundle não comprova homologação física nem build nativo de produção.

## PENDENTE

- #41: provisionar backend/banco DEMO isolados; repetir pedido real → liberação
  pelo DONO → senha pelo PAINEL → preparo → retirada → entrega no Totem.
- Android: interrupção/reabertura, rede, revogação/pareamento assistido,
  virada de dia, legibilidade/touch e retomada de limpeza interrompida.
- Token substituído por novo dispositivo: backend retorna 404 ao novo TOTEM.
  Pedido antigo não é descartado; transferência exige contrato próprio.
- Cancelamentos exigem política/recuperação administrativa antes de descarte local.
- Revisão humana e merge. Sem deploy, alteração de Neon ou merge automático.

## Reprodução

Em apps/totem:

```powershell
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
$env:EXPO_PUBLIC_KIOSK_PREVIEW='0'
npx expo export --platform android --output-dir dist/ci --clear --max-workers 2
$env:EXPO_PUBLIC_KIOSK_PREVIEW='1'
npx expo export --platform android --output-dir dist/ci-preview --clear --max-workers 2
```

A CI existente executa Totem conectado/prévia, KDS, backend/PostgreSQL isolado e
Dashboard. Resultado do PR acompanhado separadamente dos testes locais.
