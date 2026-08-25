# Totem — SPEC

App React Native cliente-facing. Roda em tablet exposto ao público. Catálogo, carrinho, pagamento, identificação do pedido.

Detalhe completo de arquitetura local e riscos técnicos: `docs/stack-detalhada-v1.md`. Regras de negócio: `docs/regras-de-negocio-totem.md`, seções 6 e 7.

## Stack

- React Native, **Expo com development client — não Expo Go** (WatermelonDB e kiosk mode exigem módulo nativo)
- Armazenamento local: **WatermelonDB** — mesma lógica de last-write-wins já usada no TravelHub (Dexie), aplicada aqui
- Testes: Jest (não `bun:test` — Bun não roda dentro do RN)

## Fluxos principais

1. Catálogo por categoria, respeitando `esgotado`
2. Produto com variação (seletor) e adicionais (checkbox com preço)
3. Combo: grupos de escolha, preço recalculado com deltas de upgrade
4. Observação em texto livre por item (sem lógica de preço)
5. Carrinho → identificação (nome ou código, conforme config do negócio; nome pode virar código se cliente não quiser informar) → pagamento via API Point
6. Confirmação: senha exibida de forma persistente + tempo estimado de preparo

## Regras que não podem ser esquecidas ao implementar

- Pagamento recusado: **carrinho persiste**, só a etapa de pagamento reseta.
- Sem opção de dinheiro físico — só cartão/débito/crédito/Pix via maquininha.
- Se o backend cloud não responder, o pedido deve ser guardado localmente (WatermelonDB) e enviado direto pro painel pela rede local — nunca bloquear a venda por falta de internet.
- Kiosk mode (Android Lock Task Mode) é o que impede o cliente de sair do app ou acessar configurações do sistema — não é cosmético, é exigência de produto. Ver `docs/stack-detalhada-v1.md`, seção 4.4.

## Pareamento (substitui login)

Não existe tela de login tradicional. Setup inicial: dono gera código na dashboard, digita/escaneia no totem, recebe token de longa duração vinculado ao `negocio_id`, guardado em armazenamento seguro do sistema (Keychain/Keystore). Esse token também identifica o totem na hora de achar o painel certo na rede local.

## Comunicação local com o painel

O totem é **cliente puro** — quem roda o servidor é o painel (ver `apps/painel/SPEC.md`). O totem precisa: descobrir o painel na rede local (mDNS, verificando `negocio_id` antes de aceitar conexão) e enviar o pedido via HTTP/WebSocket pro servidor local do painel.

## Ainda em validação (spike necessário)

Descoberta do painel via mDNS em ambiente com múltiplos negócios na mesma rede — ver `docs/stack-detalhada-v1.md`, seção 4.1.

## Fora de escopo (v1)

Planos, faixas de faturamento, fiscal/NFC-e, watchdog de reinício automático (fica pra v2+).
