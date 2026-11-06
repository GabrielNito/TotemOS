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
│   ├── page.tsx               — indicadores operacionais reais em Bento Grid
│   ├── pedidos/page.tsx       — consulta e histórico de pedidos reais, filtros e snapshots
│   ├── catalogo/page.tsx      — gestão de produtos, categorias, combos e preparo zero
│   ├── configuracao-inicial/page.tsx — diagnóstico guiado de primeira configuração
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

### Assistente de primeira configuração (#38)

`/admin/configuracao-inicial` tem acesso pela sidebar, sem redirecionamento
global obrigatório. Etapas: estabelecimento (sessão humana autenticada), catálogo
(`GET /catalogo/admin`), configurações operacionais (indisponíveis até #36/#37),
equipamentos (`GET /dispositivos`). Não duplica cadastros nem realiza mutações.

Catálogo pronto reutiliza `calcularDiagnosticoPublicacao`: pelo menos um produto
ativo e não esgotado em categoria ativa. Categoria vazia não conclui a etapa.
Equipamentos exigem TOTEM e PAINEL ativos com `revogadoEm === null`, sem inferir
heartbeat. Pareamento usa a página de dispositivos existente.

Progresso deriva das respostas atuais, com estados concluído, pendente,
indisponível, carregando e erro. A contagem inclui quatro etapas, sem percentual;
indisponibilidade de integração fica separada da pendência do operador.
Retomada e atualização manual reconsultam as fontes. Não persiste progresso,
códigos de pareamento ou navegação no navegador.

Consultas independentes com AbortController, timeout de 20 s, descarte por versão
e nova instância por identidade/token. 401 encerra a sessão; 401/403 invalidam
ambos os snapshots. Payload de outro tenant é rejeitado. Falha de uma fonte
mantém a outra válida e oferece nova tentativa, sem preservar confirmação antiga.
Sessão em validação bloqueia o assistente.

O adaptador em `lib/configuracao-inicial.ts` mantém configuração indisponível.
A integração futura deverá consumir e validar NegocioConfig persistido, sem
defaults ou estado da tela legada. Aceite integral depende de #36/#37 e #41.

### Componentes compartilhados

- `ChartSplineMetric`: Contagem de pedidos por props, curva Bézier, hover e seleção por teclado. Sem meta ou crescimento fictícios; vazio/indisponível explícitos.
- `ChartPillBars`: Gráfico em cápsulas verticais exibindo a distribuição de pedidos por hora e destaque do horário de pico.
- `InputOTP`: Campo de senha/PIN de 4 dígitos com máscara (`mask={true}`).

---

## 5. Regras Invioláveis do Negócio

- **Preço Snapshot**: Pedidos passados nunca recalculam valores a partir do catálogo atual (`precoNoMomento`).
- **PIN do Dono**: Operações sensíveis (cancelamentos, estornos e alterações cadastrais) exigem validação prévia do PIN de 4 dígitos.
- **Autoridade de Senha**: Senhas diárias sequenciais de pedidos pertencem ao Painel KDS.
- **Isolamento de Tenant**: Nenhuma mutação ou consulta pode ocorrer sem filtrar pelo `negocioId` autenticado.

## 6. Indicadores operacionais P0, card #35

Fonte autoritativa: lista completa de `GET /pedidos` do JWT humano DONO/GERENTE,
sem filtro de negócio fornecido pela UI. Resposta cruzada entre tenants é
rejeitada defensivamente. `GET /dispositivos` tem estado independente.
`/admin/pedidos` mantém seu contrato; `/admin/relatorios` permanece tela legada
estática fora deste card, com spline indisponível quando não recebe dados.

Agregação por **createdAt**, dias civis em **America/Sao_Paulo**, início inclusivo
e fim exclusivo. Dia atual; semana atual de segunda a domingo; mês atual;
ano atual. Interface mostra os limites e ancora calendário na última consulta
bem-sucedida. Senha/dataOperacional/dataSequencial são numeração do KDS,
updatedAt é modificação; nenhum deles define criação para estes indicadores.

Métrica | Regra
--- | ---
Registrados | Contagem não DEMO criada no intervalo, todos os status
Fila no período | PENDENTE, EM_PREPARO, PRONTO criados no intervalo; DEMO opt-in
Entregues | ENTREGUE não DEMO, não comprova receita
Aguardando liberação | AGUARDANDO_PAGAMENTO não DEMO, fora da fila
Cancelamentos | CANCELADO e CANCELADO_AGUARDANDO_ESTORNO, sem DEMO; não comprova estorno
Valor dos pedidos | Soma em centavos de valorTotal não DEMO, excluindo ambos os cancelamentos; inclui aguardando pagamento; nominal, não receita
DEMO | Contagem de todos os status e soma operacional excluindo cancelados, sempre separadas
Origem | TOTEM identificado por cadastro/relação, direta sem dispositivo, demais não identificadas como TOTEM; origemOffline histórico é subconjunto
Cadastro | Totais por TOTEM/PAINEL e ativos sem revogação vs revogados; nunca online
Picos | Contagem horária por createdAt, todos os status; empate pela hora mais cedo; barras apenas com registros
Spline | Contagem horária no dia, diária na semana/mês, mensal no ano. Lacunas entre primeiro/último bucket observado têm zero derivado da lista completa, sem projeções futuras

Filtro DEMO afeta apenas fila, origem e gráficos. Contadores comerciais e resumo
DEMO continuam separados. Vazio confirmado é zero de contagem; fonte ausente
é indisponível. Valores negativos, não finitos, precisão monetária inválida,
data inválida ou classificação DEMO ausente rejeitam a fonte.

Faturamento não é calculado: Point/webhook financeiro ainda não homologados.
Mesmo Pagamento APROVADO isolado não estabelece um contrato de relatório
financeiro por período, deduplicação e estornos. Tempo no Totem, tempo de preparo,
metas, comparações e presença online não possuem fontes válidas neste P0.

Atualização manual com timeout de 20 s, fontes independentes e versão de
requisição. Loading/erro/vazio/erro parcial não se confundem. Snapshot anterior
é marcado desatualizado durante refetch, falha ou após cinco minutos. 401/403
limpam ambas as fontes; troca de sessão/token descarta estado anterior.

Não há paginação/truncamento no findMany auditado; filtros atuais do endpoint
são por dataSequencial, portanto não podem limitar criação com segurança.
P0 consulta integralmente. Históricos grandes exigem revisão de agregação e
índice por Caio, com benchmark PostgreSQL e contrato explícito. Nenhum backend,
guard, migration ou pagamento foi alterado. Detalhes em
[evidências do card #35](evidence/dashboard-indicadores-reais/README.md).
