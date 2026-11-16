# TotemOS

Plataforma de autoatendimento para estabelecimentos com Totem Android, painel de cozinha (KDS) Android, Dashboard web e API com PostgreSQL.

O fluxo online registra o pedido, acompanha a fila, atribui senha e registra preparo e entrega. Para exercitar o percurso completo, o P0 usa liberação DEMO auditada em ambiente isolado. A integração financeira com Mercado Pago Point e a venda offline seguem pendentes.

## Documentação

- [Estado atual e regras de negócio](docs/README.md) reúne os recursos por aplicação, os limites de homologação e as divergências que ainda precisam de decisão.
- [Backend](docs/backend-SPEC.md), [Totem](docs/totem-SPEC.md), [Painel KDS](docs/painel-SPEC.md) e [Dashboard](docs/dashboard-SPEC.md) descrevem os fluxos e APIs em uso.
- [Contribuição](CONTRIBUTING.md) e [regras do repositório](AGENTS.md) orientam mudanças no projeto.

## Executar localmente

O [guia de reprodução do P0](docs/guias/guia-reproducao-p0.md) cobre o roteiro DEMO com as quatro aplicações e PostgreSQL descartável.

| Aplicação | Diretório | Guia |
| --- | --- | --- |
| API NestJS e PostgreSQL | `apps/backend` | [Configuração, migrações e testes](apps/backend/README.md) |
| Dashboard Next.js | `apps/dashboard` | [Desenvolvimento web](apps/dashboard/README.md) |
| Totem React Native e Expo | `apps/totem` | [Development build e recuperação](apps/totem/README.md) |
| KDS React Native e Expo | `apps/kds` | [Development build e fila](apps/kds/README.md) |
