# Totem

Aplicativo de autoatendimento em React Native e Expo, com development build para Android. O fluxo conectado usa a API e guarda a sessão, o carrinho e a tentativa de pedido em SecureStore. [Executar no Android](../apps/totem/README.md) · [Parear](guias/mobile-pairing.md)

## Do catálogo ao pedido

1. O Totem valida o token e o tipo `TOTEM` em `GET /dispositivos/me`. A identidade fornece o negócio, a mensagem de boas-vindas e o modo de identificação.
2. A vitrine consulta `GET /catalogo/publico/:negocioId` e permite escolher variação, adicionais e quantidades dos produtos disponíveis. O carrinho mantém as escolhas após reabrir.
3. No checkout, `NOME` exige nome, `CODIGO` usa código gerado para a tentativa e `OPCIONAL` aceita nome ou código gerado. O backend trata os campos como opcionais. O checkout conectado envia itens, variações e adicionais, com os preços calculados no servidor. Combos configuráveis e observações livres ainda não integram esse envio.
4. Antes do `POST /pedidos`, o app persiste payload e chave idempotente. Um resultado incerto bloqueia outro pedido e permite retentar com o mesmo payload e a mesma chave. Depois do registro, o app valida o negócio e dispositivo criador antes de iniciar a leitura.

[Validação do catálogo ligado à API](historico/totem-catalogo-card.md) · [Criação de pedido](backend-SPEC.md#pedidos)

## Acompanhar e encerrar

O app usa `GET /pedidos/:id/acompanhamento`, restrito ao TOTEM criador. A API devolve status, total, versão, senha e data operacional quando atribuídas, além da marca DEMO e sua autorização operacional. A autorização da cozinha e a atribuição de senha ficam com o backend e o KDS.

| Estado | O que a tela informa ou permite |
| --- | --- |
| `AGUARDANDO_PAGAMENTO` | Pedido registrado e aguardando autorização para preparo. |
| `PENDENTE` | Liberado para cozinha. |
| `EM_PREPARO` | Pedido em preparação. |
| `PRONTO` | Retirada no balcão. Senha exibida quando atribuída. Preparo Zero pode chegar aqui logo após a liberação. |
| `ENTREGUE` | Entrega confirmada. Permite **Novo atendimento** após persistir a confirmação. |
| `CANCELADO_AGUARDANDO_ESTORNO`, `CANCELADO` | Exibe o estado e pede assistência. O Totem mantém a tentativa. |

- O acompanhamento consulta a cada 5 s em primeiro plano, com timeout de 20 s. Pausa em segundo plano, descarta versões antigas e preserva o último snapshot diante de falhas. Rede e 503 usam backoff. 429 respeita `Retry-After`. 401 volta ao pareamento com a tentativa preservada. 400, 403 e 404 interrompem a consulta automática e pedem revisão ou assistência.
- O último snapshot confirmado e a tentativa são restaurados ao reabrir, inclusive com catálogo indisponível. Uma falha de leitura ou persistência bloqueia o avanço até a recuperação.
- Ao iniciar novo atendimento, o app grava a marca durável de encerramento, limpa o carrinho e depois remove a tentativa. Uma falha parcial mantém o bloqueio e o reinício retoma a limpeza. O pareamento é preservado. Durante o acompanhamento, o standby manual volta ao mesmo pedido.

[Contrato de acompanhamento](contratos/transicoes-pedidos.md) · [Evidências de recuperação e encerramento](evidence/totem-acompanhamento/README.md)

## Android dedicado e prévia

- O desenvolvimento usa o app instalado com development build. Em Android, o app gerencia a navegação interna e detecta fixação de tela ou Lock Task. A fixação depende do operador. Lock Task e abertura gerenciada no boot dependem de um DPC autorizado e da política do aparelho. O #42 registrou Screen Pinning no Galaxy A54 e Lock Task em AVD com Test DPC. Resta validar o DPC operacional em aparelho dedicado. [Card #42](https://trello.com/c/BlKTMhV9) · [Runbook](evidence/totem-kiosk-recovery/README.md)
- `EXPO_PUBLIC_KIOSK_PREVIEW=1` abre a prévia Brioche com checkout simulado e armazenamento próprio. O fluxo de loja usa o catálogo do terminal pareado. [Auditoria visual](historico/totem-v2-visual-audit.md)

## Pendências

Cobrança Point, confirmação financeira, comprovante fiscal, impressão e venda offline seguem pendentes. O armazenamento local recupera uma tentativa do mesmo pedido para consultar ou reenviar via API. Operação LAN e sincronização de vendas são hipóteses futuras. [Estado do P0](README.md) · [Spike LAN](spikes/kds-local-network.md)
