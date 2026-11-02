# TotemOS Totem

Aplicativo mobile de autoatendimento do TotemOS. Esta base usa Expo Router e development builds para Android. Expo Go não é ambiente de desenvolvimento suportado.

## Uso local

```bash
npm ci
npm run android
```

`npm run android` gera e instala o development build em um emulador ou dispositivo Android disponível, e inicia o Metro. Em sessões posteriores, com o development build já instalado, inicie apenas o Metro com:

```bash
npm run start
```

## Validação

```bash
npm run lint
npm run typecheck
npx expo-doctor
```

A suíte Jest cobre catálogo, carrinho, pareamento, criação e acompanhamento de pedidos, além da prévia independente.

## Pareamento

Na primeira abertura, o Totem consulta o `deviceToken` guardado no
`expo-secure-store`. Se não houver token, ou se o backend responder `401` em
`GET /dispositivos/me`, a tela solicita o código de seis dígitos emitido pelo
Dashboard. O cliente envia somente `{ codigo }`, grava o token retornado no
armazenamento seguro e confirma a identidade pelo endpoint `/dispositivos/me`.

Para testar em um aparelho Android conectado à mesma rede do backend, informe
a URL acessível pelo aparelho antes de iniciar o Metro:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://<ip-do-computador>:3001"
npx expo start --dev-client
```

O token nunca é exibido na interface ou escrito em logs. O `negocioId` e o
tipo do dispositivo vêm exclusivamente da resposta autenticada do backend.

## Acompanhamento conectado, card #33

Depois de `POST /pedidos`, o fluxo BusinessKiosk consulta exclusivamente
`GET /pedidos/:id/acompanhamento`. A prévia Brioche continua simulada e independente.
Status, total, senha e data operacional vêm do backend. DEMO identifica autorização
operacional de demonstração, sem confirmação financeira ou recibo.

Polling a cada 5 segundos em foreground, sem sobreposição, com timeout GET de
20 segundos, cancelamento, backoff e respeito a Retry-After. Falhas preservam
o snapshot e exibem a última sincronização. Versões antigas não regredem a tela.
401 encaminha ao pareamento; 400/403/404 pedem assistência sem descartar o pedido.

A tentativa idempotente é persistida antes da transmissão. Um POST incerto só é
recuperado com a mesma chave e payload. Replay pode retornar qualquer estado válido,
mas exige o mesmo negócio e dispositivo; segue-se pelo GET restrito. Referência e
último snapshot são recuperados após reinício. Dados inválidos ou erro de leitura
do SecureStore bloqueiam o envio até recuperação segura.

Somente ENTREGUE confirmado pelo acompanhamento permite **Novo atendimento**.
Cancelamentos e espera de estorno ficam bloqueados para assistência. O encerramento
grava uma marca durável na tentativa, aguarda gravações antigas do carrinho, limpa
o carrinho e só então remove a tentativa. Falhas mantêm o bloqueio; um reinício
retoma a limpeza. Nome, CPF, edição e avisos são removidos antes de liberar o
catálogo, mantendo o pareamento.

Durante acompanhamento, a inatividade não esconde automaticamente o pedido.
Standby manual preserva a tentativa e retorna à mesma tela; entrar em standby
limpa a identificação em memória. Não existe descarte por timeout ou 404.

Detalhes e limites: [evidências do #33](../../docs/evidence/totem-acompanhamento/README.md).
