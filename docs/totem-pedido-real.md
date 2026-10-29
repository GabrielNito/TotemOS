# Carrinho para pedido real

Card: https://trello.com/c/tC5WqYRu

O catálogo conectado envia a seleção depois da identificação para `POST /pedidos`, autenticado com o deviceToken TOTEM. Envia referências, quantidades, nome da variação e identificação; não envia preço, total nem negocioId. O contrato atual identifica variações pelo nome. Nomes ambíguos, opções ausentes e opções esgotadas são rejeitados pela API.

Antes do envio, o app grava a chave UUID de idempotência e o payload em SecureStore, separados por negócio. Retentativas reutilizam exatamente a tentativa persistida. Enquanto o resultado é incerto, editar ou criar outro pedido fica bloqueado. Falhas ao gravar impedem o envio. HTTP 400/404 liberam a revisão do carrinho; falhas de rede, timeout, sessão, HTTP 5xx ou resposta incompatível preservam a tentativa para recuperação. O carrinho permanece salvo.

A resposta validada fornece referência e total do servidor. A tela informa `AGUARDANDO_PAGAMENTO`, sem aprovar cobrança nem apresentar senha de cozinha. O pedido pendente fica retido nesta etapa; continuar para pagamento, cancelar e iniciar uma nova venda após sua conclusão dependem da próxima entrega. A prévia Brioche permanece independente e demonstrativa.

## Backend e migração

O backend consulta variações e usa o preço selecionado no snapshot. Também rejeita adicionais repetidos e filtra consultas de adicionais e escolhas pelo tenant. Preparo Zero continua aguardando pagamento; não antecipa entrada na cozinha.

A migração `20261029170000_pedido_sem_senha_antes_kds` permite senha nula. Pedidos novos aguardam atribuição pelo KDS; senhas históricas são preservadas. A migração precisa ser aplicada no ambiente de destino antes de publicar o backend atualizado. Não foi aplicada ao schema operacional durante o desenvolvimento.

## Validação inicial

Os testes novos falharam antes das correções de variação, adicionais e tenant. Os testes de envio cobrem persistência anterior à rede, recuperação após reinício, exclusão mútua, erros definitivos/incertos e rejeição de resposta de outro negócio. A integração React cobre recuperação de tentativa e bloqueio de navegação sem sobrescrever o carrinho quando o armazenamento falha.

Migrações executadas em schema PostgreSQL temporário e isolado: pedido com duas unidades Duplo e dois adicionais por unidade totalizou R$ 48,00, permaneceu aguardando pagamento sem senha, e a repetição da chave retornou o mesmo pedido, com um único registro no banco. O schema de auditoria foi removido ao terminar. Sem cobrança ou alteração do catálogo operacional.

A validação física deste novo fluxo no A54 e a revisão visual da tela de pedido pendente ainda precisam ser realizadas. O aparelho permanece com a demonstração Brioche aprovada.
