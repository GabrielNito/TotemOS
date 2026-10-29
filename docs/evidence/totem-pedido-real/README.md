# Pedido real no Galaxy A54

Card: https://trello.com/c/tC5WqYRu

Auditoria de 29/10/2026 com schema PostgreSQL e armazenamento de teste isolados. Nenhuma cobrança ou alteração do catálogo operacional. As imagens são capturas nativas de evidência, sem uso na interface do app.

| Captura                                                  | Cenário                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| [03-cart.png](03-cart.png)                               | Carrinho com duas unidades Duplo, dois adicionais por unidade, R$ 99,60 |
| [04-identification.png](04-identification.png)           | Identificação e ação Registrar pedido                                   |
| [05-api-unavailable.png](05-api-unavailable.png)         | API indisponível antes do envio, tentativa preservada                   |
| [06-attempt-restored.png](06-attempt-restored.png)       | Tentativa recuperada após reiniciar                                     |
| [07-catalog-rejection.png](07-catalog-rejection.png)     | Rejeição definitiva libera revisão                                      |
| [08-cart-preserved.png](08-cart-preserved.png)           | Itens preservados depois da rejeição                                    |
| [09-order-registered.png](09-order-registered.png)       | Pedido registrado, R$ 89,60 e aguardando pagamento                      |
| [10-order-after-restart.png](10-order-after-restart.png) | Mesmo pedido recuperado após reiniciar                                  |

[Verificação do banco](result.json) e [proveniência do APK](build.json). A falha após commit é coberta por testes unitários; não há alegação de simulação desse caso no aparelho. O teste físico de falha usa API indisponível antes do envio.
