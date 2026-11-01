# TotemOS KDS

Painel de cozinha Android em landscape, Expo SDK 57 / React Native / NativeWind.
Use development build. Expo Go não é ambiente suportado.

## Executar

```powershell
npm ci
$env:EXPO_PUBLIC_API_URL = "http://<ip-acessivel-do-backend>:3001"
# Opcional: intervalo em ms, mínimo 5000; padrão 5000.
$env:EXPO_PUBLIC_KDS_POLL_MS = "5000"
npm run android
# Em sessões seguintes, com o development build instalado:
npm run start
```

O Dashboard emite o código de pareamento de seis dígitos para um PAINEL.
O app persiste a credencial somente em expo-secure-store e valida a sessão em
GET /dispositivos/me antes de carregar a fila. Ausência/401 volta ao pareamento;
falha de rede preserva a credencial e oferece nova tentativa. Não há logout ou
configuração administrativa na tela compartilhada da cozinha.

## Interface e contratos reais

- Header: nome autenticado do dispositivo, sincronização, último sucesso e atualizar.
  A identidade atual não fornece nome do estabelecimento, portanto ele não é inferido.
- Colunas Pendentes / Em preparo / Prontos com contagem, listas virtualizadas,
  senha/data operacional, horário, duração decorrida, itens, variações, adicionais,
  escolhas e observações completas. DEMO aparece explicitamente.
- Pendente: iniciar preparo. Em preparo: marcar pronto. Pronto: confirmar entrega.
  Preparo Zero já chega PRONTO. Ações aguardam senha e versão confirmadas.
- Verde/amarelo/vermelho representam apenas faixas de espera da UI (10 e 20 min),
  centralizadas em src/queue/ui-config.ts. Não indicam SLA ou previsão de conclusão.
- Pedidos novos após o primeiro carregamento recebem destaque e contador até o
  operador reconhecer. A fila inicial não alerta; o mesmo ID não alerta de novo
  na sessão da tela. Alerta sonoro não foi incluído.

| Método | Rota                               | Conteúdo                                            |
| ------ | ---------------------------------- | --------------------------------------------------- |
| GET    | /dispositivos/me                   | Validação DEVICE/PAINEL                             |
| GET    | /pedidos/fila?limite=50&cursor=... | Fila elegível, nunca GET geral de pedidos           |
| POST   | /pedidos/:id/senha                 | Body {}, Idempotency-Key UUID                       |
| PATCH  | /pedidos/:id/status                | Body {status, versaoEsperada}, Idempotency-Key UUID |

Todas as chamadas autenticadas usam Bearer. Tenant vem da credencial, sem
negocioId no body/query. Nenhum token é mostrado, copiado ao diário ou registrado.
DTOs reais de fila/senha/transição são validados em src/queue/api.ts. Os retornos
não fornecem cliente, origem, preços ou ETA; a tela não inventa esses campos.

## Sincronização e recuperação

O controlador serializa leitura e comandos. Polling inicia pela primeira página,
percorre cursores até null, deduplica por ID escolhendo a maior versão e publica
somente o ciclo completo. Há limite de 100 páginas e detecção de cursor repetido;
erros preservam a última fila, sem publicar uma fila parcial como sincronizada.
Não existe snapshot entre páginas: alterações concorrentes podem aparecer no
próximo ciclo; toda mutação continua protegida pela versão esperada no servidor.

Polling é suspenso fora de foco/background, aborta requests e ignora respostas
antigas por geração. Retoma no retorno. A requisição HTTP tem timeout de 15 s;
novo ciclo é agendado após o anterior. Atualização manual respeita backoff e não
sobrepõe requisições. Último sucesso refere-se à leitura completa da fila.

Senha NULL inicia uma solicitação automática serial, fora da renderização.
Antes de qualquer mutação, UUID, pedido e payload são persistidos em AsyncStorage,
separados dos segredos e sob chave de negócio/dispositivo autenticados. A versão
retornada pelo POST é usada no próximo PATCH. Não existe contador local.

O diário guarda só operações pendentes, tentativas e instante da próxima tentativa.
Não persiste itens nem credenciais. Falha na gravação bloqueia o envio; diário
corrompido bloqueia sincronização em vez de descartar a UUID silenciosamente.
Timeout, rede, 5xx ou resposta inválida preservam intenção/chave, com backoff de
4 a 60 s; Retry-After em segundos ou HTTP-date pode ampliar a espera. 429 usa a
mesma política. Reinício recupera o payload original mesmo se ENTREGUE já saiu da
fila. Reconhecimento só remove a operação após resposta válida do servidor.

400/403/404/409 encerram a tentativa com mensagem segura e reconsulta da fila.
409 nunca troca a versão para repetir automaticamente. Uma senha rejeitada não
volta a ser solicitada automaticamente na mesma sessão; após reconsulta, o
operador pode solicitar novamente pelo botão. 401 encerra a sessão e limpa o token.
Preparar/entregar não muda a coluna otimisticamente: exige confirmação, seguida de
reconciliação. Duplo toque é bloqueado. Pedido entregue deixa a fila de abertos.
Em falha, dados ficam explicitamente desatualizados e ações ficam bloqueadas até
nova leitura confirmada. Não há fallback de pedidos fictícios.

## Arquitetura

- src/app/pedidos.tsx: composição e estados de sessão.
- src/queue/use-kitchen-queue.ts: sessão e ciclo foco/AppState.
- src/queue/controller.ts: fila, serialização, polling, alertas e recuperação.
- src/queue/api.ts e types.ts: contratos e validação das respostas.
- src/queue/storage.ts: diário persistente por tenant/dispositivo.
- src/queue/kitchen-board.tsx e order-card.tsx: interface touch.
- src/device-pairing/api.ts: transporte compartilhado, timeout e Retry-After.

AsyncStorage e expo-crypto foram instalados com expo install para SDK 57.
Referências consultadas: [SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Crypto](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/),
[AsyncStorage](https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/),
[Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/) e
[AppState](https://reactnative.dev/docs/0.86/appstate).

## Validação

```powershell
npm run lint
npm run typecheck
npm test -- --runInBand
npx expo export --platform android --output-dir dist/ci --clear --max-workers 2
```

A CI executa os mesmos comandos no job dedicado KDS, sem credenciais produtivas.
Testes Jest cobrem sessão, contratos, paginação, idempotência, recuperação,
transições, erros, foco/background do controlador e controles acessíveis do card.
Resultados e limites em ../../docs/evidence/kds-fila-operacional/README.md.

## Roteiro para Android físico e API real

1. Provisionar e revisar o banco DEMO isolado conforme card #41. Aplicar nesse
   destino as migrações #29/#30/#31 e configurar o backend segundo docs/liberacao-demo.md.
2. Conectar um Android por USB, confirmar em adb devices, instalar development
   build e parear um PAINEL do negócio de ensaio.
3. Criar pedidos pelo Totem e liberar como DONO/PIN na API isolada. Incluir um
   pedido comum e um Preparo Zero. Confirmar DEMO, senha/data e snapshots na fila.
4. Executar preparo, pronto e entrega; verificar desaparecimento na fila. Fazer
   duplo toque, abrir outro PAINEL e provocar 409 sem avanço duplicado.
5. Desconectar a rede durante mutação, reiniciar o app, reconectar e verificar
   replay com mesma UUID. Revogar dispositivo e verificar retorno ao pareamento.
6. Colocar em background e retomar; conferir atualização sem alertar a fila inicial.

Nesta entrega não havia aparelho no adb nem Docker daemon disponível para API
PostgreSQL local. Não foi usado Neon operacional, nem ativado DEMO em produção.
Export não comprova instalação, teste físico ou funcionamento integrado real.

Fora do escopo: LAN, mDNS, WebSocket, offline completo, impressão, pagamentos,
cancelamento/estorno. #32 mantém aprimoramentos avançados de múltiplos KDS;
#41 mantém provisionamento isolado e validação física/integrada operacional.
