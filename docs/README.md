# TotemOS: documentação

Plataforma de autoatendimento com backend, Totem, painel KDS e Dashboard.
Este índice distingue especificação, entrega comprovada e proposta de arquitetura.

## Contrato operacional P0, card #28

- [ADR 0001: produção, senha, pagamento e DEMO](adr/0001-contrato-operacional-p0.md), **PROPOSTA**, aguardando revisão do Caio.
- [Matriz de divergências e textos recomendados para aprovação](contrato-operacional-divergencias.md).
- [Contratos HTTP propostos, sem endpoints implementados neste card](contrato-operacional-http-p0.md).
- [Roadmap P0/P1/P2 e pós-MVP](https://trello.com/c/iKSJ1R4J).

P0 usa backend cloud e PostgreSQL. LAN permanece inconclusiva; DEMO é proposta
de liberação operacional em ambiente isolado, não aprovação financeira.
Point física, impressão e operação offline são pós-MVP.

## Especificações por aplicação

- [Backend](backend-SPEC.md): NestJS, Bun, Prisma, PostgreSQL; rotas existentes e futuras identificadas.
- [Totem](totem-SPEC.md): app React Native, catálogo e pedido real; limites do checkout.
- [Painel KDS](painel-SPEC.md): app React Native, fila planejada; hipótese LAN separada do P0.
- [Dashboard](dashboard-SPEC.md): gestão web; especificação não comprova entrega de todos os recursos.
- [Arquitetura histórica v1 e delimitação do roadmap](arquitetura-tecnica-v1.md).

## Entregas e experimentos documentados

- [Liberação operacional DEMO, implementação do card #29](liberacao-demo.md).

- [Contrato de pareamento backend](device-pairing-contract.md).
- [Pareamento mobile](mobile-pairing.md).
- [Catálogo conectado do Totem](totem-catalogo-card.md).
- [Criação de pedido real e limites do PR #13](totem-pedido-real.md).
- [Evidências do pedido real](evidence/totem-pedido-real/README.md).
- [Spike LAN #19, resultado INCONCLUSIVO](spikes/kds-local-network.md).

Os documentos históricos `regras-de-negocio-totem.md`, `stack-detalhada-v1.md`,
`backend-modelo-e-rotas.md` e `frontend-dashboard-nextjs.md` não existem na base
auditada em 29/10/2026. Não usar suas referências antigas como prova de contrato
ou de recurso implementado, nem inferir seu conteúdo.

Regras globais: [AGENTS.md](../AGENTS.md),
[backend](../.agents/rules/backend.md) e [contribuição](../CONTRIBUTING.md).
