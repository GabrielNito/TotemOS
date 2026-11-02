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

## Sincronização e recuperação (#32)

O controlador serializa leitura e comandos. Polling de 5 s começa pela primeira
página, percorre cursores até null, deduplica por ID/maior versão e publica somente
leituras completas. Há limite de 100 páginas e detecção de cursor repetido. Se o
mesmo pedido divergir entre páginas, refaz a leitura uma vez; persistindo a
inconsistência, mantém a última fila desatualizada para o próximo ciclo.

Não há snapshot transacional entre páginas. Um card conhecido ausente exige uma
segunda leitura completa. Remoção só ocorre quando ausente nas duas; não implica
ENTREGUE, pagamento ou qualquer conclusão inventada. Se as leituras divergem,
preserva a união pela maior versão e mantém stale até um ciclo consistente.
Falha na segunda leitura preserva integralmente os cards anteriores.
Versões observadas e confirmações ficam em memória durante a sessão, inclusive
após omissões. Resposta antiga não desfaz senha/status e entrega confirmada não
ressuscita por GET antigo. Uma regressão de versão mantém stale. Isso reduz
inconsistências detectáveis, mas não cria garantia de snapshot ou tempo real.

Fora de foco/background, aborta requests e ignora a publicação da geração antiga.
Ao voltar, agenda uma leitura assim que a geração anterior terminar, sem sobrepor
requisições. Confirmação tardia ainda é gravada no diário, sem anunciar sucesso na
tela suspensa. O timeout HTTP permanece 15 s. O próximo polling começa após o
ciclo anterior terminar; portanto 5 s é intervalo mínimo, não prazo de convergência.
A atualização manual respeita Retry-After/backoff. Última sincronização indica
leitura completa consistente, podendo ainda existir operação incerta sinalizada.

Senha NULL inicia solicitação automática serial, fora da renderização. UUID,
pedido, tipo, alvo/versão original, tentativas e nextAttempt são gravados antes
de transmitir. A versão de senha é metadado local; o POST continua enviando {}.
Registros antigos de senha sem versão continuam recuperáveis. Não há contador
local e a data operacional é sempre a persistida pelo servidor.

O diário AsyncStorage v1 usa negócio/dispositivo da credencial. Não inclui itens
ou segredos; deviceToken permanece no SecureStore. Valida UUIDs, metadados,
campos permitidos e duplicatas. Registro inválido bloqueia sincronização e não é
apagado ou substituído. Exige diagnóstico preservando o registro original, sem
botão de limpeza automática. Desinstalação/limpeza dos dados do Android elimina
o diário e não oferece recuperação local; não se promete durabilidade além das
garantias do AsyncStorage/SO. Um controlador ativo por sessão serializa save,
envio e remoção. Nenhuma nova intenção é enviada se a gravação falhar.

Timeout, DNS, interrupção, 429, 5xx ou confirmação inválida mantêm a identidade.
Backoff exponencial com jitter de 20%, início em 3,2–4,8 s e teto de 60 s;
Retry-After em segundos/data pode ampliar a espera. Após cinco falhas de uma
operação, pausa o envio automático. Polling de leitura continua quando permitido.
"Retomar recuperação" concede mais cinco tentativas com mesma chave/payload,
sem antecipar nextAttempt/Retry-After. Reinício mantém contagem/agendamento e
recupera pedidos fora da fila, inclusive ENTREGUE. Um GET bem-sucedido sozinho
não libera novas ações enquanto existir intenção incerta. A pausa por limite
sobrevive ao reinício pela contagem; o orçamento manual é por sessão.

| Situação | Política |
| --- | --- |
| 409 de uma primeira tentativa, versão/política DEMO | Não força versão nova. Refetch, aviso e nova decisão explícita após sincronizar. |
| 403/404/400/422 de primeira tentativa | Rejeição definitiva remove intenção somente após gravar resolução; refetch, sem sucesso falso. |
| Rejeição de replay incerto, inclusive diário restaurado com attempts=0 | Preserva UUID/payload, grava halted e pausa. Política pode estar bloqueando confirmação de um commit anterior. Retomada manual repete somente a identidade original. |
| Senha rejeitada definitivamente | Bloqueia emissão automática nessa versão. Nova versão remota comprovada libera o bloqueio; sem mudança, só o botão do operador inicia nova decisão. |
| Outro KDS já numerou | Backend retorna senha/data atuais, sem novo contador. |
| Outro KDS preparou/entregou | 409 reconsulta o estado atual, sem avanço automático; entrega confirmada sai da fila. |
| 401 | Encerra sessão, remove dados visíveis e conduz ao pareamento. Diário no escopo antigo é preservado; falhas temporárias não removem token. |

Preparar/entregar exige confirmação válida, seguida de reconciliação. Duplo toque
é bloqueado. Estados visuais: confirmado em verde; desatualizado em amarelo;
operação inicial em envio; recuperação com chave original; rejeição por pedido
com aviso sem modal. Recuperações fora da fila aparecem no aviso global. Uma
intenção incerta bloqueia ações globalmente nesta entrega conservadora. Não há
fallback fictício, suporte offline completo ou mutação financeira no KDS.

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
Resultados do #23 em ../../docs/evidence/kds-fila-operacional/README.md.
Auditoria, cenários e resultados do #32 em
[../../docs/evidence/kds-resiliencia/README.md](../../docs/evidence/kds-resiliencia/README.md).

## Roteiro para Android físico e API real

1. Provisionar e revisar o banco DEMO isolado conforme card #41. Aplicar nesse
   destino as migrações #29/#30/#31 e configurar o backend segundo docs/liberacao-demo.md.
2. Conectar dois Android, confirmar em adb devices, instalar development
   builds e parear dois PAINÉIS do mesmo negócio de ensaio.
3. Criar pedidos pelo Totem e liberar como DONO/PIN na API isolada. Incluir um
   pedido comum e um Preparo Zero. Confirmar DEMO, senha/data e snapshots na fila.
4. Executar preparo, pronto e entrega; verificar desaparecimento na fila. Fazer
   duplo toque, abrir outro PAINEL e provocar 409 sem avanço duplicado.
5. Desconectar a rede durante mutação, reiniciar o app, reconectar e verificar
   replay com mesma UUID. Revogar dispositivo e verificar retorno ao pareamento.
6. Colocar em background e retomar; conferir atualização sem alertar a fila inicial.

Nesta entrega #32, adb devices não encontrou aparelhos e não havia ambiente DEMO
isolado provisionado para homologação. Não foi usado Neon operacional, nem ativado
DEMO em produção.
Export não comprova instalação, teste físico ou funcionamento integrado real.

Fora do escopo: LAN, mDNS, WebSocket, offline completo, impressão, pagamentos,
cancelamento/estorno. #32 implementa resiliência online de múltiplos KDS;
#41 mantém provisionamento isolado e validação física/integrada operacional.
