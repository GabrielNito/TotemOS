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

Ainda não há testes de produto neste bootstrap. Eles serão adicionados junto das primeiras regras de negócio.

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
