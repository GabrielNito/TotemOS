# Painel de Pedidos — SPEC

App React Native usado pela equipe. Fila de pedidos, mudança de status. Também roda o servidor local que coordena o totem — é a peça arquiteturalmente mais delicada do projeto.

Detalhe completo (incluindo o histórico de por que essa arquitetura foi escolhida): `docs/stack-detalhada-v1.md`, seção 4. Regras de negócio: `docs/regras-de-negocio-totem.md`, seções 6 e 8.

## Stack

- React Native, **Expo com development client — não Expo Go**
- **`react-native-nitro-http-server`** (com plugin WebSocket) — servidor HTTP local embarcado no próprio app, sem embarcar runtime Node. Biblioteca nova, sem histórico longo de produção — **validar com spike antes de comprometer a arquitetura nela**.
- Testes: Jest

## O painel é a autoridade local

Duas responsabilidades que só ele tem:
1. **Atribuir a senha sequencial** de cada pedido recebido (do próprio device ou de um totem via rede local) — evita números duplicados quando múltiplos totens estão isolados da nuvem.
2. **Rodar o servidor local** ao qual os totens do mesmo negócio se conectam.

Ambas resolvidas juntas: como o painel já precisa estar acessível localmente por todo totem, ele virar também a fonte de numeração não cria dependência nova.

## Fluxos principais

1. Fila de pedidos por status (Pendente / Em preparo / Pronto), agregando todos os totens do negócio
2. Toque no card muda status
3. Escala de cor por tempo de espera (verde/amarelo/vermelho)
4. Alerta sonoro **+** destaque visual forte pra pedido novo (ambiente de evento é barulhento — som sozinho não basta)
5. Botão de cancelar/estornar: PIN do dono, mostra valor e detalhe antes de confirmar, duas etapas (cancelar → confirmar estorno)

## Regras que não podem ser esquecidas ao implementar

- "Em preparo" é condicional — pedidos com todos os itens de `tempoEstimadoPreparo = 0` pulam direto pra "Pronto".
- Isolamento entre negócios: ao aceitar conexão de um totem, **verificar que o `negocio_id` bate** antes de processar qualquer pedido — a mesma wifi de um evento pode ter vários painéis de negócios diferentes.
- Numeração de senha reseta por sessão/dia — não é contínua pra sempre.

## Pareamento (substitui login)

Mesmo mecanismo do totem — token de longa duração vinculado ao `negocio_id`, gerado a partir de um código criado na dashboard.

## Ainda em validação (spike necessário)

- `react-native-nitro-http-server` rodando de forma confiável em uso prolongado (não só em teste rápido)
- Descoberta mDNS do lado do totem encontrando este servidor de forma consistente

## Fora de escopo (v1)

Watchdog de reinício automático do app (fica pra v2+, só compensa em produção real). Planos, faixas de faturamento, fiscal/NFC-e.
