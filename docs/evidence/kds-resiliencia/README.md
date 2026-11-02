# Evidências do #32: resiliência e múltiplos KDS

Card: https://trello.com/c/QFo6ttWE
Base: origin/develop 046928d064b8c6d3bb312d0d771d499d2414fe0f, PR #18/#23.
Data: 02/11/2026. Branch: feature/kds-resiliencia-multipainel.
Worktree separado, sem alterar arquivos locais da tarefa do Totem.

## Auditoria

[Matriz inicial](auditoria.md), escrita antes de alterar a implementação.
O #23 já tinha polling, abort/geração, deduplicação, idempotência persistida,
retry/backoff, 409 com refetch, isolamento e bloqueio de duplo toque.
Não houve reconstrução da fila nem alteração do backend/contratos.

Lacunas corrigidas: confirmação terminal sem memória; omissão de card por uma
leitura não transacional; stale liberado com diário ainda pendente; retomada
aguardando geração/timer antigos; bloqueio de senha sem política de versão;
metadados inválidos aceitos; retries de mutação sem pausa; replay negado após
resultado incerto; recuperação fora da fila sem aviso próprio.

## IMPLEMENTADO

- Uma requisição/ciclo por controlador. Gerações antigas não publicam estado;
  confirmação tardia pode resolver o diário mesmo no background.
- Maiores versões observadas são lembradas durante a sessão, inclusive após
  omissões. Entrega confirmada não reaparece por GET antigo.
- Omissões exigem duas leituras completas. Divergência preserva união por versão,
  ordenada por criação/ID, com stale. Erro conserva todos os cards anteriores.
  Duplicata divergente entre páginas força uma releitura limitada; inconsistência
  persistente só permite nova leitura no próximo ciclo.
- 409 não troca versão nem gera replay automático com nova chave. Primeira
  tentativa rejeitada é resolvida no diário e a fila é reconsultada. Operador
  decide novamente sobre estado atual. Numeração automática bloqueada só é
  liberada com versão remota maior nesta sessão; botão manual continua possível.
- Rejeição durante replay incerto mantém a intenção em pausa persistida (halted).
  Isso inclui diário restaurado com attempts=0, pois a gravação pode preceder
  um commit cuja resposta não chegou. Retomada usa exatamente a identidade original.
- AsyncStorage por tenant/dispositivo, sem token. Validação de UUID, campos,
  contagem/agendamento, alvo/versão e duplicatas; corrupção bloqueia sem apagar.
  Versão original também é salva na numeração nova como metadado, sem mudar o POST.
- Retry com jitter de 20%, teto calculado de 60 s, Retry-After respeitado. Cinco
  falhas pausam envio automático; retomada manual concede novo orçamento com
  mesma chave/payload. Polling de leitura continua após a espera. Sem ações novas
  enquanto há intenção incerta, inclusive se o pedido já saiu da fila.
- Avisos separados para sincronização, desatualização, envio, recuperação e
  rejeição; estado global mostra intenções fora da fila. 401 limpa dados visíveis
  e o fluxo já existente apaga a credencial/volta ao pareamento.

## TESTADO COM MOCKS

`multipanel.test.ts` usa dois controladores independentes, armazenamento separado
por ator e servidor compartilhado com commit determinístico, versão esperada,
sequência de status, numeração/data e replay por ator/tipo/UUID/payload.
Os mocks não representam locks PostgreSQL, SecureStore físico ou transporte real.

| Cenário | Verificação |
| --- | --- |
| A/B recebem PENDENTE; A prepara; B usa versão antiga | Um efeito, B recebe 409, reconsulta EM_PREPARO e não avança sozinho |
| Próximo ciclo válido; B marca PRONTO; A entrega com versão atual | Convergência dos dois, três efeitos no total, fila vazia em ambos |
| Duas numerações simultâneas com senha NULL | Uma emissão/versão, mesmo número e data nos dois retornos |
| Preparo Zero já PRONTO e sem senha | Numeração única, entrega sem passar por EM_PREPARO |
| Pedidos diferentes/datas operacionais diferentes | Ações independentes, datas preservadas, convergência |
| HTTP perdido depois do commit, painel offline/reiniciado, outro entrega | Replay original retorna estado atual, diário removido, nenhum efeito duplicado |

`controller.test.ts`, `api.test.ts` e `storage.test.ts` reforçam: DNS/rede,
timeout HTTP com fake timers, 429 Retry-After, 503/backoff, pausa/retomada manual,
409/403/404, recuperação negada, persistência antes de envio, falha no ack,
reinício, escopo tenant/dispositivo, JSON/metadados corrompidos, revogação,
gerações/foco, confirmação tardia, omissão instável e respostas antigas.
RNTL cobre rejeição, loading/recuperação, controles touch acessíveis e recuperação
de pedido ausente da fila. Testes anteriores foram mantidos. Dois fixtures antigos
foram ajustados: foreground agora inicia uma leitura nova imediatamente; duplicata
divergente exige uma terceira resposta HTTP para confirmar a releitura.

## Execução local

- npm ci: concluído com lockfile existente, sem alteração de dependências.
- RED inicial: 10 falhas e 41 aprovações nas três suítes focadas, antes da solução.
  [Log](red.txt). Os testes que falhavam antes de stop deixaram timers; o teardown
  foi fortalecido para sempre encerrar controladores. REDs adicionais focados
  foram executados para pausa de replay, validação do diário e ordenação.
- Jest completo: **116 testes, 15 suítes aprovados**. [Log](jest.txt).
- npm run lint -- --no-cache: **0 erros, 0 warnings**. [Log](lint.txt).
  O cache foi desabilitado após o parser de imports conservar um erro já corrigido.
- npm run typecheck: **aprovado**. [Log](typecheck.txt).
- Expo export Android: **aprovado**, dist/ci. [Log](android-export.txt).
- Formatação Prettier dos arquivos TypeScript alterados e git diff --check.
- Job existente kds-test mantido, sem duplicação. Resultado da CI acompanha o PR.

## TESTADO COM API REAL

Não executado nesta entrega. O backend permanece intacto e suas suítes de
concorrência PostgreSQL de #30/#31 seguem no pipeline existente. Os testes frontend
não substituem essa validação. Nenhuma conexão, migração ou alteração no Neon
operacional; nenhuma liberação DEMO em produção.

## TESTADO EM ANDROID REAL

Não executado. `adb devices` não apresentou aparelhos conectados. Export comprova
empacotamento Android, sem provar instalação, execução touch ou transporte real.

## PENDENTE: #41

Provisionar DEMO isolado e dois Android. Parear ambos como PAINEL no mesmo negócio;
criar/liberar pedido por DONO autorizado; observar senha; disputar preparo;
confirmar conflito sem duplicação; desconectar um aparelho; avançar no outro;
reconectar, retomar/reiniciar e conferir convergência e histórico de auditoria.
Repetir Preparo Zero, troca de dia operacional, revogação e rede oscilante real.

## Limites

Polling de 5 s é mínimo entre ciclos, sem tempo real garantido. Cursor sem snapshot
não permite provar uma fotografia transacional; duas omissões consistentes retiram
um card sem inferir status. Memória de versões é da sessão, não um histórico local
persistente. AsyncStorage não sobrevive a desinstalação/limpeza de dados. Diário
inválido exige diagnóstico preservando os bytes originais. Bloqueio global durante
intenção incerta e serialização são conservadores nesta entrega. Limite de retry
se refere a comandos; leituras continuam com backoff para detectar recuperação.
Não há offline completo, LAN, pagamento, impressão, deploy ou merge automático.
