# TotemOS — Plataforma B2B de Autoatendimento e Gestão de Pedidos

Plataforma B2B que permite a donos de pequenos negócios e eventos instalarem totens de autoatendimento integrados com painel de pedidos (KDS), maquininhas de cartão/Pix físicas e dashboard de gestão.

---

## 🏛️ Arquitetura e Módulos do Monorepo

O repositório está organizado nas seguintes frentes de desenvolvimento:

```
TotemOS/
├── AGENTS.md                  # Regras de negócio globais para desenvolvimento orientado a agentes
├── CONTRIBUTING.md            # Guia oficial de fluxo de trabalho (TDD, Git e Pull Requests)
├── .agents/                   # Regras e skills operacionais (db-setup, mercadopago-mock, etc.)
├── docs/                      # Especificações técnicas detalhadas de cada frente
│   ├── backend-SPEC.md
│   ├── totem-SPEC.md
│   ├── painel-SPEC.md
│   ├── dashboard-SPEC.md
│   └── arquitetura-tecnica-v1.md
├── apps/
│   ├── backend/               # Bun + NestJS + Fastify + Prisma + PostgreSQL
│   ├── dashboard/             # Next.js (App Router) — Gestão de catálogo, relatórios e dispositivos
│   ├── totem/                 # React Native (Expo dev client) + WatermelonDB — App do cliente no tablet
│   └── painel/                # React Native (Expo dev client) + Servidor local — Fila KDS da cozinha
```

---

## 🚀 Tecnologias Utilizadas

- **Backend Cloud**: Bun, NestJS, Fastify, Prisma ORM, PostgreSQL, Zod, `bun:test`.
- **Dashboard Web**: Next.js (App Router), React, Tailwind CSS.
- **Aplicativo Totem**: React Native, Expo (Development Client), WatermelonDB.
- **Painel de Pedidos (KDS)**: React Native, Expo, Servidor HTTP/WebSocket local (`react-native-nitro-http-server`).
- **Integração de Pagamento**: Mercado Pago Point API (maquininha física de cartão e Pix).

---

## 📖 Guias e Especificações

- Guia de Contribuição e TDD: [`CONTRIBUTING.md`](file:///c:/Users/Nito/www/TotemOS/CONTRIBUTING.md)
- Diretrizes Globais para Agentes AI: [`AGENTS.md`](file:///c:/Users/Nito/www/TotemOS/AGENTS.md)
- Arquitetura de Redes & Diagramas: [`docs/arquitetura-tecnica-v1.md`](file:///c:/Users/Nito/www/TotemOS/docs/arquitetura-tecnica-v1.md)
- Especificação do Backend: [`docs/backend-SPEC.md`](file:///c:/Users/Nito/www/TotemOS/docs/backend-SPEC.md)
- Especificação do Totem: [`docs/totem-SPEC.md`](file:///c:/Users/Nito/www/TotemOS/docs/totem-SPEC.md)
- Especificação do Painel: [`docs/painel-SPEC.md`](file:///c:/Users/Nito/www/TotemOS/docs/painel-SPEC.md)
- Especificação da Dashboard: [`docs/dashboard-SPEC.md`](file:///c:/Users/Nito/www/TotemOS/docs/dashboard-SPEC.md)
