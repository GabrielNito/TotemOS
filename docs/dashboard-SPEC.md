# Dashboard — SPEC

Aplicação web (Next.js 16, App Router, Turbopack) utilizada pelo dono e gerentes do negócio para gestão de catálogo, relatórios operacionais e financeiros, configurações do estabelecimento e pareamento de totens de autoatendimento e painéis KDS.

---

## 1. Stack Tecnológica & Padrões

- **Framework**: Next.js 16 (App Router com Turbopack)
- **Design System**: Shadcn UI + Tailwind CSS v4 (Diretrizes completas em [`apps/dashboard/DESIGN.md`](file:///c:/Users/Nito/www/TotemOS/apps/dashboard/DESIGN.md))
- **Layout Arquitetural**: Bento Grid modular fluido com cantos arredondados (`rounded-3xl`) e bordas sutis translúcidas (`border-border/40`)
- **Autenticação**: **JWT próprio via NestJS** com validação de schemas Zod, cookies HTTP (`totemos_token`), interceptor `proxy.ts` (Next.js 16) e controle de permissões por perfil (`DONO` vs `GERENTE`).
- **Validação de Ambiente**: Schema Zod em `lib/env.ts` com validação de `NEXT_PUBLIC_API_URL`.

---

## 2. Estrutura de Rotas

```
app/
├── (auth)/
│   ├── layout.tsx             — layout centralizado com logo e switcher de tema
│   └── login/page.tsx         — formulário de login (e-mail e senha)
├── registrar/
│   └── page.tsx               — onboarding multietapas (dados da loja, PIN, usuário dono)
├── admin/
│   ├── layout.tsx             — shell administrativo com Sidebar retrátil e Header
│   ├── page.tsx               — visão geral em Bento Grid (faturamento, KDS e hardware)
│   ├── catalogo/page.tsx      — gestão de produtos, categorias, combos e preparo zero
│   ├── relatorios/page.tsx    — faturamento consolidado, ticket médio e produtos campeões
│   ├── dispositivos/page.tsx  — emissão de código de pareamento e status de terminais
│   └── configuracoes/page.tsx — modo de identificação, offline, equipe e PIN do dono
└── proxy.ts                   — proteção e redirecionamento de rotas (Next.js 16)
```

---

## 3. Padrão de Integração e Consumo de Dados

- **Camada de API (`lib/api.ts`)**: Funções tipadas com tratamento centralizado de erros (`ApiError`), envio automático de Bearer Token e suporte a `NEXT_PUBLIC_API_URL`.
- **Modelos de Domínio (`lib/types/models.ts`)**: Tipos TypeScript sincronizados com o schema do Prisma (`Produto`, `Categoria`, `Dispositivo`, `Pedido`, `Usuario`, `DashboardMetrics`).
- **Feedback Visual**: Estados vazios (*Empty States*) nativos em todas as páginas para recepção assíncrona dos dados do backend.

---

## 4. Componentes Assinatura de UI

- `ChartSplineMetric`: Gráfico spline interativo em SVG com curva Bézier, acompanhamento de cursor, linha vertical tracejada, pílula de data ativa no eixo X e card de meta.
- `ChartPillBars`: Gráfico em cápsulas verticais exibindo a distribuição de pedidos por hora e destaque do horário de pico.
- `InputOTP`: Campo de senha/PIN de 4 dígitos com máscara (`mask={true}`).

---

## 5. Regras Invioláveis do Negócio

- **Preço Snapshot**: Pedidos passados nunca recalculam valores a partir do catálogo atual (`precoNoMomento`).
- **PIN do Dono**: Operações sensíveis (cancelamentos, estornos e alterações cadastrais) exigem validação prévia do PIN de 4 dígitos.
- **Autoridade de Senha**: Senhas diárias sequenciais de pedidos pertencem ao Painel KDS.
- **Isolamento de Tenant**: Nenhuma mutação ou consulta pode ocorrer sem filtrar pelo `negocioId` autenticado.
