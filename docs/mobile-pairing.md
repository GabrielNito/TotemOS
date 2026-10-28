# Pareamento dos apps mobile

O Totem e o KDS usam o contrato de pareamento de dispositivos descrito em
[`device-pairing-contract.md`](./device-pairing-contract.md).

## Fluxo implementado

- A tela aceita somente um código numérico de seis dígitos.
- A ativação envia `{ codigo }` para `POST /dispositivos/parear/ativar`.
- O token retornado é persistido com `expo-secure-store` e nunca aparece na
  interface ou em logs.
- O cliente chama `GET /dispositivos/me` para confirmar o tipo e o
  `negocioId` atribuídos pelo backend.
- Um `401` durante a restauração remove o token e retorna à tela de
  pareamento. Um erro de rede preserva o token para uma nova tentativa.
- Após a confirmação, o Totem navega para `/catalogo` e o KDS para `/pedidos`.

## Configuração do dev client

Defina `EXPO_PUBLIC_API_URL` com uma URL acessível pelo aparelho Android antes
de iniciar o Metro. O cliente não recebe `negocioId` e não informa o tipo do
dispositivo na ativação.

## Validação em 28/10/2026

- Testes Jest: passou no Totem, 35 testes, e no KDS, 29 testes.
- Lint: passou nos dois apps, sem erros ou warnings.
- Typecheck: passou nos dois apps.
- Export Metro Android: passou nos dois apps.
- `expo-doctor`: reportou somente divergências de patch já existentes no
  bootstrap do Expo 57. O `expo-secure-store` do KDS está na versão esperada.
- Teste Android nativo com dev client: não executado nesta sessão. `adb
  devices -l` não listou aparelho nem emulador conectado. A instalação e a
  confirmação do fluxo em um Android físico continuam pendentes.
