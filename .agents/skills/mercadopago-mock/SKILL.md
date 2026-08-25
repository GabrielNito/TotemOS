---
name: mercadopago-mock
description: Procedimento para simular disparos da Point API do Mercado Pago e testar webhooks assíncronos de confirmação de pagamento e estorno.
---

# Runbook — Teste de Webhooks do Mercado Pago Point

Este procedimento descreve como simular a aprovação e estorno de pagamentos da maquininha Point física durante o desenvolvimento local.

---

## Estrutura do Webhook de Pagamento

Para simular o recebimento de pagamento aprovado no backend, envie uma requisição HTTP POST para `/pagamentos/webhook/mercadopago`:

### Payload de Pagamento Aprovado
```json
{
  "action": "payment.created",
  "data": {
    "id": "mp_payment_123456",
    "intent_id": "ID_DA_INTENCAO_CRIADA",
    "status": "APPROVED",
    "payment_method_type": "credit_card"
  }
}
```

### Payload de Pagamento Recusado
```json
{
  "action": "payment.updated",
  "data": {
    "id": "mp_payment_123456",
    "intent_id": "ID_DA_INTENCAO_CRIADA",
    "status": "REJECTED"
  }
}
```

### Payload de Estorno Confirmado
```json
{
  "action": "refund.created",
  "data": {
    "id": "mp_refund_987654",
    "intent_id": "ID_DA_INTENCAO_CRIADA",
    "status": "REFUNDED"
  }
}
```
