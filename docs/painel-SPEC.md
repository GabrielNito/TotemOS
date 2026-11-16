# Painel KDS

Aplicativo Android em landscape para a cozinha e a retirada, feito com React Native e Expo. O P0 usa a fila da API e o PostgreSQL. [Execução e roteiro Android](../apps/kds/README.md)

## Fila e atendimento

1. O painel valida a credencial `PAINEL` em `GET /dispositivos/me`. O token fica no SecureStore. Uma resposta 401 remove a sessão e leva ao pareamento. [Pareamento mobile](guias/mobile-pairing.md)
2. O app consulta `GET /pedidos/fila`, pagina e deduplica por ID. A elegibilidade vem do backend. No P0, entram pedidos com liberação DEMO válida em `PENDENTE`, `EM_PREPARO` ou `PRONTO`. Os cards exibem itens, tempo decorrido, marca DEMO e senha/data quando atribuídas. Pedidos que chegam após a primeira carga recebem destaque. As faixas de espera são visuais e independentes do tempo padrão configurado no Dashboard. [Fila e transições](contratos/transicoes-pedidos.md)
3. Ao encontrar pedido sem senha, o KDS registra a chave da operação e solicita `POST /pedidos/:id/senha`. O PostgreSQL atribui um número atômico por negócio e dia civil em `America/Sao_Paulo`. Duas solicitações válidas para o mesmo pedido convergem para a mesma senha. [Contrato da senha](contratos/senha-diaria-kds.md)
4. Com a senha atribuída e a versão atual, o operador inicia preparo, marca pronto e confirma entrega via `PATCH /pedidos/:id/status`. Pedidos de Preparo Zero entram em `PRONTO` após liberação DEMO e seguem para entrega depois da numeração.

## Falhas e múltiplos painéis

- Polling em primeiro plano, com intervalo mínimo de 5 s e sem sobreposição. A fila retoma após retorno ao app. Erros mantêm o último estado visível com aviso de desatualização e bloqueiam ações dependentes da sincronização.
- Cada painel mantém um diário AsyncStorage por negócio e dispositivo. Versão esperada, destino e chave são persistidos antes de enviar. Resultado incerto usa o mesmo payload e chave, inclusive após reinício. Rede, 429 e 503 usam backoff com teto de 60 s e respeito a `Retry-After`. Após cinco falhas a retomada é manual.
- Em conflito de versão, o painel reconsulta e espera nova decisão do operador. Duas leituras completas são exigidas para retirar cards omitidos. Versões antigas são descartadas e confirmações anteriores evitam regressão. A paginação detecta divergências observáveis e o tempo de convergência depende de latência e retentativas.

[Comportamento e testes do #32](evidence/kds-resiliencia/README.md)

## Limites

As rotas web de pareamento e fila exibem orientação para Android. LAN usa apenas rotas diagnósticas de desenvolvimento. O spike testou componentes isolados e ficou inconclusivo para dois Androids entre si. Envio de pedidos offline, emissão local de senhas, cancelamento e estorno ficam pendentes. O laboratório registrou recuperação de rede e de processo em dois AVDs Android 16 com API real. O smoke em aparelho KDS ARM64 e o aceite do ambiente remoto ainda estão pendentes. [Spike LAN](spikes/kds-local-network.md) · [Card #40](https://trello.com/c/KTkrIl4Z) · [Card #41](https://trello.com/c/6JbgEgg4)
