# Dashboard — SPEC

App web (Next.js, App Router) usado pelo dono do negócio: gestão de catálogo, relatórios, configuração, gestão de dispositivos pareados.

Detalhe completo de rotas e componentes: `docs/frontend-dashboard-nextjs.md`. Rotas de backend consumidas: `docs/backend-modelo-e-rotas.md`, seção 2.

## Stack

- Next.js, App Router
- Server Components para leitura, Server Actions para mutação (ver padrão de data fetching abaixo)
- Autenticação: **em aberto** — Firebase Auth vs. JWT próprio via NestJS (`docs/stack-detalhada-v1.md`, seção 4.3). A estrutura de rotas funciona com qualquer uma das duas.

## Estrutura de rotas

```
(auth)/login
(dashboard)/
  page.tsx                 — visão geral
  catalogo/{produtos,categorias,combos}
  relatorios/
  dispositivos/
  configuracoes/
middleware.ts               — protege o grupo (dashboard)
```

## Padrão de data fetching

- Leitura: Server Components, fetch direto pro backend a partir do servidor.
- Mutação: Server Actions + `revalidatePath`.
- Exceção: toggle de esgotado precisa de feedback otimista (`useOptimistic`) — é usado no meio de operação real, sem tempo pra round-trip completo.
- Gráficos de relatório: Client Component, recebendo dado já buscado no server como prop.

## Componentes principais

`ProdutoForm`, `ProdutoTable` (com toggle otimista), `VariacaoEditor`, `AdicionalEditor`, `ComboForm`, `GrupoDeEscolhaEditor` (o mais complexo — grupos de escolha com delta de preço), `RelatorioFaturamentoChart`, `RelatorioMaisVendidosTable`, `DispositivoPareamentoModal`, `DispositivoTable`, `ConfiguracaoForm`.

## Regras que não podem ser esquecidas ao implementar

- Modo de identificação (nome/código) e política de pagamento offline são configuração **por negócio**, editadas em `configuracoes/`.
- Combo tem preço fixo definido pelo dono — o formulário não deve somar automaticamente os preços das partes.
- Geração de código de pareamento (`dispositivos/`) é o único jeito de um totem/painel novo entrar no sistema — não existe tela de "criar dispositivo" direto no app mobile.

## Fora de escopo (v1)

Planos, faixas de faturamento, cobrança do lojista, fiscal/NFC-e. Ver `docs/arquitetura-tecnica-v1.md`.
