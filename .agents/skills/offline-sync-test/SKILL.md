---
name: offline-sync-test
description: Procedimento para simular queda de internet entre Totem, Painel e Cloud, e validar o envio de lotes de pedidos offline para o backend.
---

# Runbook — Teste de Reconciliação Offline

Este procedimento valida se pedidos criados localmente durante instabilidades de rede são reconciliados corretamente na nuvem.

---

## Passos do Teste

1. **Simular Operação Offline**:
   - Desconectar a interface de rede do Totem e do Painel ou simular falha no backend cloud.
   - Criar um pedido no Totem. O Totem deve enviar o pedido diretamente para o servidor local do Painel.
   - O Painel deve gerar a `senha` diária sequencial e exibir o pedido na fila KDS.

2. **Reconexão com a Nuvem**:
   - Reestabelecer a conexão com a nuvem.
   - O Painel dispara um POST para o endpoint `POST /pedidos/reconciliar` enviando o lote de pedidos acumulados.

3. **Validação na Nuvem**:
   - Verificar se o pedido foi salvo com `origemOffline = true`.
   - Garantir que a `senha` gerada localmente pelo Painel foi mantida.
   - Reenviar o mesmo lote para confirmar que o `idempotencyKey` impede a inserção de registros duplicados.
