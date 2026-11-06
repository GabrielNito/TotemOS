# TotemOS Dashboard

## Visão geral operacional, card #35

`/admin` consulta `GET /pedidos` e `GET /dispositivos` com JWT humano
DONO/GERENTE. Escopo vem do servidor; não envia negocioId como filtro.
Agregações puras em `lib/indicadores.ts`; consultas independentes e proteção
contra respostas antigas em `lib/indicadores-consulta.ts`.

Dia, semana (segunda a domingo), mês e ano civis atuais usam **createdAt em
America/Sao_Paulo**, início inclusivo/fim exclusivo. Os intervalos ficam visíveis.
O período se refere ao snapshot da última consulta de pedidos bem-sucedida.
Filtros atuais do backend usam dataSequencial, portanto não filtram criação;
a visão geral usa a resposta completa. Não há polling; use Atualizar.

Valor dos pedidos é nominal, inclui aguardando pagamento e exclui DEMO e os
dois status de cancelamento. Não representa faturamento. DEMO e cancelamentos
têm contagem/valor separados. Gráficos contam registros, inclusive cancelados;
o checkbox inclui DEMO apenas em gráficos, origem e fila. A fila considera
status atuais dos pedidos criados no período, não o backlog global do KDS.

Faturamento, tempo de interação/preparo e conectividade permanecem indisponíveis.
Dispositivos ativos são apenas ativos no cadastro. Falhas não viram zeros;
snapshots antigos são sinalizados após falha, durante atualização ou após cinco
minutos sem consulta. 401/403 removem os snapshots; 401 oferece novo login.
Troca de identidade/token remonta a consulta sem reutilizar estado anterior.

Validação: `bun install`, `bun run lint`, `bun run typecheck`, `bun test`,
`bun run build`. Bun é o gerenciador deste app; o repositório ignora bun.lock,
por isso uma instalação limpa ainda não possui lockfile versionado.

Testes DOM usam happy-dom e React act, executados pelo Bun. Mocks de fetch
preservam a propriedade preconnect exigida pelos tipos atuais do Bun.

[Auditoria, definições, evidências e limites](../../docs/evidence/dashboard-indicadores-reais/README.md).

## Componentes

Next.js 16.2.6 com shadcn/ui. Consulte AGENTS.md e DESIGN.md antes de alterar.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
