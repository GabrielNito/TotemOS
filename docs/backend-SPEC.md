# Backend

A API NestJS usa Fastify, Bun, Prisma e PostgreSQL. O [schema Prisma](../apps/backend/prisma/schema.prisma) define o modelo vigente. [Migrations](../apps/backend/prisma/migrations/) registram as mudanças aplicadas pela CLI. A instância em execução serve OpenAPI em `/swagger-json` e Scalar em `/reference`.

## Identidades e acesso

- Sessões humanas usam JWT. As rotas administrativas de catálogo e histórico permitem DONO e GERENTE. Cadastro e login são públicos.
- Dispositivos usam token opaco de longa duração, armazenado no servidor como HMAC. A credencial resolve o tipo e o tenant. O TOTEM cria e acompanha seus pedidos. O PAINEL consulta a fila, solicita a senha e executa transições.
- O catálogo público usa o identificador do negócio da URL. Cadastro inicial, ativação por código e unicidade transversal de chaves têm escopos próprios. O [quadro de regras](README.md#regras-de-negócio-no-código) registra o ponto em aberto sobre isolamento.
- Configurações operacionais e liberação DEMO checam o PIN de quatro dígitos do DONO com bcrypt no servidor. A verificação avulsa de PIN em `/auth/validar-pin` confirma o `negocioId` solicitado contra o JWT. Ela não emite credencial para mutações posteriores.

## Rotas em uso

| Método e rota | Acesso e comportamento |
| --- | --- |
| `GET /` | Pública. Resposta simples da aplicação. |
| `POST /auth/registrar`, `POST /auth/login` | Públicas. Registro de negócio com DONO e autenticação humana. |
| `GET /auth/me`, `POST /auth/validar-pin` | JWT humano. Perfil e verificação avulsa de PIN. `GET /auth/admin-only` exige DONO. |
| `POST /dispositivos/parear/codigo`, `DELETE /dispositivos/:id` | DONO. Gera código e revoga token. |
| `POST /dispositivos/parear/ativar`, `GET /dispositivos/me` | Ativação pública limitada por tentativa. A consulta exige token ativo e retorna identidade e projeção de configuração. |
| `GET /dispositivos` | DONO ou GERENTE. Lista o cadastro do próprio negócio. |
| `GET /negocio/config`, `PATCH /negocio/config` | DONO ou GERENTE na leitura. DONO com PIN na escrita. Alias `/configuracoes` para ambos os métodos. |
| `GET /catalogo/publico/:negocioId` | Pública. Categorias ativas com produtos ativos e disponíveis. |
| `GET /catalogo/admin` | DONO ou GERENTE. Inclui categorias vazias e itens inativos ou esgotados. |
| `POST /catalogo/categorias`, `PUT /catalogo/categorias/:id` | DONO ou GERENTE. Cria e edita categorias, incluindo ativação. |
| `POST /catalogo/produtos`, `PUT /catalogo/produtos/:id`, `DELETE /catalogo/produtos/:id` | DONO ou GERENTE. Cria, edita e desativa produtos. |
| `POST /pedidos` | JWT humano ou TOTEM. Cria pedido com preços calculados pelo servidor. |
| `GET /pedidos`, `GET /pedidos/:id` | DONO ou GERENTE para histórico completo. PAINEL recebe a projeção operacional limitada à fila elegível. |
| `GET /pedidos/fila` | PAINEL, DONO ou GERENTE. Fila elegível paginada por criação e ID. |
| `GET /pedidos/:id/acompanhamento` | TOTEM criador. Projeção mínima, com status, senha e versão. |
| `POST /pedidos/:id/senha` | PAINEL. Solicita a senha atômica por negócio e data operacional. |
| `PATCH /pedidos/:id/status` | PAINEL, DONO ou GERENTE. Transições de preparo e entrega. |
| `POST /pedidos/:id/liberacao-demo` | DONO com PIN. Liberação auditada, somente para pedidos DEMO elegíveis. |

O [controller de pedidos](../apps/backend/src/pedidos/pedidos.controller.ts) e os contratos abaixo detalham os códigos de erro e formatos.

## Pedidos

- **Criação.** O [DTO](../apps/backend/src/pedidos/dto/criar-pedido.dto.ts) aceita referências do catálogo, quantidades, variação, adicionais, escolhas e identificação opcional. A API rejeita preços/status enviados no corpo. O backend valida disponibilidade de produto, variação e adicional, calcula o total e grava valor, nomes e preços/deltas em snapshot. As escolhas de combo têm suporte parcial no backend e dependem de um fluxo completo no catálogo e no Totem.
- **Estado inicial.** `AGUARDANDO_PAGAMENTO`, `senha: null`, `origemOffline: false`. Todos os produtos com tempo zero resultam em `preparoZero: true`. A configuração do servidor pode marcar o pedido como DEMO ao criar.
- **Idempotência da criação.** O Totem sempre envia `Idempotency-Key` e conserva a tentativa. A API aceita a chave opcional no cabeçalho ou no corpo. Valores divergentes dão 400. Repetição compatível retorna o registro existente com o estado atual. Chave incompatível com conteúdo, ator de dispositivo ou escopo dá 409. O TOTEM é revalidado dentro da transação. [Evidências do #39](evidence/qa-concorrencia-tenants-idempotencia/README.md)
- **Elegibilidade.** A fila P0 exige DEMO habilitado para o tenant, pedido marcado no mesmo ambiente, liberação auditada e ausência de pagamentos vinculados. O estado do pedido sozinho não comprova elegibilidade. Os estados abertos são `PENDENTE`, `EM_PREPARO` e `PRONTO`. Com preparo zero, a liberação registra o salto para `PRONTO` na mesma transação. [Liberação DEMO](contratos/liberacao-demo.md)
- **Senha e transições.** Solicitar senha, transicionar ou liberar DEMO requer `Idempotency-Key` com UUID. Transição e liberação DEMO também requerem `versaoEsperada` no corpo. A solicitação de senha exige o objeto vazio `{}`. A atribuição usa a data civil de São Paulo, contador atômico e registro de auditoria. Transição exige senha atribuída e estado elegível, registra auditoria e incrementa a versão. [Senha](contratos/senha-diaria-kds.md) · [Transições e acompanhamento](contratos/transicoes-pedidos.md)
- **Financeiro.** O schema tem `Pagamento` e estados financeiros. As rotas operacionais existentes usam somente autorização DEMO. O webhook e as transições financeiras permanecem pendentes.
- **Histórico.** `criadoEmInicio` e `criadoEmFim` são limites civis de criação em `America/Sao_Paulo`, com início inclusivo e fim exclusivo. Filtros legados de `dataSequencial` têm outro significado. A data operacional só é confirmada quando a senha é atribuída. A listagem humana ainda usa consulta sem paginação. [Histórico](evidence/dashboard-pedidos-correcao/README.md)

## Execução e configuração

- [Guia local](../apps/backend/README.md) cobre ambiente, migrações e validação. [Configurações do negócio](contratos/configuracoes-estabelecimento.md) detalha leitura, escrita e projeção a dispositivos.
- O bootstrap usa `ALLOWED_ORIGINS` com origens padrão em produção e permite `Idempotency-Key`. A [regra interna do backend](../.agents/rules/backend.md) especifica `CORS_ALLOWED_ORIGINS` e política restritiva. [Bootstrap atual](../apps/backend/src/main.ts) · [Exemplo de ambiente](../apps/backend/.env.example)
- O P0 ainda depende de novos contratos e implementação para confirmação financeira, vínculo e cobrança Point, webhook, cancelamento e estorno, venda offline, reconciliação LAN e relatório de faturamento. O [índice](README.md) traz o estado e as evidências das entregas.
