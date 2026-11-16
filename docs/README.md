# Estado atual do TotemOS

Revisão de 16/11/2026 sobre o código de `develop` no commit `49ec21d`. As tabelas descrevem o que está no repositório. A seção de validação indica quais cenários têm evidência de execução.

## Recursos por aplicação

| Área | Implementado | Limite atual |
| --- | --- | --- |
| Acesso e equipamentos | Cadastro de estabelecimento e DONO, login, verificação de PIN, pareamento de TOTEM e PAINEL por código de uso único, listagem e revogação. | Equipamento ativo indica cadastro válido. Heartbeat, gestão de equipe e alteração de PIN estão pendentes. [Pareamento](contratos/device-pairing-contract.md) |
| Catálogo | Dashboard administra categorias e produtos, adicionais, disponibilidade e tempo de preparo. O Totem exibe o catálogo público do negócio com variações e adicionais. | Combo configurável de ponta a ponta está pendente. O schema tem estruturas de combo e o backend grava deltas de escolhas recebidas. O editor administrativo ainda não cadastra variações. [Backend](backend-SPEC.md) · [Totem](totem-SPEC.md) |
| Configurações | DONO e GERENTE consultam. O DONO salva identificação, tempo padrão e mensagem de boas-vindas com PIN. O Totem aplica identificação e mensagem. | O tempo padrão é persistido e projetado pela API, mas o KDS usa suas próprias faixas de espera. Pagamento offline é forçado a desativado. [Contrato](contratos/configuracoes-estabelecimento.md) |
| Pedido no Totem | Carrinho, identificação, registro idempotente, recuperação da tentativa e acompanhamento por status e senha. Novo atendimento após entrega confirmada. | Cobrança, comprovante, impressão e fila de vendas offline estão pendentes. Cancelamentos exigem assistência no Totem. [Totem](totem-SPEC.md) |
| Liberação e pagamentos | Liberação DEMO auditada por DONO com PIN em ambiente isolado. A rota é da API. | A fila atual exige essa autorização DEMO. Point, webhook de confirmação, sandbox de pagamento, cancelamento e estorno ainda carecem de fluxo operacional. [DEMO](contratos/liberacao-demo.md) |
| Cozinha e retirada | Fila paginada, solicitação de senha, início de preparo, marcação de pronto e confirmação de entrega. Polling, recuperação de operações incertas e convergência entre KDS online. | A operação depende da API. LAN permanece um experimento inconclusivo. [KDS](painel-SPEC.md) |
| Gestão | Histórico somente leitura, filtros e detalhes do pedido, indicadores operacionais e assistente inicial conectado às APIs. | Relatórios financeiros são estáticos. A revisão das configurações no assistente segue pendente após salvar, pois o contrato não registra o aceite. [Dashboard](dashboard-SPEC.md) |
| Android dedicado e prévias | Totem recupera sessão e tentativa após reabertura. Lock Task depende de DPC autorizado. A prévia Brioche tem checkout simulado e armazenamento próprio. | Boot gerenciado depende do aparelho. A prévia tem escopo demonstrativo. [Operação Android](evidence/totem-kiosk-recovery/README.md) · [Auditoria visual](historico/totem-v2-visual-audit.md) |

O caminho hoje é **Dashboard cadastra e pareia → Totem registra → DONO libera via API DEMO → KDS solicita senha e confirma preparo/entrega → Totem acompanha → Dashboard consulta**. A API e o PostgreSQL centralizam o estado. A operação comercial depende da integração de pagamento.

## Regras de negócio no código

| Regra | Comportamento observado e decisões pendentes |
| --- | --- |
| Isolamento por `negocioId` | Leituras e mutações privadas usam o tenant da credencial. O catálogo público seleciona o tenant pelo caminho e expõe a vitrine publicada. Ativação por código e checagem de unicidade global da chave de criação são consultas transversais do código. Na checagem de chave, a API retorna conflito sem devolver o pedido de outro tenant. A consulta global de chave diverge da exigência literal de filtrar toda consulta pelo tenant em [AGENTS.md](../AGENTS.md). [Pareamento](contratos/device-pairing-contract.md) · [Criação de pedidos](../apps/backend/src/pedidos/pedidos.service.ts) |
| Snapshots | O backend calcula o total com o catálogo vigente na criação e grava `precoNoMomento` e `deltaNoMomento`. A leitura histórica usa os valores gravados. [Backend](backend-SPEC.md#pedidos) |
| Pagamento e DEMO | Todo pedido nasce `AGUARDANDO_PAGAMENTO` e com senha nula. A regra de produção exige confirmação legítima por webhook ou aceitação offline conforme contrato específico. A exceção implementada é DEMO, com auditoria e sem registro financeiro fictício. [Transições](contratos/transicoes-pedidos.md) · [DEMO](contratos/liberacao-demo.md) |
| Senha diária | A ressalva do #31 está no código. O KDS solicita e o PostgreSQL atribui atomicamente por negócio e dia civil de São Paulo. A autoridade local e a aceitação da senha na reconciliação continuam como direção futura. A redação da regra e a ADR ampla seguem sujeitas à revisão do Caio. [Senha](contratos/senha-diaria-kds.md) |
| PIN e permissões | Alterar configurações operacionais e liberar DEMO exige DONO e PIN verificado com bcrypt. O PIN também é requisito normativo para cancelamento e estorno, operações ainda pendentes. Pareamento e revogação exigem DONO. [Backend](backend-SPEC.md#identidades-e-acesso) |
| Preparo Zero | A criação grava a flag quando todos os produtos têm tempo zero. Ao liberar DEMO, a auditoria registra a passagem por `PENDENTE` e o pedido aparece em `PRONTO`. O KDS ainda solicita a senha antes da entrega. [DEMO](contratos/liberacao-demo.md) |
| Identificação do cliente | O Totem aplica `NOME`, `CODIGO` ou `OPCIONAL` no checkout e gera o código quando precisa. A API de criação aceita nome e código opcionais e atualmente não impõe o modo configurado. [Totem](totem-SPEC.md) · [DTO de criação](../apps/backend/src/pedidos/dto/criar-pedido.dto.ts) |

Também há uma divergência de configuração técnica. O código e o exemplo de ambiente usam `ALLOWED_ORIGINS` com origens padrão em produção. A regra interna pede `CORS_ALLOWED_ORIGINS` e configuração restritiva. O cabeçalho `Idempotency-Key` já está na lista permitida. [Backend](backend-SPEC.md#execução-e-configuração)

## Validação registrada

- O ensaio de primeiro uso de 15/11 registrou pedido, liberação DEMO, senha, transições e acompanhamento. O pareamento HTTPS sem USB foi relatado em rodada separada. [Evidências e matriz de versões](evidence/primeiro-uso-p0/README.md)
- A CI inclui testes e lint das quatro aplicações, export Android e testes E2E do backend em PostgreSQL isolado. As suítes cobrem criação, liberação DEMO, transições, senha, configurações, concorrência, tenant e idempotência. [CI](../.github/workflows/ci.yml) · [Resultados do #39](evidence/qa-concorrencia-tenants-idempotencia/README.md)
- O laboratório testou o Totem no Galaxy A54 em modo comum e Screen Pinning e exercitou Lock Task e reinício em AVD com Test DPC. Resta validar o DPC da operação em hardware dedicado. [Relato de 10/11 no card #42](https://trello.com/c/BlKTMhV9) · [Runbook do Totem](evidence/totem-kiosk-recovery/README.md)
- O #40 registrou o fluxo integrado com Totem no Galaxy A54, duas sessões web de KDS da rodada de laboratório, Dashboard e API real com PostgreSQL descartável. Dois KDS nativos passaram em ensaio separado com AVDs Android 16. O smoke ARM64 do KDS e o aceite do ambiente remoto isolado seguem pendentes. [Card #40](https://trello.com/c/KTkrIl4Z) · [Card #41](https://trello.com/c/6JbgEgg4)

## Onde consultar detalhes

- **Specs atuais** · [Backend](backend-SPEC.md) · [Totem](totem-SPEC.md) · [Painel KDS](painel-SPEC.md) · [Dashboard](dashboard-SPEC.md)
- **Contratos em uso** · [Pareamento](contratos/device-pairing-contract.md) · [Configurações](contratos/configuracoes-estabelecimento.md) · [Liberação DEMO](contratos/liberacao-demo.md) · [Fila, transições e acompanhamento](contratos/transicoes-pedidos.md) · [Senha diária](contratos/senha-diaria-kds.md)
- **Guias** · [Reprodução do fluxo DEMO](guias/guia-reproducao-p0.md) · [Desenvolvimento assistido por IA](guias/desenvolvimento-assistido-por-ia.md) · [Pareamento mobile](guias/mobile-pairing.md) · [Desenvolvimento local](../README.md#executar-localmente)
- **Decisões e experimentos** · [ADR 0001, proposta em revisão](adr/0001-contrato-operacional-p0.md) · [Spike LAN e seus resultados](spikes/kds-local-network.md) · [Roadmap](https://trello.com/c/iKSJ1R4J)
- **Referência histórica** · [Arquitetura v1](historico/arquitetura-tecnica-v1.md) · [Auditoria original de divergências](historico/contrato-operacional-divergencias.md) · [Proposta HTTP do #28](historico/contrato-operacional-http-p0.md) · [Entregas e auditorias anteriores](historico/) · [Evidências por card](evidence/)
