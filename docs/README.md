# TotemOS: documentação

Plataforma de autoatendimento com backend, Totem, painel KDS e Dashboard.
Este índice distingue especificação, entrega comprovada e proposta de arquitetura.

- [Guia rápido de desenvolvimento e reprodução P0](guia-reproducao-p0.md).

## Contrato operacional P0, card #28

- [ADR 0001: produção, senha, pagamento e DEMO](adr/0001-contrato-operacional-p0.md), **PROPOSTA**, aguardando revisão do Caio.
- [Matriz de divergências e textos recomendados para aprovação](contrato-operacional-divergencias.md).
- [Proposta original de contratos HTTP do card #28](contrato-operacional-http-p0.md).
- [Roadmap P0/P1/P2 e pós-MVP](https://trello.com/c/iKSJ1R4J).

P0 usa backend cloud e PostgreSQL. LAN permanece inconclusiva. A liberação operacional DEMO foi implementada
no card #29 para ambientes isolados e não confirma pagamento.
Point física, impressão e operação offline são pós-MVP.

## Especificações por aplicação

- [Backend](backend-SPEC.md): NestJS, Bun, Prisma, PostgreSQL; rotas existentes e futuras identificadas.
- [Totem](totem-SPEC.md): app React Native, catálogo e pedido real; limites do checkout.
- [Painel KDS](painel-SPEC.md): app React Native, fila online/preparo/entrega (#23); hipótese LAN separada do P0.
- [Dashboard](dashboard-SPEC.md): gestão web; especificação não comprova entrega de todos os recursos.
- [Arquitetura histórica v1 e delimitação do roadmap](arquitetura-tecnica-v1.md).

## Entregas e experimentos documentados

- Configurações persistentes do estabelecimento e interface administrativa ([PR #28](https://github.com/GabrielNito/TotemOS/pull/28) e [PR #29](https://github.com/GabrielNito/TotemOS/pull/29)).
- Concorrência, tenants e idempotência em PostgreSQL ([PR #30](https://github.com/GabrielNito/TotemOS/pull/30)).

- [Liberação operacional DEMO, implementação do card #29](liberacao-demo.md).
- [Transições, fila elegível e acompanhamento, implementação do card #30](transicoes-pedidos.md).
- [Senha diária única entre KDS, implementação do card #31](senha-diaria-kds.md).
- [KDS operacional, uso e arquitetura do card #23](../apps/kds/README.md).
- [Validação e limites do KDS #23](evidence/kds-fila-operacional/README.md).

- [Contrato de pareamento backend](device-pairing-contract.md).
- [Pareamento mobile](mobile-pairing.md).
- [Catálogo conectado do Totem](totem-catalogo-card.md).
- [Criação de pedido real e limites do PR #13](totem-pedido-real.md).
- [Evidências do pedido real](evidence/totem-pedido-real/README.md).
- [Acompanhamento, recuperação e novo atendimento do Totem (#33)](evidence/totem-acompanhamento/README.md).
- [Spike LAN #19, resultado INCONCLUSIVO](spikes/kds-local-network.md).

Os documentos históricos `regras-de-negocio-totem.md`, `stack-detalhada-v1.md`,
`backend-modelo-e-rotas.md` e `frontend-dashboard-nextjs.md` não existem na base
auditada em 29/10/2026. Não usar suas referências antigas como prova de contrato
ou de recurso implementado, nem inferir seu conteúdo.

Regras globais: [AGENTS.md](../AGENTS.md),
[backend](../.agents/rules/backend.md) e [contribuição](../CONTRIBUTING.md).
