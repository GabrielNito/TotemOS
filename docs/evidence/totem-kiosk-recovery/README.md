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

O módulo Expo local `modules/totem-kiosk` registra o Kotlin por autolinking e sobrevive ao prebuild limpo. Usa APIs públicas `DevicePolicyManager.isLockTaskPermitted`, `ActivityManager.lockTaskModeState` e `Activity.startLockTask` na thread principal. A janela recebe `FLAG_SECURE` antes da navegação real para proteger capturas e miniaturas dos recentes. O SDK 57 usa React Native 0.86, API Android mínima 24 e compile/target SDK 36 nesta base. As APIs de detecção já existem desde a API 23.

O app consulta o estado na abertura e no retorno ao foreground. Se um Lock Task antes confirmado desaparecer durante a sessão, a tela pede assistência e preserva o estado em memória. No Android, módulo ausente ou erro ao verificar a política bloqueiam o fluxo real com opção de tentar novamente. A prévia pula a verificação nativa e redireciona a rota de ativação para seu catálogo simulado.

O modo gerenciado pode ser iniciado por ação explícita na ativação se o DPC já autorizou o pacote. Para dispositivo já pareado, o administrador pode abrir a Activity em Lock Task pelo DPC a partir do Android 9, conforme o controlador. O Totem não altera a allowlist, não solicita pinning automaticamente e não oferece saída administrativa dentro da interface pública. [Lock Task no Android](https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode) · [Fixação de app no Android](https://support.google.com/android/answer/9455138) · [Código nativo e CNG no Expo](https://docs.expo.dev/workflow/customizing/) · [Autolinking do Expo](https://docs.expo.dev/modules/autolinking/).

## Abertura, falha e recuperação

1. Verifica a janela e a política Android, então abre a rota real. A validação do token tem timeout de 20 s e encaminha à ativação só se não houver token válido.
2. Com identidade confirmada, lê a tentativa segura em paralelo com o carregamento do catálogo. Catálogo vazio, indisponível ou lento impede novas vendas enquanto o acompanhamento de uma tentativa salva continua disponível.
3. Se há resultado confirmado, retoma o mesmo acompanhamento sem ler o carrinho. Uma tentativa sem resultado mantém o payload e a chave e só é reenviada pela ação **Consultar novamente**. Timeout, 401 e 404 preservam a tentativa. HTTP 400 continua sendo o retorno definitivo de validação do contrato anterior.
4. Tentativas novas também guardam o identificador do dispositivo autenticado. Identidade diferente no mesmo negócio bloqueia a recuperação e o POST. Registros legados sem esse campo mantêm o fluxo do #33, que autentica o tenant e verifica o dispositivo no resultado. O formato antigo não permite confirmar localmente quem iniciou um POST ainda sem resultado.
5. Na saída para background, o app remove a identificação em memória e volta à espera quando está no fluxo comercial. Um pedido registrado segue no acompanhamento. Ao finalizar, mantém a limpeza durável antes de liberar outro cliente. Falha de gravação, cancelamento e estorno pendente mantêm o atendimento bloqueado para assistência.

## Suporte autorizado

1. Leia o modo do Android na ativação ou no diálogo **Como você está pedindo?**. Em aparelho comum, habilite a fixação nos ajustes e use o menu de recentes apenas com consentimento do operador. Para desfazer, use o gesto ou botões indicados pelo aparelho, com a credencial do próprio Android se configurada.
2. Em aparelho gerenciado, use o console autorizado do DPC/EMM para liberar a manutenção ou retirar o pacote da allowlist. Verifique com o fornecedor a política de Home, recentes, notificações e saída antes de colocar o aparelho em atendimento.
3. Após reiniciar o aparelho, reabra o Totem para retomar a sessão. A abertura automática depende do DPC ou launcher dedicado configurado pelo administrador, inclusive após desbloqueio quando aplicável. Um app comum está sujeito às restrições de abertura de Activity em background. [Dispositivos dedicados Android](https://developer.android.com/work/dpc/dedicated-devices/cookbook) · [Restrições de abertura em background](https://developer.android.com/guide/components/activities/secure-bal).
4. Em sessão inválida, verifique a conectividade e use **Verificar novamente**. Para trocar a credencial, o responsável abre **Dispositivos** no Dashboard, localiza o Totem e seleciona **Revogar → Confirmar revogação**. Em **Gerar código de pareamento**, selecione **Totem de autoatendimento** e digite os seis dígitos na ativação do aparelho. Se houver tentativa bloqueada, confira o pedido pelos canais autorizados do estabelecimento antes de qualquer ação que remova dados locais. O novo dispositivo precisa de um atendimento próprio depois da reconciliação.
5. Atualize por APK assinado com a mesma chave e o mesmo package via processo do administrador. Uma atualização no lugar preserva os dados locais. Desinstalação/reprovisionamento remove os dados locais e exige reconciliação prévia do atendimento, autorização do administrador e novo pareamento.
6. Development build serve para compilação e QA com Metro. Homologue a operação pública com o APK assinado e bundle incorporado, sob as políticas do aparelho de produção.

## Evidências

- RED inicial em Jest. Quatro regressões falharam antes da correção (Voltar no catálogo, recuperação com carrinho ilegível, 404 e vínculo do dispositivo). Os testes do módulo também falharam por ausência da interface. A suíte de catálogo reproduziu três casos que impediam iniciar a recuperação. O teste de sessão confirmou a ausência de cancelamento em conexão pendurada.
- A cobertura do #33 já verifica resposta perdida após commit, persistência antes do POST, concorrência, recuperação de estados operacionais, leitura inválida, encerramento durável e limpeza. Os testes do #42 exercitam a interface nativa com mocks e o fluxo real, inclusive a transição entre clientes da suíte existente.
- ADB consultado localmente. Nenhum aparelho ou emulador apareceu. A validação física de Voltar por gesto, miniatura de recentes, pinning, Lock Task, reboot e o caminho administrativo do DPC fica pendente.
- Para #40 e #41, repetir o cenário Totem → KDS → Dashboard com backend e dados de demonstração isolados. Usar duas sessões consecutivas e repetir a consulta da mesma tentativa após perda de rede. Em um aparelho gerenciado autorizado, incluir início/saída via DPC, perda de política e reinício. Registrar só estado, versão e resultados sanitizados.

| Verificação local | Resultado |
| --- | --- |
| npm ci | Concluído com o lockfile da base. |
| Expo Doctor | 20/21. A verificação de versões sinalizou oito patches do SDK 57 publicados depois das versões travadas. |
| Jest, lint e typecheck | 217 testes em 36 suítes. ESLint sem erros ou avisos via npm e Bun. TypeScript aprovado. |
| Exports Android real e preview | Aprovados com `EXPO_PUBLIC_KIOSK_PREVIEW=0` e `1`. |
| Prebuild limpo | Concluído. Manifesto mantém o Voltar preditivo desativado e as regras de backup do SecureStore. O Gradle encontrou `:totem-kiosk` pelo autolinking. |
| Gradle e APK | `:totem-kiosk:compileDebugKotlin` e `:app:assembleDebug` aprovados com JDK 21, Android SDK 36 e ABI `arm64-v8a`. APK `apps/totem/android/app/build/outputs/apk/debug/app-debug.apk`, package `com.totemos.totem` 1.0.0, SHA-256 `fda06e561991eadcff3b45714764311a686cf7f2edac128c29f33e69618d879a`. |

O fluxo de CI atual cobre exportação dos bundles. O build nativo local complementa a CI neste PR. Para mudanças futuras em `apps/totem/modules`, pode-se acrescentar um job Android filtrado por caminho que rode prebuild e compilação Kotlin, com cache Gradle.
