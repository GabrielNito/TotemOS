# Dashboard

Aplicação administrativa em Next.js App Router com shadcn/ui e Tailwind. Usa JWT humano do backend e protege a navegação administrativa em `proxy.ts`. DONO e GERENTE compartilham leitura e gestão do catálogo. Algumas ações exigem DONO ou PIN. [Executar localmente](../apps/dashboard/README.md) · [Diretrizes visuais](../apps/dashboard/DESIGN.md)

## Rotas e capacidades

| Rota | Estado atual |
| --- | --- |
| `/registrar`, `/login` | Cadastro do estabelecimento com usuário DONO e PIN, autenticação humana. |
| `/admin` | Indicadores operacionais da listagem completa de pedidos e do cadastro de dispositivos. |
| `/admin/pedidos` | Histórico somente leitura com filtros, busca e detalhe de itens e preços em snapshot. |
| `/admin/catalogo` | Gestão de categorias, produtos, adicionais, disponibilidade, visibilidade e tempo de preparo. Cadastro de variações e gestão de combos ainda estão pendentes. |
| `/admin/dispositivos` | Lista equipamentos do negócio. O DONO gera códigos e revoga tokens. Cadastro ativo indica terminal pareado e sem revogação. |
| `/admin/configuracoes` | Leitura de configurações persistidas para ambos os perfis. Edição por DONO com PIN. A aba Equipe mostra o usuário da sessão. A alteração de PIN permanece indisponível. |
| `/admin/configuracao-inicial` | Assistente com diagnóstico real do estabelecimento, catálogo, equipamentos e configurações operacionais. |
| `/admin/relatorios` | Interface estática. Faturamento, ticket médio, participação de pagamentos, ranking, filtro e exportação ainda carecem de integração. |

A liberação DEMO existe na API. O histórico web consulta o estado dos pedidos. Cancelamento e estorno seguem pendentes. [Rotas do backend](backend-SPEC.md#rotas-em-uso)

## Histórico de pedidos

`GET /pedidos` e `GET /pedidos/:id` usam o tenant da sessão humana. A busca da interface aceita senha formatada, como `#014`. Os filtros de criação enviam `criadoEmInicio` e `criadoEmFim` e usam o dia civil de `America/Sao_Paulo`, com início inclusivo e fim exclusivo. A data operacional da senha tem campo próprio. Senha nula é exibida como ainda indisponível.

Lista, cadastro de dispositivos e detalhe têm estados independentes e descartam respostas antigas. Falha de cadastro pode limitar a identificação da origem. Atualização manual pode preservar o último resultado como desatualizado. 401/403 invalidam as fontes. A tela não usa polling.

O valor nominal considera os snapshots persistidos, inclui aguardando pagamento e exclui DEMO e ambos os cancelamentos. [Contrato de filtros e evidências](evidence/dashboard-pedidos-correcao/README.md)

## Indicadores operacionais

A visão geral agrega por `createdAt` em `America/Sao_Paulo`, com períodos de dia, semana iniciada na segunda-feira, mês e ano civis. O último carregamento bem-sucedido ancora o calendário. A API oferece filtro por criação, mas esta tela carrega a lista inteira. O histórico humano ainda não é paginado.

| Métrica | Regra |
| --- | --- |
| Registrados | Pedidos comerciais criados no período, com qualquer status. |
| Fila no período | `PENDENTE`, `EM_PREPARO` e `PRONTO` criados no intervalo. |
| Entregues | `ENTREGUE` comercial. |
| Aguardando liberação e cancelamentos | Contagens comerciais por estado. Inclui ambos os estados de cancelamento na contagem correspondente. |
| Valor dos pedidos | Soma nominal em centavos. Inclui aguardando pagamento, exclui DEMO e cancelados. |
| DEMO | Contagem separada de pedidos e valor operacional, com cancelados excluídos do valor. |
| Origem e dispositivos | Classificação por cadastro e vínculo do pedido. Ativo/revogado descreve cadastro. |
| Gráficos | Distribuição horária e tendência por hora, dia ou mês conforme o período. O filtro DEMO altera gráficos, origem e fila. |

Os indicadores distinguem erro, ausência de fonte, vazio confirmado e snapshot antigo. O carregamento manual usa fontes independentes e timeout de 20 s, com invalidação em 401/403. Faturamento, conectividade, tempo de interação e tempo medido de preparo permanecem indisponíveis. [Fórmulas e verificações](evidence/dashboard-indicadores-reais/README.md)

## Configurações e primeira operação

- `/admin/configuracoes` consulta e salva via `/negocio/config`. DONO com PIN ajusta modo de identificação, tempo padrão de 1 a 120 min e mensagem de até 200 caracteres. O GERENTE avalia os valores em leitura. Pagamento offline aparece desativado e equipe fica limitada ao usuário da sessão. [Contrato](contratos/configuracoes-estabelecimento.md) · [Evidências da tela](evidence/dashboard-configuracoes-operacionais/README.md)
- O assistente abre pela sidebar e consulta catálogo, dispositivos e configurações. Catálogo pronto exige produto ativo e disponível em categoria ativa. Equipamentos prontos exigem um TOTEM e um PAINEL válidos. O assistente direciona para as telas que salvam os dados. A etapa operacional mostra **Revisão pendente** mesmo depois de salvar, pois falta um aceite persistido. As consultas descartam respostas antigas e invalidam os dados em 401/403. [Critérios](evidence/dashboard-primeira-configuracao/README.md) · [Ensaio com API e banco isolado](evidence/dashboard-primeira-configuracao/integracao-configuracao.md)
