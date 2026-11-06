# Dashboard — SPEC

Aplicação web (Next.js 16, App Router, Turbopack) utilizada pelo dono e gerentes do negócio para gestão de catálogo, relatórios operacionais e financeiros, configurações do estabelecimento e pareamento de totens de autoatendimento e painéis KDS.

---

## 1. Stack Tecnológica & Padrões

- **Framework**: Next.js 16 (App Router com Turbopack)
- **Design System**: Shadcn UI + Tailwind CSS v4 (Diretrizes completas em [`apps/dashboard/DESIGN.md`](../apps/dashboard/DESIGN.md))
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
│   ├── pedidos/page.tsx       — consulta e histórico de pedidos reais, filtros e snapshots
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

### Histórico de pedidos, correção do card #34

`/admin/pedidos` é uma consulta somente leitura para JWT humano DONO/GERENTE.
Filtros `criadoEmInicio` e `criadoEmFim` são datas civis de **criação** em
America/Sao_Paulo, com início inclusivo e fim exclusivo. A interface mostra esses
limites; o backend aplica `createdAt >= inícioUTC AND createdAt < fimUTC`.
Não há uma segunda filtragem por data no navegador. A data operacional da senha
permanece separada, e senha null não é convertida em zero.

Lista, cadastro e detalhe têm estados independentes e gerações próprias.
Filtros novos descartam o snapshot da lista anterior; atualização manual pode
preservar o último snapshot com aviso explícito de desatualização. Erro de
cadastro limita a identificação da origem, mas não impede leitura de pedidos.
401/403 invalidam todas as fontes. Unmount, troca de identidade/token e fechamento
do detalhe cancelam requisições e descartam resultados antigos. Não há polling.

O card monetário mostra **valor nominal comercial**, incluindo aguardando
pagamento e excluindo DEMO e ambos os cancelamentos. Não comprova receita;
faturamento continua indisponível. `valorComercialConfirmado` permanece como campo
legado por compatibilidade, sem uso financeiro nesta tela. Novos campos de
`calcularMetricasPedidos` são aditivos; o trabalho paralelo do PR #23 não é
dependência desta correção. Busca aceita senha formatada, como `#014`.

Contrato backend, RED/GREEN e limites em
[evidências da correção](evidence/dashboard-pedidos-correcao/README.md).

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
