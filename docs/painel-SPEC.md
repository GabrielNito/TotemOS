# Painel de Pedidos — SPEC

App React Native usado pela equipe. O card [#23](https://trello.com/c/hZNzXBfQ)
implementa a fila online em landscape, solicitação de senha e preparo até entrega.
O backend #30 fornece [fila elegível e transições com versão/idempotência](transicoes-pedidos.md).
O backend #31 fornece [senha diária](senha-diaria-kds.md).
Detalhes de uso, arquitetura, erros, recuperação e roteiro Android no
[README do KDS](../apps/kds/README.md). Validação física/API real depende do ambiente
isolado #41; export Android e Jest não substituem essa evidência.

O P0 do roadmap usa backend cloud e PostgreSQL. A
[ADR 0001, PROPOSTA](adr/0001-contrato-operacional-p0.md) detalha elegibilidade,
DEMO e senha concorrente, aguardando revisão do Caio. Os documentos históricos
`stack-detalhada-v1.md` e `regras-de-negocio-totem.md` não existem nesta base.

## Stack

- React Native, **Expo com development client — não Expo Go**
- **`react-native-nitro-http-server`**: usado apenas no spike diagnóstico LAN, cujo resultado é INCONCLUSIVO. Não sustenta a operação P0.
- Testes: Jest

## Proposta P0 online e hipótese local futura

No P0 implementado pelo #31, KDS solicita a senha e backend garante atribuição atômica por
tenant/dia, incluindo dois KDS concorrentes. O KDS não mantém contador local.
A regra global 4 recebeu ressalva explícita; revisão do Caio permanece pendente.

As duas responsabilidades locais abaixo são uma **hipótese histórica pós-MVP,
não implementada nem validada como arquitetura produtiva**:

1. **Atribuir a senha sequencial local** em um coordenador único, hipótese que ainda exige protocolo de concorrência e recuperação antes de servir a vários dispositivos offline.
2. **Rodar o servidor local** ao qual os totens do mesmo negócio se conectam.

A hipótese dependia de um painel local disponível para todos os totens. Ela não
resolve, por si, dois KDS independentes, partições ou reconciliação de senhas.

## Fluxo online implementado no #23

1. Validar DEVICE/PAINEL em /dispositivos/me, com token seguro; 401 volta ao pareamento.
2. Carregar /pedidos/fila com paginação/deduplicação, sem reconstruir elegibilidade.
3. Persistir UUID e solicitar /pedidos/:id/senha automaticamente quando NULL.
4. Usar versão confirmada para PATCH /pedidos/:id/status: iniciar preparo,
   marcar pronto e confirmar entrega. Preparo Zero já chega PRONTO.
5. Reconciliar após comando, sem mudança definitiva otimista. Timeout/503 mantém
   UUID e payload persistidos; 409 reconsulta e exige nova decisão do operador.
6. Polling de 5 s (configurável), sem sobreposição; pausa em background/fora de foco.
   Desconexão mantém dados desatualizados e bloqueia ações até recuperar.
7. Cards exibem senha/data, duração decorrida, itens completos e DEMO. Novos IDs
   posteriores à carga inicial recebem destaque e contador reconhecível. Som opcional
   não incluído. Faixas de espera são configuração visual, sem SLA.

Cancelamento/estorno com PIN, operação offline e LAN permanecem fora desta entrega.

## Resiliência online e dois painéis (#32)

Entrega incremental sobre #23/PR #18. A API #30/#31 continua inalterada:
DEVICE/PAINEL, tenant da credencial, versão esperada e chave idempotente.
Dois painéis podem ler PENDENTE; somente o primeiro PATCH confirma preparo.
O segundo recebe 409, reconsulta EM_PREPARO e exige nova decisão para PRONTO.
Outro painel entrega com versão atual; ambos convergem por polling válido.
Não há avanço otimista nem repetição automática com versão corrigida.

- Memória das maiores versões observadas e confirmações impede regressão e
  ressurreição de entrega confirmada por respostas antigas durante a sessão.
- Omissão de card requer duas leituras completas. Divergência mantém união/maior
  versão e stale; falha preserva a fila anterior. Ausência não inventa ENTREGUE.
  Duplicata divergente entre páginas força uma releitura limitada. Sem snapshot
  da API, isso detecta inconsistências observáveis, sem prometer atomicidade.
- Background cancela a geração; foreground revalida sem esperar timer antigo,
  mantendo um ciclo por controlador. Confirmação tardia resolve o diário.
- Diário AsyncStorage por tenant/dispositivo conserva UUID, alvo/versão originais,
  tentativas/agendamento e pausa de recuperação. Grava antes de transmitir;
  remove após confirmação gravada ou rejeição definitiva da primeira tentativa.
  Rejeição de replay incerto conserva a intenção em pausa, inclusive após reinício.
  Corrupção não é apagada e operações de outro escopo não são lidas.
- Rede/429/503: backoff exponencial com jitter, teto 60 s e respeito a Retry-After.
  Cinco falhas pausam transmissão automática; retomada manual conserva chave e
  payload. GET isolado não libera ações dependentes de operação ainda incerta.
- Rejeição definitiva bloqueia numeração automática na versão rejeitada. Versão
  remota maior ou decisão manual após leitura permitem nova solicitação segura.
  409 de política DEMO não é tratado como sucesso ou como autorização de preparo.
- Interface diferencia envio, recuperação, rejeição, dados desatualizados e
  sincronização. Aviso global inclui operações fora da fila. 401 remove dados
  visíveis e volta ao pareamento; falhas temporárias preservam a credencial.

O polling mínimo de 5 s não garante convergência em 5 s; latência, paginação,
backoff e pausas influenciam. Ações permanecem serializadas, com bloqueio global
conservador enquanto há intenção incerta. A recuperação não sobrevive à limpeza
ou desinstalação dos dados do aplicativo. Não há modo offline completo.

**IMPLEMENTADO:** políticas acima e controles acessíveis, sem alteração de backend.
**TESTADO COM MOCKS:** dois controladores/diários independentes e servidor comum
com versão, transições, senha, data e replay; Jest/RNTL e export Android.
**TESTADO COM API REAL:** não executado nesta entrega. Suítes PostgreSQL #30/#31
continuam na CI e não são substituídas pelos mocks.
**TESTADO EM ANDROID REAL:** não executado nesta entrega.
**PENDENTE:** #41, banco DEMO isolado e dois Android, rede oscilante real,
reinício/foreground e histórico com API real. Ver
[evidências e matriz de auditoria](evidence/kds-resiliencia/README.md).

## Regras que não podem ser esquecidas ao implementar

- "Em preparo" é condicional — pedidos com todos os itens de `tempoEstimadoPreparo = 0` pulam direto pra "Pronto".
- P0: tenant vem do deviceToken PAINEL verificado; comparar um `negocio_id` enviado pelo cliente não autentica uma conexão LAN.
- P0: senha por dia civil em `America/Sao_Paulo`, definida na primeira atribuição pelo backend. Reset por sessão e emissão offline não estão validados.
- Backend deve limitar a fila a pedidos elegíveis. GET /pedidos para PAINEL já restringe a elegibilidade desde o #30. DEMO deve aparecer identificado, sem mensagem de pagamento aprovado.

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
