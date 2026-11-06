# TotemOS Dashboard

## Primeira configuração operacional, card #38

`/admin/configuracao-inicial`, acessível pela sidebar, reconhece a sessão
administrativa, o catálogo real e o cadastro de Totem/Painel KDS. Reutiliza
`GET /catalogo/admin` e `GET /dispositivos` com JWT humano, sem enviar negocioId.
Catálogo pronto exige produto ativo e não esgotado em categoria ativa, conforme
as regras compartilhadas da vitrine. Equipamentos exigem ao menos um TOTEM e
um PAINEL ativos e sem revogação. Cadastro não comprova conectividade.

Configurações operacionais ficam indisponíveis até os contratos dos cards
#36/#37. O assistente não aciona os salvamentos simulados da tela legada.
As quatro etapas distinguem conclusão, pendência, indisponibilidade, loading
e erro. O diagnóstico é reconsultado ao entrar e por atualização manual;
navegação local não conclui etapas. Não há progresso salvo no navegador.

Consultas independentes têm timeout de 20 segundos, AbortSignal, descarte de
respostas antigas e reinício por identidade/token. 401 encerra a sessão;
401/403 removem ambas as fontes. A sessão em validação não mostra dados em cache.

[Critérios, TDD, capturas de teste e limites de homologação](../../docs/evidence/dashboard-primeira-configuracao/README.md).

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
