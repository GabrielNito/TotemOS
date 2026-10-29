# Totem — SPEC

App React Native cliente-facing. Roda em tablet exposto ao público. Catálogo, carrinho, pagamento, identificação do pedido.

Estado auditado em 29/10/2026, base `ef20663`: catálogo, carrinho, identificação
e criação real estão conectados. O fluxo para em AGUARDANDO_PAGAMENTO, sem senha
ou cobrança. Ver [entrega do pedido real](totem-pedido-real.md) e
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
6. Estado atual conectado: AGUARDANDO_PAGAMENTO, senha NULL. Acompanhamento, senha e novo atendimento dependem do #33 e backend P0. Point física é pós-MVP; liberação DEMO é proposta restrita ao ambiente não produtivo, sem pagamento fictício.

## Regras que não podem ser esquecidas ao implementar

- Pagamento recusado: **carrinho persiste**, só a etapa de pagamento reseta.
- Sem opção de dinheiro físico — só cartão/débito/crédito/Pix via maquininha.
- Se o backend cloud não responder, preservar tentativa e carrinho; repetir a mesma chave/payload e bloquear nova venda enquanto o resultado for incerto. O P0 é cloud-online. Envio LAN, venda offline e reconciliação são hipóteses pós-MVP não validadas.
- Kiosk mode (Android Lock Task Mode) é requisito de produto futuro (#42); não inferir sua implementação a partir da interface de prévia.

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
