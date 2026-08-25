# [Nome do projeto a definir] — Plataforma de Totens de Autoatendimento

Plataforma B2B que permite donos de pequenos negócios adicionarem totens de autoatendimento aos próprios negócios, com painel de pedidos e dashboard de gestão. Origem, mercado e regras de negócio completas em `docs/regras-de-negocio-totem.md`.

## Estrutura do repositório

```
apps/
├── backend/     — NestJS + Bun + Prisma + PostgreSQL. O motor: negócio, catálogo, pedido, pagamento.
├── dashboard/   — Next.js. Gestão de catálogo, relatórios, configuração, dispositivos.
├── totem/       — React Native. App cliente-facing: catálogo, carrinho, pagamento.
└── painel/      — React Native. App da equipe: fila de pedidos, e também roda o servidor local.

docs/            — documentos de planejamento completos (mover pra cá ao montar o repo):
├── regras-de-negocio-totem.md   — plano de negócio completo, origem, mercado, todas as regras
├── arquitetura-tecnica-v1.md    — escopo da v1 e visão geral de arquitetura
├── stack-detalhada-v1.md        — decisões de stack aprofundadas, com riscos e achados de pesquisa
├── backend-modelo-e-rotas.md    — schema Prisma completo e lista de rotas
└── frontend-dashboard-nextjs.md — estrutura de rotas e componentes da dashboard
```

## Por onde começar

Cada `apps/*/SPEC.md` é o ponto de entrada de cada frente — autocontido o suficiente pra trabalhar naquela parte sem precisar ler os cinco documentos de `docs/` inteiros, com link pra eles quando precisar de mais profundidade.

Ordem de construção sugerida (detalhe em `docs/arquitetura-tecnica-v1.md`, seção 1):
1. `apps/backend` — motor e modelo de dados
2. `apps/totem` — fluxo de pedido + pagamento (primeiro "uau" da demonstração)
3. `apps/painel` — fila em tempo real (segundo "uau")
4. `apps/dashboard` — gestão de catálogo e relatórios

## Escopo da v1

Não entra: planos/faturamento de cobrança do lojista, fiscal/NFC-e, aquisição de clientes. Detalhe completo em `docs/arquitetura-tecnica-v1.md`.

## Stack

Bun · NestJS + Fastify · Prisma · PostgreSQL · Zod · React Native (Expo, dev client) · WatermelonDB · Next.js (App Router) · Mercado Pago Point API

## Pré-requisitos de setup (não é Expo Go)

Totem e painel exigem Expo com **development client** (não Expo Go) — WatermelonDB e kiosk mode dependem de módulos nativos que o Expo Go não suporta. Detalhe em `docs/stack-detalhada-v1.md`.
