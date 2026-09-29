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
