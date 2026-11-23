# Evidência do recebimento local Totem → KDS

Teste físico executado em 21 de novembro de 2026 com dois Samsung Galaxy A54 conectados à mesma rede Wi-Fi:

- KDS: `RXCWC03JJ2K`, IP `192.168.15.3`.
- Totem: `RXCWC03SAVR`, IP `192.168.15.2`.
- Comunicação direta pela rede local, sem encaminhamento ADB entre os aparelhos.
- Health check do KDS em `http://192.168.15.3:43211/v1/health`, protocolo `totemos-offline`, versão 2.

## Fase offline

O Totem enviou um pedido de uma unidade de Makita, total de R$ 128, ao KDS enquanto o acesso à nuvem estava interrompido. A referência local exibida foi `D8037EEB`.

- [`totem-offline.png`](totem-offline.png): confirma o recebimento local e informa que o pedido ainda está fora da fila de preparo.
- [`kds-offline.png`](kds-offline.png): confirma um pedido armazenado na caixa local, sem senha e sem alteração dos contadores operacionais.

## Reconciliação

Após restaurar o acesso à nuvem, o KDS enviou `POST /pedidos/reconciliar` e recebeu HTTP 200. O registro saiu da caixa local. O Totem convergiu para a referência cloud `56D9B279`, com status aguardando autorização para preparo e sem senha atribuída.

As capturas registram a fase offline. A resposta HTTP e o estado reconciliado foram verificados durante o teste, mas não aparecem nestas imagens.
