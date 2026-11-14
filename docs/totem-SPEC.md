# Totem — SPEC

App React Native cliente-facing. Roda em tablet exposto ao público. Catálogo, carrinho, pagamento, identificação do pedido.

Atualização #33 em 02/11/2026, base `8dc522d`: catálogo, carrinho, identificação,
criação real e acompanhamento estão conectados. Senha e status vêm do backend,
sem cobrança implementada no Totem. Ver [entrega do pedido real](totem-pedido-real.md) e
[ADR operacional P0, PROPOSTA](adr/0001-contrato-operacional-p0.md).
Os documentos históricos `stack-detalhada-v1.md` e `regras-de-negocio-totem.md`
não existem nesta base e não comprovam implementação.

## Stack

- React Native, **Expo com development client — não Expo Go** (WatermelonDB e kiosk mode exigem módulo nativo)
- Carrinho e tentativa de pedido reais usam SecureStore. WatermelonDB/sincronização offline são planejamento futuro; last-write-wins não é contrato para pagamento/status/senha.
- Testes: Jest (não `bun:test` — Bun não roda dentro do RN)

## Fluxos principais

1. Catálogo por categoria, respeitando `esgotado`
2. Produto com variação (seletor) e adicionais (checkbox com preço)
3. Combo: grupos/deltas são planejamento; não há fluxo conectado completo de combos entregue no PR #13.
4. Observação em texto livre por item (sem lógica de preço)
5. Carrinho → identificação → `POST /pedidos` com deviceToken TOTEM, referências/quantidades e chave idempotente persistida. Backend calcula snapshots e total.
6. Acompanhamento conectado: status, total e senha/data operacional confirmados pelo backend. Somente ENTREGUE confirmado permite novo atendimento. Point física é pós-MVP; DEMO permanece sem pagamento fictício.

## Acompanhamento e encerramento P0 (#33)

O fluxo real (`src/catalogo/business-kiosk.tsx`) recupera replays do POST com
estado corrente e valida negócio e dispositivo criador. Depois consulta somente
`GET /pedidos/:id/acompanhamento` com deviceToken TOTEM revalidado por
`restoreDeviceSession({ expectedDeviceType: "TOTEM" })`. Não envia negocioId como
autorização. O backend filtra pedido, negócio e dispositivo.

Projeção: id, status, senha nullable, dataOperacional nullable, versao, demo,
demoAmbiente nullable, valorTotal decimal string e autorizacaoOperacional
DEMO/financeira:false ou null. Não fornece itens, nome, previsão, cobrança Point
ou confirmação financeira. A tela não usa o carrinho como resposta do acompanhamento.

| Estado recebido              | Apresentação e política                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| AGUARDANDO_PAGAMENTO         | Registrado, aguardando autorização para preparo, sem afirmar cobrança ou entrada na cozinha |
| PENDENTE                     | Autorizado para cozinha, aguardando início do preparo                                       |
| EM_PREPARO                   | Em preparação, senha/data quando atribuídas                                                 |
| PRONTO                       | Retirada no balcão, senha em destaque, sem inventar número se null                          |
| ENTREGUE                     | Entrega confirmada, permite Novo atendimento                                                |
| CANCELADO_AGUARDANDO_ESTORNO | Estorno não confirmado, assistência obrigatória                                             |
| CANCELADO                    | Cancelamento confirmado, sem inferir devolução, assistência obrigatória                     |

Preparo Zero pode saltar diretamente para PRONTO, sem estados intermediários
fabricados. DEMO permanece explícita; liberação operacional não representa
quitação financeira. O Totem não libera DEMO, não atribui senha nem altera status.

Polling em foreground a cada 5 s após sucesso, sem sobreposição. Pausa e aborta
no background, retoma ao voltar, ignora gerações antigas e versões inferiores.
Timeout do transporte GET: 20 s. Rede/503 usam backoff 10/20/40/60 s;
429 respeita Retry-After em segundos ou data HTTP, inclusive na atualização manual.
400/403/404 interrompem repetição automática e permitem consulta manual/assistência.
401 encaminha ao pareamento preservando a tentativa. Falhas preservam o último
snapshot e o sinalizam como desatualizado. ENTREGUE persistido encerra o polling.

SecureStore conserva UUID/payload antes do POST, referência e último snapshot
validado. Falha de persistência bloqueia publicação de novo snapshot/encerramento.
POST incerto permite repetição manual com a mesma chave e payload. Leitura
inválida/indisponível de tentativa ou carrinho bloqueia nova venda.

Encerramento exclusivo de ENTREGUE confirmado via GET e persistido. Marca
`closing:true` durável antecede limpeza serializada do carrinho; só após sucesso
remove-se a tentativa. Reinício com marca retoma a mesma rotina antes de carregar
o carrinho. Duplo toque é bloqueado. Falha parcial não libera o catálogo. Novo
atendimento limpa carrinho, nome/CPF em memória, edição e avisos, mantendo token.
Cancelamentos não possuem descarte autônomo neste P0; não há ação administrativa
ou endpoint de reset no Totem.

Durante acompanhamento não há standby automático; o manual retorna ao mesmo
pedido. Entrar em standby remove identificação em memória. A prévia Brioche
(`src/kiosk/kiosk-screen.tsx`) permanece isolada.

[Evidências e limites do #33](evidence/totem-acompanhamento/README.md).
O [card #40](https://trello.com/c/KTkrIl4Z) registra o ensaio local com API real,
PostgreSQL descartável e Galaxy A54. O [card #42](https://trello.com/c/BlKTMhV9)
registra Screen Pinning no aparelho e Lock Task em AVD gerenciado. O aceite em
hardware operacional depende do aparelho e do DPC da operação.

## Regras que não podem ser esquecidas ao implementar

- Pagamento recusado: **carrinho persiste**, só a etapa de pagamento reseta.
- Sem opção de dinheiro físico — só cartão/débito/crédito/Pix via maquininha.
- Se o backend cloud não responder, preservar tentativa e carrinho; repetir a mesma chave/payload e bloquear nova venda enquanto o resultado for incerto. O P0 é cloud-online. Envio LAN, venda offline e reconciliação são hipóteses pós-MVP não validadas.
- No Android real, o #42 protege a navegação interna e confirma o modo do sistema. Lock Task exige autorização por DPC. Screen Pinning é escolhido pelo operador no Android e admite saída pelo sistema. A prévia não solicita modo nativo. A recuperação de tentativa pode começar antes da resposta do catálogo. [Operação e suporte](evidence/totem-kiosk-recovery/README.md).

## Pareamento (substitui login)

Setup implementado: dono gera código na dashboard; o app ativa o código e
persiste deviceToken em armazenamento seguro. A identidade validada no backend
fornece tenant e tipo do dispositivo. Ver [pareamento mobile](mobile-pairing.md).
Descoberta/autenticação produtiva LAN continuam futuras.

## Comunicação local com o painel, hipótese pós-MVP

Não usada no P0. O [spike #19](spikes/kds-local-network.md) é INCONCLUSIVO e
diagnóstico; não transporta pedidos nem implementa autenticação produtiva.

Na hipótese histórica, Totem seria cliente do servidor local do painel
([SPEC do KDS](painel-SPEC.md)), descoberto por mDNS. Transporte de pedidos por
HTTP/WebSocket e autenticação de tenant precisam de validação e contrato próprios;
comparar `negocio_id` enviado pelo cliente não basta.

## Ainda em validação (spike necessário)

Descoberta mDNS, HTTP/WS e recuperação entre dois Androids, conforme relatório
do spike citado acima. Não presumir aprovação pela existência das bibliotecas.

## Fora de escopo (v1)

Planos, faixas de faturamento, fiscal/NFC-e, watchdog de reinício automático (fica pra v2+).
