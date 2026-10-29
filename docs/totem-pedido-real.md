# Carrinho para pedido real

Card: https://trello.com/c/tC5WqYRu

O catálogo conectado envia a seleção depois da identificação para `POST /pedidos`, autenticado com o deviceToken TOTEM. Envia referências, quantidades, nome da variação e identificação; não envia preço, total nem negocioId. O contrato atual identifica variações pelo nome. Nomes ambíguos, opções ausentes e opções esgotadas são rejeitados pela API.

Antes do envio, o app grava a chave UUID de idempotência e o payload em SecureStore, separados por negócio. Retentativas reutilizam exatamente a tentativa persistida. Enquanto o resultado é incerto, editar ou criar outro pedido fica bloqueado. Falhas ao gravar impedem o envio. HTTP 400/404 liberam a revisão do carrinho; falhas de rede, timeout, sessão, HTTP 5xx ou resposta incompatível preservam a tentativa para recuperação. O carrinho permanece salvo.

A resposta validada fornece referência e total do servidor. A tela informa `AGUARDANDO_PAGAMENTO`, sem aprovar cobrança nem apresentar senha de cozinha. O pedido pendente fica retido nesta etapa; continuar para pagamento, cancelar e iniciar uma nova venda após sua conclusão dependem da próxima entrega. A prévia Brioche permanece independente e demonstrativa.

## Backend e migração

O backend consulta variações e usa o preço selecionado no snapshot. Também rejeita adicionais repetidos e filtra consultas de adicionais e escolhas pelo tenant. Preparo Zero continua aguardando pagamento; não antecipa entrada na cozinha.

A migração `20261029170000_pedido_sem_senha_antes_kds` permite senha nula. Pedidos novos aguardam atribuição pelo KDS; senhas históricas são preservadas. A migração precisa ser aplicada no ambiente de destino antes de publicar o backend atualizado. Não foi aplicada ao schema operacional durante o desenvolvimento.

Atualização posterior ao relato acima: o [card #26](https://trello.com/c/tC5WqYRu)
registra aplicação operacional da migração em 29/10/2026 às 15:29 BRT, sem
publicação de nova versão do backend. A auditoria documental do #28 consultou
esse registro e o código; não reexecutou migrações nem inspecionou o Neon.

## Validação inicial

Os testes novos falharam antes das correções de variação, adicionais e tenant. Os testes de envio cobrem persistência anterior à rede, recuperação após reinício, exclusão mútua, erros definitivos/incertos e rejeição de resposta de outro negócio. A integração React cobre recuperação de tentativa e bloqueio de navegação sem sobrescrever o carrinho quando o armazenamento falha.

Migrações executadas em schema PostgreSQL temporário e isolado: pedido com duas unidades Duplo e dois adicionais por unidade totalizou R$ 48,00, permaneceu aguardando pagamento sem senha, e a repetição da chave retornou o mesmo pedido, com um único registro no banco. O schema de auditoria foi removido ao terminar. Sem cobrança ou alteração do catálogo operacional.

## Validação no Galaxy A54

[Capturas e resultado](evidence/totem-pedido-real/README.md). O APK de auditoria usa a mesma interface e um bundle Hermes atualizado no contêiner nativo existente, com assinatura debug do projeto. Isso não substitui um novo build Gradle/EAS de produção. As chaves de carrinho e tentativa receberam um prefixo exclusivo somente durante o empacotamento de auditoria; o código operacional e os dados existentes no aparelho foram preservados.

O backend de teste utilizou um schema PostgreSQL isolado com cópia do catálogo e do registro do dispositivo pareado. No A54, a seleção inicial de duas unidades Duplo com dois adicionais por unidade totalizou R$ 99,60. A API foi parada antes do envio: a tentativa permaneceu salva e a revisão do carrinho ficou bloqueada. Após reiniciar o backend e o app, a tentativa foi recuperada.

Uma mudança de limite exclusivamente no schema de auditoria provocou HTTP 400. O app liberou a revisão e preservou os itens. Reduzir o adicional para uma unidade por produto permitiu registrar o pedido por R$ 89,60. A tela mostrou o total da API, a referência e o estado aguardando pagamento. O botão de identificação do fluxo conectado agora diz “Registrar pedido”; a demonstração mantém “Escolher pagamento”.

O banco confirmou um único pedido, variação com snapshot R$ 39,80, adicional R$ 5,00, duas unidades, senha nula e zero pagamentos. Repetir a chave retornou o mesmo pedido. O app também recuperou a referência e o total após outro reinício e manteve a navegação bloqueada enquanto o pedido está pendente.

A perda da resposta depois do commit continua coberta pelos testes unitários; a tentativa de montar um proxy para essa simulação física foi bloqueada pela revisão automática, sem justificativa detalhada. O teste físico de indisponibilidade foi feito parando o próprio backend de auditoria antes do envio.

Totem: 134 testes em 30 suítes, lint e TypeScript aprovados. Backend: 86 testes, lint e build aprovados. A demonstração Brioche aprovada foi reinstalada ao terminar.
