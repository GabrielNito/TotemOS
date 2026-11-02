# Auditoria inicial do #32

Base: develop 046928d, PR #18/#23. Leitura dos contratos #30/#31 e implementação antes de alterar código.

| Requisito | Comportamento existente | Lacuna | Teste necessário | Alteração proposta |
| --- | --- | --- | --- | --- |
| Dois KDS | Teste com duas instâncias e versão compartilhada | Servidor não modela ciclo, senha e replay | Ciclo completo, disputa, perda após commit, datas distintas | Fixture compartilhado com idempotência por ator |
| Polling/foco | 5s, abort, geração, serialização | Retomada espera timer antigo | Resposta tardia e foreground | Nova leitura imediata após finalizar geração antiga |
| Respostas antigas | Preserva versão maior em cards presentes | ENTREGUE pode ressuscitar, omissão remove sem confirmação | Tombstone, omissão transitória | Memória de confirmações, verificar omissões em segunda leitura |
| Diário | Grava antes de enviar, escopo tenant/device | Retry futuro pode limpar stale; validação aceita metadados inválidos | Retry adiado, corrupção, falha de ack | Manter stale até resolver diário; validar registro sem apagar |
| Conflitos | Remove intenção definitiva, refetch, Set blocked | Sem feedback por pedido nem política explícita de desbloqueio | Política DEMO, ação manual, alteração remota | Bloqueio automático por versão; nova decisão manual após leitura |
| Rede | Timeout 15s, retry com teto 60s, Retry-After | Sem jitter nem pausa de retries automáticos prolongados | 429, 503, DNS, oscilação | Jitter, orçamento por sessão e retomada manual preservando identidade |
| UX | Sync, última leitura, stale, loading, destaque | Recuperação fora da fila e rejeição pouco visíveis | Texto e estados acessíveis | Aviso global de recuperação e rejeição por card |
| Segurança | DEVICE/PAINEL, tenant credencial, SecureStore | Validar regressões na expiração | 401 list/mutation, troca de escopo | Limpar estado visível na revogação |
| CI | Job kds-test existente | Sem lacuna | Executar comandos locais e CI | Manter job existente |
| Android/API real | Não homologados nesta tarefa | Ambiente #41 | Dois aparelhos e DEMO isolado | Registrar PENDENTE, sem tocar Neon |
