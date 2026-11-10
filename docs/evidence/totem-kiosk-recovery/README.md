# Card #42 · Totem Android e recuperação de sessão

Base `origin/develop` em `27c88ab2f1f360efd564a87cee9db3b5e3bb9b2e`, com [CI aprovada](https://github.com/GabrielNito/TotemOS/actions/runs/42428527641) e sem PR aberto na consulta inicial. Branch `feature/totem-kiosk-lock-task-recovery-p0`. [Card #42](https://trello.com/c/BlKTMhV9).

## Auditoria da base

| Área | Comportamento verificado na base |
| --- | --- |
| Sessão | O token persistia no SecureStore. `GET /dispositivos/me` confirmava o negócio e o tipo TOTEM. Token ausente ou 401 encaminhavam à ativação. Falha transitória preservava o token, mas a validação HTTP não tinha timeout. |
| Catálogo | O catálogo vinha da rede pelo negócio autenticado. Um catálogo vazio ou indisponível impedia montar a recuperação do pedido. |
| Carrinho | O snapshot persistia por negócio no SecureStore. Leitura estrita detectava corrupção. A recuperação do pedido registrado ainda dependia da leitura do carrinho. |
| Criação e replay | O #33 persistia UUID e payload antes do POST. Resposta perdida mantinha a tentativa para replay exato. O POST 404 apagava a tentativa e um dispositivo recém-pareado no mesmo negócio podia repetir uma tentativa anterior sem vínculo local com o dispositivo criador. |
| Acompanhamento | Referência e último snapshot validado voltavam após reinício. Polling pausava em background e retomava em foreground. GET 400/403/404 pedia assistência, 401 acionava pareamento. |
| Encerramento | Só ENTREGUE confirmado pelo GET autorizava o encerramento. Marca durável precedia a limpeza do carrinho e a remoção da tentativa. Novo atendimento limpava identidade em memória e preservava pareamento. |
| Navegação e privacidade | Voltar no catálogo podia cair no comportamento padrão de encerrar a Activity. O fluxo de acompanhamento já bloqueava o retorno ao carrinho com tentativa ativa. Nome e CPF ficavam em memória até standby ou encerramento. A Activity ainda podia aparecer como snapshot nos recentes. |
| Android | O projeto usava CNG e já desabilitava Voltar preditivo. Não havia consulta nativa de Lock Task nem proteção da janela. Expo Go não é suportado. |

## Android e Expo

| Estado confirmado | Operação |
| --- | --- |
| App comum | Voltar é tratado dentro do Totem. Home, recentes, notificações e configurações continuam sob controle do Android. |
| Screen Pinning | O operador pode escolher fixar pelo menu de recentes do próprio Android e seguir a confirmação do sistema, quando o aparelho oferecer o recurso. A fixação é temporária e pode ser desfeita pelos controles do sistema. |
| Lock Task gerenciado | O controlador de políticas do dispositivo (DPC) autoriza `com.totemos.totem`. O app confirma a autorização e o estado `LOCK_TASK_MODE_LOCKED` no sistema. Home, recentes e notificações dependem das opções do DPC. |

O módulo Expo local `modules/totem-kiosk` registra o Kotlin por autolinking e sobrevive ao prebuild limpo. Usa APIs públicas `DevicePolicyManager.isLockTaskPermitted`, `ActivityManager.lockTaskModeState` e `Activity.startLockTask` na thread principal. A janela recebe `FLAG_SECURE` antes da navegação real para proteger capturas e miniaturas dos recentes. A proteção é da janela do app. O comportamento de captura, do teclado e das miniaturas deve ser conferido no modelo e versão Android de operação. [Proteção de janelas no Android](https://developer.android.com/security/fraud-prevention/activities). O SDK 57 usa React Native 0.86, API Android mínima 24 e compile/target SDK 36 nesta base. As APIs de detecção já existem desde a API 23.

O app consulta o estado ao iniciar, ao voltar ao foreground e a cada abertura do diálogo de atendimento. A interface informa quando a leitura está em andamento ou indisponível. Respostas antigas não substituem uma leitura mais recente. Se um Lock Task antes confirmado desaparecer durante a sessão, a tela pede assistência e preserva o estado em memória. No Android, módulo ausente ou erro ao verificar a política bloqueiam o fluxo real com opção de tentar novamente. A prévia pula a verificação nativa e redireciona a rota de ativação para seu catálogo simulado.

O modo gerenciado pode ser iniciado por ação explícita na ativação se o DPC já autorizou o pacote. Para dispositivo já pareado, o administrador pode abrir a Activity em Lock Task pelo DPC a partir do Android 9, conforme o controlador. O Totem não altera a allowlist, não solicita pinning automaticamente e não oferece saída administrativa dentro da interface pública. [Lock Task no Android](https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode) · [Fixação de app no Android](https://support.google.com/android/answer/9455138) · [Código nativo e CNG no Expo](https://docs.expo.dev/workflow/customizing/) · [Autolinking do Expo](https://docs.expo.dev/modules/autolinking/).

## Abertura, falha e recuperação

1. Verifica a janela e a política Android, então abre a rota real. A validação do token tem timeout de 20 s e encaminha à ativação só se não houver token válido.
2. Com identidade confirmada, lê a tentativa segura em paralelo com o carregamento do catálogo. Catálogo vazio, indisponível ou lento impede novas vendas enquanto o acompanhamento de uma tentativa salva continua disponível.
3. Se há resultado confirmado, retoma o mesmo acompanhamento sem ler o carrinho. Uma tentativa sem resultado mantém o payload e a chave e só é reenviada pela ação **Consultar novamente**. Timeout, 401 e 404 preservam a tentativa. A marca de início do envio é gravada antes do POST. Um 400 no primeiro envio mantém o tratamento de validação anterior. Em uma retentativa, um 400 não descarta a tentativa incerta.
4. Tentativas novas também guardam o identificador do dispositivo autenticado. Identidade diferente no mesmo negócio bloqueia a recuperação e o POST. Se o registro legado tem ID de pedido, o app confirma a autoria pelo GET restrito do backend e grava o vínculo antes de mostrar o acompanhamento. Um legado sem ID de pedido permanece preservado para assistência, sem repetição de POST sob autoria desconhecida.
5. Na saída para background, o app remove a identificação do formulário em memória e volta à espera quando está no fluxo comercial. O campo real de nome desativa o preenchimento automático. O nome já incluído no payload persistido continua necessário para repetir um envio incerto. Um pedido registrado segue no acompanhamento. Ao finalizar, mantém a limpeza durável antes de liberar outro cliente. Falha de gravação, cancelamento e estorno pendente mantêm o atendimento bloqueado para assistência.

## Suporte autorizado

1. Leia o modo do Android na ativação ou no diálogo **Como você está pedindo?**. Em aparelho comum, habilite a fixação nos ajustes e use o menu de recentes apenas com consentimento do operador. Para desfazer, use o gesto ou botões indicados pelo aparelho, com a credencial do próprio Android se configurada.
2. Em aparelho gerenciado, use o console autorizado do DPC/EMM para liberar a manutenção ou retirar o pacote da allowlist. Verifique com o fornecedor a política de Home, recentes, notificações e saída antes de colocar o aparelho em atendimento.
3. Após reiniciar o aparelho, reabra o Totem para retomar a sessão. A abertura automática depende do DPC ou launcher dedicado configurado pelo administrador, inclusive após desbloqueio quando aplicável. Um app comum está sujeito às restrições de abertura de Activity em background. [Dispositivos dedicados Android](https://developer.android.com/work/dpc/dedicated-devices/cookbook) · [Restrições de abertura em background](https://developer.android.com/guide/components/activities/secure-bal).
4. Em sessão inválida, verifique a conectividade e use **Verificar novamente**. Para trocar a credencial, o responsável abre **Dispositivos** no Dashboard, localiza o Totem e seleciona **Revogar → Confirmar revogação**. Em **Gerar código de pareamento**, selecione **Totem de autoatendimento** e digite os seis dígitos na ativação do aparelho. Se houver tentativa bloqueada, confira o pedido pelos canais autorizados do estabelecimento antes de qualquer ação que remova dados locais. O novo dispositivo precisa de um atendimento próprio depois da reconciliação.
5. Atualize por APK assinado com a mesma chave e o mesmo package via processo do administrador. Uma atualização no lugar preserva os dados locais. Desinstalação/reprovisionamento remove os dados locais e exige reconciliação prévia do atendimento, autorização do administrador e novo pareamento.
6. Development build serve para compilação e QA com Metro. Homologue a operação pública com o APK assinado e bundle incorporado, sob as políticas do aparelho de produção.

## Homologação física

### Preparar e instalar

Use aparelhos de laboratório com depuração USB autorizada e um backend do #41 com dados fictícios. Registre o HEAD, SHA-256 do APK, modelo, versão Android e perfil do DPC quando houver. Para o teste do fluxo conectado, use uma URL HTTPS do backend isolado acessível pelo aparelho. Defina a URL em Metro no build de desenvolvimento, ou no ambiente que gerar o bundle do APK independente.

No PowerShell, a partir de `apps/totem`, com um único aparelho de laboratório listado como `device`:

```powershell
adb devices -l
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
Get-FileHash .\android\app\build\outputs\apk\debug\app-debug.apk -Algorithm SHA256
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
adb reverse tcp:8081 tcp:8081
$env:EXPO_PUBLIC_KIOSK_PREVIEW = "0"
$env:EXPO_PUBLIC_API_URL = "https://SUBSTITUIR-PELO-BACKEND-DEMO-ISOLADO"
npx expo start --dev-client --localhost --clear
```

Abra o Totem pelo ícone e selecione o servidor Metro, se o launcher solicitar. Para APK independente, use o artefato QA assinado com bundle real incorporado e substitua o caminho do APK em `adb install -r`. O APK independente dispensa Metro e é o artefato para validar o comportamento em operação. Ao alternar a flag de preview no mesmo checkout, encerre o Metro e reinicie com `--clear`. Exporte os dois modos sequencialmente com `--clear`, como na CI. Use a mesma assinatura nas duas versões do teste de atualização. Se houver conflito de assinatura ou instalação anterior desconhecida, interrompa e encaminhe ao responsável.

### Executar sem DPC

| Etapa | Resultado esperado |
| --- | --- |
| Pareie no Dashboard isolado, abra o diálogo de atendimento e confira o modo. | Modo comum. Voltar fica dentro do fluxo em catálogo, produto, carrinho e identificação. Em envio/acompanhamento, Voltar e gesto de borda preservam a tentativa. Home, recentes e a barra de notificações seguem a configuração normal do Android. |
| Digite um nome fictício, use Home e volte. Tente uma captura pelo atalho do aparelho e examine a miniatura em recentes. | O nome some, inclusive de sugestões de preenchimento da tela. O carrinho pode continuar na espera. Capture apenas se a tela estiver vazia de dados, e registre se o Android bloqueou a captura e ocultou o conteúdo da miniatura. |
| Ative a fixação em Ajustes do Android. Abra recentes, selecione o ícone do Totem, escolha **Fixar** e confirme no sistema. Teste as mesmas ações de navegação e desfaça a fixação pela combinação de gestos ou botões exibida pelo Android. | Totem indica fixação quando ativa. A saída pelo procedimento do sistema é possível, com credencial do próprio Android quando configurada. Após voltar ao app, o diálogo informa modo comum. |
| Envie um pedido e interrompa o acesso ao backend a partir da rede de laboratório. Em teste controlado, faça o proxy de QA descartar a resposta do POST somente depois de receber o sucesso do backend. | Totem mantém o atendimento bloqueado. Reconecte e toque **Consultar novamente**. No backend isolado, confirme a mesma chave, o mesmo payload e apenas um pedido. Registre o resultado da comparação sem copiar payload ou credenciais. Teste também com a resposta do catálogo indisponível e o acompanhamento acessível. |
| Em um segundo ensaio, encerre durante o envio ou acompanhamento com `adb shell am force-stop com.totemos.totem`, depois abra pelo ícone. Repita após reiniciar o aparelho, desbloquear e reabrir. | Mesmo atendimento é recuperado. O processo pode precisar selecionar Metro novamente no development build. A abertura automática depende da política ou do launcher do aparelho. |
| Inicie o bundle de preview com `EXPO_PUBLIC_KIOSK_PREVIEW=1` e cache limpo, sem backend. Abra o fluxo simulado. Volte ao bundle real com cache limpo. | Preview não pede ativação e usa dados simulados. O fluxo real retorna com o pareamento e o atendimento que já estavam salvos. |
| No ambiente isolado, avance o pedido pelo KDS até ENTREGUE, toque **Novo atendimento** e inicie outro pedido. | Carrinho, nome e referência do atendimento anterior somem. O dispositivo permanece pareado. |
| Revogue o token no Dashboard isolado e reabra o app. Repareie com outro código. Atualize com `adb install -r <APK-da-mesma-assinatura>` e reabra. | Token revogado bloqueia novas vendas até parear. Se houver tentativa vinculada à identidade anterior, ela permanece bloqueada para reconciliação. A atualização no lugar preserva a sessão e os dados do atendimento da identidade ativa. |

No ensaio de falha de rede, mantenha o Metro acessível via USB e use uma rota de rede separada para o backend. Para isolar a falha no POST, use o proxy do ambiente de testes ou corte a rede no ponto de acesso de laboratório. Em aparelho comum com dados móveis desligados, também é possível desligar e religar o Wi-Fi do próprio aparelho. Para confirmar perda da resposta após commit, verifique primeiro que o backend isolado recebeu e gravou o pedido.

### Executar com DPC autorizado

1. Use um dispositivo de laboratório já gerenciado por um DPC/EMM compatível. No console autorizado, aplique ao dispositivo de laboratório a política de quiosque, inclua `com.totemos.totem` na allowlist e confirme que a política foi recebida. Registre as opções de Home, recentes, notificações e inicialização da política. Verifique antes o caminho de saída que o console oferece.
2. Abra em Lock Task via DPC no Android 9 ou superior. Para testar o botão do Totem, inicie o app em modo comum em uma instalação de laboratório na tela de ativação, com o pacote já autorizado, e toque **Iniciar modo dedicado**. Confirme **Modo dedicado gerenciado ativo** no app e compare com o estado do DPC.
3. Teste Voltar e gesto de borda no fluxo. Teste Home, recentes e a barra de notificações contra o perfil aprovado. Para um perfil dedicado de um único app, confirme que esses controles não oferecem saída ao cliente. Repita a falha de rede, o encerramento do processo e a retomada com o APK independente.
4. Reinicie e confirme a recuperação do pedido. Se o perfil prevê abertura automática, verifique a abertura sob a política após o reboot e desbloqueio aplicável. Se prevê abertura manual, abra via DPC.
5. Saia pelo comando de manutenção do DPC ou remova o pacote da allowlist do perfil de laboratório, conforme o fornecedor. Confirme a saída e o comportamento de assistência se o app perder o Lock Task durante a sessão. Revogue a política de provisionamento pelo console somente no perfil de laboratório autorizado e sem limpeza do aparelho. Se o fornecedor só oferecer desinscrição com reset, registre a limitação e encerre o ensaio com a retirada da allowlist. A revogação do token comercial é uma ação separada no Dashboard. Execute o repareamento e a atualização descritos acima antes de devolver o aparelho ao laboratório.

Registre por etapa o resultado, versão e modo observado. Use o APK assinado, o perfil pretendido e o ambiente isolado para aceitar a homologação. O modo comum e a fixação podem ser ensaiados sem DPC. A autorização, as restrições do sistema, o boot configurado e a saída gerenciada exigem aparelho provisionado.

## Evidências

- RED inicial em Jest. Quatro regressões falharam antes da correção (Voltar no catálogo, recuperação com carrinho ilegível, 404 e vínculo do dispositivo). Os testes do módulo também falharam por ausência da interface. A suíte de catálogo reproduziu três casos que impediam iniciar a recuperação. O teste de sessão confirmou a ausência de cancelamento em conexão pendurada.
- A cobertura do #33 já verifica resposta perdida após commit, persistência antes do POST, concorrência, recuperação de estados operacionais, leitura inválida, encerramento durável e limpeza. Os testes do #42 exercitam a interface nativa com mocks e o fluxo real, inclusive a transição entre clientes da suíte existente.
- ADB consultado localmente. Nenhum aparelho ou emulador apareceu. A validação física de Voltar por gesto, miniatura de recentes, pinning, Lock Task, reboot e o caminho administrativo do DPC fica pendente.
- Para #40 e #41, repetir o cenário Totem → KDS → Dashboard com backend e dados de demonstração isolados. Usar duas sessões consecutivas e repetir a consulta da mesma tentativa após perda de rede. Em um aparelho gerenciado autorizado, incluir início/saída via DPC, perda de política e reinício. Registrar só estado, versão e resultados sanitizados.

| Verificação local | Resultado |
| --- | --- |
| npm ci | Concluído com o lockfile da base. |
| Expo Doctor | 20/21. A verificação de versões sinalizou oito patches do SDK 57 publicados depois das versões travadas. |
| Jest, lint e typecheck | 223 testes em 36 suítes. ESLint sem erros ou avisos via npm e Bun. TypeScript aprovado. |
| Exports Android real e preview | Aprovados com `EXPO_PUBLIC_KIOSK_PREVIEW=0` e `1`. |
| Prebuild limpo | Concluído. Manifesto mantém o Voltar preditivo desativado e as regras de backup do SecureStore. O Gradle encontrou `:totem-kiosk` pelo autolinking. |
| Gradle e APK | `:totem-kiosk:compileDebugKotlin` e `:app:assembleDebug` aprovados com JDK 21, Android SDK 36 e ABI `arm64-v8a`. APK `apps/totem/android/app/build/outputs/apk/debug/app-debug.apk`, package `com.totemos.totem` 1.0.0, SHA-256 `fda06e561991eadcff3b45714764311a686cf7f2edac128c29f33e69618d879a`. |

O fluxo de CI atual cobre exportação dos bundles. O build nativo local complementa a CI neste PR. Para mudanças futuras em `apps/totem/modules`, pode-se acrescentar um job Android filtrado por caminho que rode prebuild e compilação Kotlin, com cache Gradle.

### Revisão independente do PR #26

A revisão reproduziu três falhas de recuperação em Jest (legado sem autoria, exposição de snapshot legado e 400 após perda da resposta e reinício) e o uso de autofill na identificação real. A recuperação passou a preservar a tentativa incerta e confirmar a autoria do legado com ID antes de exibir o resultado. O caso positivo confirma a gravação do vínculo e a preservação da chave e do payload. O Jest passou de 217 para 223 testes em 36 suítes.

O APK de desenvolvimento manteve o SHA-256 indicado acima. As correções desta revisão são JavaScript e são servidas pelo Metro nesse APK. Use o bundle do HEAD revisado no APK independente de homologação.
Os exports Android foram repetidos em sequência com `--clear`. Os bundles Hermes real e preview tiveram SHA-256 `e3acb842032392798efef97e77d24b7d25566780bd6b191fa7f458f84ba18c46` e `4b9cb0db2ed7aec905a8a401d2c61e86c364511e73c8c4006aae96755a571bd8`, respectivamente.
