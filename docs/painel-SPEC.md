# Painel de Pedidos — SPEC

App React Native usado pela equipe. A tela de fila ainda é placeholder na base
auditada `ef20663` (29/10/2026). Pareamento existe; fila, transições e solicitação
de senha são entregas futuras dos cards #23/#30/#31/#32.

O P0 do roadmap usa backend cloud e PostgreSQL. A
[ADR 0001, PROPOSTA](adr/0001-contrato-operacional-p0.md) detalha elegibilidade,
DEMO e senha concorrente, aguardando revisão do Caio. Os documentos históricos
`stack-detalhada-v1.md` e `regras-de-negocio-totem.md` não existem nesta base.

## Stack

- React Native, **Expo com development client — não Expo Go**
- **`react-native-nitro-http-server`**: usado apenas no spike diagnóstico LAN, cujo resultado é INCONCLUSIVO. Não sustenta a operação P0.
- Testes: Jest

## Proposta P0 online e hipótese local futura

No P0 proposto, KDS solicita a senha e backend garante atribuição atômica por
tenant/dia, incluindo dois KDS concorrentes. O KDS não mantém contador local.
Isso exige revisão da regra global 4, registrada na ADR, sem alteração implícita.

As duas responsabilidades locais abaixo são uma **hipótese histórica pós-MVP,
não implementada nem validada como arquitetura produtiva**:

1. **Atribuir a senha sequencial local** em um coordenador único, hipótese que ainda exige protocolo de concorrência e recuperação antes de servir a vários dispositivos offline.
2. **Rodar o servidor local** ao qual os totens do mesmo negócio se conectam.

A hipótese dependia de um painel local disponível para todos os totens. Ela não
resolve, por si, dois KDS independentes, partições ou reconciliação de senhas.

## Fluxos planejados, não implementados

1. Fila de pedidos por status (Pendente / Em preparo / Pronto), agregando todos os totens do negócio
2. Toque no card muda status
3. Escala de cor por tempo de espera (verde/amarelo/vermelho)
4. Alerta sonoro **+** destaque visual forte pra pedido novo (ambiente de evento é barulhento — som sozinho não basta)
5. Futuro financeiro: cancelar/estornar com PIN do dono e confirmação em duas etapas. Fora dos cards P0 de fila/preparo.

## Regras que não podem ser esquecidas ao implementar

- "Em preparo" é condicional — pedidos com todos os itens de `tempoEstimadoPreparo = 0` pulam direto pra "Pronto".
- P0: tenant vem do deviceToken PAINEL verificado; comparar um `negocio_id` enviado pelo cliente não autentica uma conexão LAN.
- P0 proposto: senha por dia civil em `America/Sao_Paulo`, definida na primeira atribuição pelo backend. Reset por sessão e emissão offline não estão validados.
- Backend deve limitar a fila a pedidos elegíveis. O GET /pedidos atual é consulta geral e ainda não implementa essa garantia. DEMO deve aparecer identificado, sem mensagem de pagamento aprovado.

## Pareamento (substitui login)

Mesmo mecanismo do totem — token de longa duração vinculado ao `negocio_id`, gerado a partir de um código criado na dashboard.

## LAN pós-MVP: spike inconclusivo

Ver [relatório do spike #19](spikes/kds-local-network.md). Conclusão de
experimento não significa aprovação: Android ↔ Android não foi confirmado,
persistem lacunas WebSocket/mDNS e o protocolo é apenas diagnóstico.

- `react-native-nitro-http-server` rodando de forma confiável em uso prolongado (não só em teste rápido)
- Descoberta mDNS do lado do totem encontrando este servidor de forma consistente

## Fora de escopo (v1)

Watchdog de reinício automático do app (fica pra v2+, só compensa em produção real). Planos, faixas de faturamento, fiscal/NFC-e.
