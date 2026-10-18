# Objetivo

Validar, em um spike isolado, se um KDS Android pode hospedar um servidor HTTP/WebSocket local e anunciar sua presença por mDNS para que um Totem Android descubra e estabeleça uma sessão diagnóstica.

O experimento não implementa transporte de pedidos, carrinho, pagamentos, fila, sincronização offline, pareamento definitivo ou autenticação produtiva.

# Ambiente

- Data da auditoria: 2026-10-14.
- Host: Linux x86_64, Omarchy 4.0.4, kernel `7.2.5-3-omarchy`.
- Node.js `v26.7.0`, npm `11.19.0`, Java OpenJDK `21.0.2`.
- `npx expo --version`: `57.0.27`.
- `npx expo-doctor`: `v1.20.4`.
- Os apps declaram Expo `~57.0.26` e React Native `0.86.3`.
- O Android SDK existe em `/home/local/Android/Sdk`, com platform-tools, build-tools `35.0.0`/`36.0.0`, plataforma `android-36`, CMake `3.22.1` e NDK `27.1.12297006`. Porém `ANDROID_HOME` e `ANDROID_SDK_ROOT` apontam para `/opt/android-sdk`, que não existe, e `sdkmanager` não está no `PATH`.
- `adb` está disponível, versão `37.0.0-android-tools`. O Galaxy A54 foi detectado como `device` no serial remoto atual `100.76.66.95:38433`; o endpoint anterior caiu durante a instalação do Totem e não foi reutilizado.
- O CNG gerou `apps/kds/android` e `apps/totem/android` apenas durante os builds. Esses diretórios são ignorados e não foram adicionados ao Git; não houve edição manual de código nativo.
- A interface Ethernet do host é `enp4s0`, com `192.168.15.3/24`. O serviço `avahi-daemon` está ativo.
- Linux possui `avahi-browse`, `avahi-resolve`, `avahi-publish-service`, `curl`, `ss`, `socat` e Node com WebSocket global. `websocat` não está instalado e o módulo Python `websockets` não está disponível.
- Não há emulador disponível. Foi executado o cenário físico KDS Android ↔ Linux. O Totem foi instalado e executou a descoberta mDNS no cenário Android ↔ Linux, mas HTTP/WS ficaram bloqueados pelo acesso TCP ao host.
- As referências `docs/stack-detalhada-v1.md` e `docs/regras-de-negocio-totem.md`, mencionadas pelas SPECs, não existem neste checkout. Seu conteúdo não foi inferido.

Foram consultadas as documentações oficiais [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Build Properties do SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/), [configuração do app](https://docs.expo.dev/workflow/configuration/), [development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/) e [configuração de projetos nativos](https://docs.expo.dev/workflow/customizing/).

# Bibliotecas avaliadas

## `react-native-nitro-http-server@1.10.0`

- O pacote é o `latest` no metadata consultado, publicado em 2026-09-22. Fontes: [npm](https://www.npmjs.com/package/react-native-nitro-http-server) e [repositório oficial](https://github.com/iwater/react-native-nitro-http-server).
- As declarações instaladas confirmam `ConfigServer.onWebSocket(path, handler)`, `start(port, handler, config, hostOrOptions)`, `stop()` e `ServerWebSocket` com `onmessage`, `onclose`, `send` e `close`.
- O README oficial documenta WebSocket por meio de `ConfigServer`, portanto o spike não inferiu WebSocket apenas da existência de HTTP.
- O peer nativo exige `react-native-nitro-modules@^0.35.0`. O lockfile resolveu `react-native-nitro-modules@0.35.10`, `react-native-nitro-buffer@0.3.0` e `eventemitter3@5.0.4`.
- O Android do pacote usa CMake/C++20, NDK padrão `27.1.12297006`, `minSdkVersion` padrão 21 e autolinking. O pacote não possui config plugin próprio.
- O README informa Android sem configuração extra e iOS com Pods. Isso não substitui a confirmação de build nativo no projeto.
- Não existe matriz oficial específica para Expo SDK 57 e React Native 0.86.3. A compatibilidade fica `INCONCLUSIVE` até o development client carregar o módulo em Android.

## `react-native-zeroconf@1.0.0-rc.2`

- É uma release candidate publicada no dist-tag `next`; o dist-tag `latest` consultado aponta para `0.17.6`. Fontes: [npm](https://www.npmjs.com/package/react-native-zeroconf) e [repositório oficial](https://github.com/Apercu/react-native-zeroconf).
- A release instalada declara peer `react-native >=0.82`, `codegenConfig` para a New Architecture e suporte a Expo development builds no README.
- As declarações e a implementação instaladas confirmam `publishService(options)`, `unpublishService(name)`, `scan(options)`, `stop(implType?)`, `subscribe(event, listener)` e `removeDeviceListeners()`.
- O adapter usa as formas por objeto exigidas pela versão 1.0.0-rc.2. Não usa as formas posicionais antigas.
- O manifest Android da própria biblioteca declara `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` e `CHANGE_WIFI_MULTICAST_STATE`. O código Android da biblioteca adquire e libera `WifiManager.MulticastLock` enquanto scans, resoluções ou publicações estão ativos.
- O adapter usa o caminho Android NSD padrão. A alternativa DNSSD existe na biblioteca, mas não foi trocada silenciosamente neste spike.
- O pacote possui `minSdkVersion` padrão 24 no módulo Android. A resolução de endereço, permissões e comportamento do NSD continuam sem confirmação em aparelho real.

## `expo-build-properties@57.0.22`

- É usado apenas como config plugin nos app configs.
- Com `TOTEMOS_LAN_SPIKE` ausente, o plugin de cleartext não entra na configuração resolvida e `extra.lanSpikeEnabled` é `false`.
- Com `TOTEMOS_LAN_SPIKE=1`, a configuração resolvida contém `usesCleartextTraffic: true` e `extra.lanSpikeEnabled: true`.
- A propriedade `usesCleartextTraffic` é documentada na página versionada do SDK 57. Não há edição manual permanente em `android/` ou `ios/`.
- A flag runtime também exige `__DEV__`. Assim, uma rota acessada diretamente em um dev client normal não inicia servidor, publicação, scan ou conexão experimental.

# Expo dependency diagnostics

Os comandos foram executados novamente nos dois apps. O `expo-doctor --verbose` retornou `20/21 checks passed` e exit `1`. O `expo install --check` retornou exit `1`. As diferenças abaixo já estavam em `origin/develop`, que tem o mesmo SHA base deste worktree. Não foi feito upgrade amplo para silenciar a ferramenta.

| Pacote | KDS, instalado / esperado | Totem, instalado / esperado | Diferença contra `origin/develop` | Classificação | Origem |
| --- | --- | --- | --- | --- | --- |
| `expo` | `57.0.26 / ~57.0.28` | `57.0.26 / ~57.0.28` | Declaração e lock já iguais à base | `PREEXISTING` | `expo-doctor`/Expo CLI |
| `expo-constants` | `57.0.20 / ~57.0.21` | `57.0.20 / ~57.0.21` | Declaração e lock já iguais à base | `PREEXISTING` | metadata Expo SDK 57 |
| `expo-dev-client` | `57.0.19 / ~57.0.20` | `57.0.19 / ~57.0.20` | Declaração e lock já iguais à base | `PREEXISTING` | metadata Expo SDK 57 |
| `expo-linking` | `57.0.11 / ~57.0.12` | `57.0.11 / ~57.0.12` | Declaração e lock já iguais à base | `PREEXISTING` | metadata Expo SDK 57 |
| `expo-router` | `57.0.24 / ~57.0.26` | `57.0.24 / ~57.0.26` | Declaração e lock já iguais à base | `PREEXISTING` | metadata Expo SDK 57 |
| `expo-splash-screen` | `57.0.9 / ~57.0.10` | `57.0.9 / ~57.0.10` | Declaração e lock já iguais à base | `PREEXISTING` | metadata Expo SDK 57 |
| `jest-expo` | `57.0.6 / ~57.0.6`, sem divergência | `57.0.5 / ~57.0.6` | No KDS foi adicionado o runner, mas o lock resolveu a versão compatível; no Totem já existia na base | `PREEXISTING` no gate Totem; `NEW_REGRESSION` não observada no KDS | metadata Expo SDK 57 |

As verificações pedidas para os pacotes relacionados ao SDK 57 deram o seguinte resultado:

| Pacote | KDS | Totem | Conclusão |
| --- | --- | --- | --- |
| `react-native` | `0.86.3` | `0.86.3` | sem divergência reportada |
| `react-native-gesture-handler` | `2.32.0` | `2.32.0` | sem divergência reportada; o falso positivo histórico não apareceu |
| `react-native-reanimated` | `4.5.1` | `4.5.1` | sem divergência reportada |
| `react-native-worklets` | `0.10.1` | `0.10.1` | sem divergência reportada |
| `expo-build-properties` | `57.0.22` | `57.0.22` | sem divergência reportada |
| `react-native-nitro-http-server` | `1.10.0` | não usado | não aparece como mismatch do Doctor; ainda requer build nativo |
| `react-native-zeroconf` | `1.0.0-rc.2` | `1.0.0-rc.2` | não aparece como mismatch do Doctor; ainda requer build nativo |

Saída efetiva relevante do Doctor no KDS:

```text
expo-doctor: v1.20.4
20/21 checks passed. 1 checks failed.
✖ Check that packages match versions required by installed Expo SDK
expo ~57.0.28 found 57.0.26
expo-constants ~57.0.21 found 57.0.20
expo-dev-client ~57.0.20 found 57.0.19
expo-linking ~57.0.12 found 57.0.11
expo-router ~57.0.26 found 57.0.24
expo-splash-screen ~57.0.10 found 57.0.9
6 packages out of date.
1 check failed, indicating possible issues with the project.
exit=1
```

No Totem, a mesma saída contém também:

```text
jest-expo ~57.0.6 found 57.0.5
7 packages out of date.
exit=1
```

Saída efetiva do `expo install --check` no KDS:

```text
The following packages should be updated for best compatibility with the installed expo version:
  expo@57.0.26 - expected version: ~57.0.28
  expo-constants@57.0.20 - expected version: ~57.0.21
  expo-dev-client@57.0.19 - expected version: ~57.0.20
  expo-linking@57.0.11 - expected version: ~57.0.12
  expo-router@57.0.24 - expected version: ~57.0.26
  expo-splash-screen@57.0.9 - expected version: ~57.0.10
Your project may not work correctly until you install the expected versions of the packages.
Found outdated dependencies
exit=1
```

No Totem, o mesmo texto contém adicionalmente `jest-expo@57.0.5 - expected version: ~57.0.6`.

Conclusão dos gates G7 a G10: os quatro continuam `FAIL` no comando automatizado, mas a causa é `PREEXISTING`, não uma regressão do spike. Não há evidência para classificar o caso como `TOOLING_FALSE_POSITIVE`; também não há `NEW_REGRESSION` nos pacotes adicionados pelo card. O estado do gate permanece `UNRESOLVED` até uma decisão separada sobre a atualização da base Expo.

# Arquitetura experimental

No KDS:

1. `createNativeKdsLanServer` adapta `ConfigServer` do Nitro HTTP.
2. A porta padrão explícita é `43210`; o host é `0.0.0.0`.
3. `GET /_spike/health` responde somente protocolo, versão e `status: ok`.
4. `/_spike/ws` recebe o handler WebSocket experimental.
5. O serviço é publicado como `_totemos-kds._tcp.local.` com TXT de protocolo e versão.
6. O stop encerra HTTP, conexões WebSocket, anúncio mDNS e listeners.

No Totem:

1. `createNativeDiscoveryBackend` adapta uma instância de Zeroconf.
2. O scan filtra `totemos-kds/tcp/local.` e seleciona somente TXT compatível, porta válida e endereço resolvido.
3. O cliente consulta health por HTTP antes de abrir WebSocket.
4. O cliente executa handshake, envia diagnóstico, expõe os estados requeridos e faz retry exponencial limitado.
5. A rota `/spike` não está ligada à navegação produtiva.

Sem `TOTEMOS_LAN_SPIKE=1`, a rota pode existir no bundle do Router, mas fica funcionalmente inacessível: mostra apenas que o diagnóstico está desabilitado. Não cria servidor, não publica mDNS, não inicia scan e não abre conexão. O mesmo bloqueio ocorre fora de `__DEV__`, mesmo que a configuração experimental tenha sido carregada. A execução nativa exige rebuild do development client, como documentado pelo Expo para bibliotecas nativas.

# Protocolo diagnóstico

Health:

```json
{
  "protocol": "totemos-lan-spike",
  "version": 1,
  "status": "ok"
}
```

Handshake fictício:

```json
{
  "type": "handshake",
  "protocolVersion": 1,
  "negocioId": "tenant-a"
}
```

O KDS responde `handshake_ack` somente quando versão e `negocioId` configurado coincidem. Depois disso, aceita somente mensagens `diagnostic` e responde `diagnostic_ack`. JSON inválido, versão desconhecida e tenant diferente são rejeitados antes de qualquer mensagem de aplicação.

O `negocioId` enviado pelo cliente é fictício e não prova identidade. Comparação de strings não é autenticação e não deve ser promovida para produção.

# Matriz de experimentos

| Experimento | Resultado | Evidência | Limitação |
| --- | --- | --- | --- |
| A. HTTP | `UNIT_PASS`; `NATIVE_PASS` KDS ↔ Linux; `NATIVE_PASS` Totem ↔ Windows | KDS Android respondeu `200`/`404` no cenário Linux. No Windows, o Totem acessou `192.168.15.3:43210` diretamente pela LAN: `200` em `/_spike/health` e `404` em rota inexistente, confirmados por `toybox nc` no próprio Android | o fixture Windows foi temporário e não substitui um KDS Android real |
| B. WebSocket | `UNIT_PASS`; `NATIVE_PASS` KDS ↔ Linux e Totem ↔ Windows; fechamento voluntário `FAIL` | Totem recebeu `handshake_ack`, enviou diagnóstico e recebeu `diagnostic_ack`. O fixture respondeu `TENANT_MISMATCH` para `tenant-b`. A queda abrupta separada produziu `1006` no fixture e reconexão do Totem | `1006` após queda abrupta é esperado e não é ack de protocolo. `close(1000)` no cliente continua produzindo erro seguido de `1006`, `wasClean=false`; o teste não cobre TLS ou autenticação produtiva |
| C. mDNS | `UNIT_PASS`; `NATIVE_PASS` KDS ↔ Linux, Totem ↔ Linux e Totem ↔ Windows | Zeroconf Android encontrou o serviço Windows `_totemos-kds._tcp` com TXT compatível, resolveu `192.168.15.3` e a UI exibiu `192.168.15.3:43210` | o Windows não tinha `dns-sd`/`avahi-browse`; o fixture usou um publisher mDNS temporário em Node, sem dependência nova |
| D. Isolamento de tenant | `UNIT_PASS`; `NATIVE_PASS` KDS ↔ Linux e Totem ↔ Windows | `tenant-b` recebeu `handshake_rejected` com `TENANT_MISMATCH` no KDS e no Totem, sem `diagnostic_ack` após a rejeição | não é autenticação e usou identificadores fictícios |
| E. Recuperação | `UNIT_PASS`; `NATIVE_PASS` KDS e Totem | O Totem entrou em retry quando o fixture foi parado e voltou a `conectado` após o restart, sem reinstalação. O experimento separado de `terminate()` também reconectou | não cobre troca de Wi-Fi, background ou dois dispositivos |
| F. Estabilidade | `NATIVE_PASS` Totem ↔ Windows | sessão observada por 15 minutos, final `conectado`, HTTP `ok`, `diagnostic_ack` e `Retry: 0` | não cobre troca de Wi-Fi, tela bloqueada ou background |
| G. Fechamento WebSocket voluntário | `FAIL` | `close(1000, ...)` produziu erro seguido de `CLOSE 1006`, motivo vazio e `wasClean=false`; a queda abrupta separada também produziu 1006, mas essa parte é o comportamento esperado | o impacto é a ausência de evidência de encerramento limpo no caminho iniciado pelo cliente; hipótese atual é falha/race no adaptador nativo ou na sequência de fechamento, sem evidência suficiente para alterar a implementação |

Separação por alvo:

- Testes unitários/simulados: `UNIT_PASS`.
- Emulador Android: `NOT_TESTED`, nenhum AVD foi verificado ou iniciado.
- KDS Android nativo: `PASS` nos experimentos comprovados no Galaxy A54, incluindo KDS ↔ Linux e KDS ↔ Windows durante a validação do servidor.
- Totem Android contra Windows: `PASS` para mDNS, HTTP LAN, WebSocket, `TENANT_MISMATCH`, reconexão e estabilidade de 15 minutos. A rodada histórica Totem ↔ Linux permanece documentada como `BLOCKED` pelo bloqueio TCP do host.
- Reconexão e estabilidade inicial: `PASS` nos cenários executados.
- Teste nativo final KDS Android ↔ Totem Android: `NOT_TESTED`.
- Fechamento WebSocket voluntário: `FAIL`; fechamento 1006 após queda abrupta: `PASS` como reprodução do comportamento esperado.
- Gates de dependências Expo G7-G10: `FAIL` preexistente, sem alteração de dependências para silenciar a ferramenta.

# Evidências

- KDS: 5 suites, 17 testes, `UNIT_PASS`.
- Totem: 7 suites, 21 testes, `UNIT_PASS`.
- Lint KDS e Totem: `PASS`.
- Typecheck KDS e Totem: `PASS`.
- Export Metro Android KDS e Totem: `PASS`. Isso não equivale a build Android nativo.
- O APK Totem existente foi localizado em `apps/totem/android/app/build/outputs/apk/debug/app-debug.apk`, com `applicationId=com.totemos.totem`, e instalado no `SM-A546E` com resultado `Success`.
- Na rodada histórica Linux, o Totem carregou `/spike`, iniciou Zeroconf Android e descobriu o fixture, mas o health terminou em `Timeout ao consultar health do KDS` por bloqueio TCP. Na rodada Windows posterior, o Totem concluiu HTTP, WebSocket, tenant, reconexão e estabilidade contra o fixture Windows.
- O cleanup de foco do KDS foi validado no dispositivo: fechamento de servidor `1001/server stopped/wasClean=true`, porta fechada e anúncio mDNS removido. O fechamento de cliente continuou `1006/wasClean=false`.
- `expo config --type public --json`: sem a variável, `lanSpikeEnabled=false`, sem `expo-build-properties` e sem cleartext; com a variável, `lanSpikeEnabled=true` e `usesCleartextTraffic=true`.
- `npx expo-doctor --verbose` e `npx expo install --check`: `FAIL` por deriva de patches preexistente, documentada acima.
- Não foram inventados latência, estabilidade, tempo de descoberta ou taxa de desconexão.

# Execução nativa observada

- Dispositivo: Samsung Galaxy A54 `SM-A546E`, Android 16/API 36, `arm64-v8a`, Wi-Fi `192.168.15.5/24`.
- Host: Linux `192.168.15.3/24`, Ethernet `enp4s0`; ping entre os endereços teve 0% de perda.
- O KDS carregou o development client pelo IP Tailscale do host apenas para obter o bundle JS. HTTP, WebSocket e mDNS do spike usaram o IP LAN `192.168.15.5`.
- HTTP observado pelo Linux: `{"protocol":"totemos-lan-spike","version":1,"status":"ok"}`.
- mDNS observado pelo Linux: hostname `Android_JR44Z2W5.local`, endereço `192.168.15.5`, porta `43210`, TXT `protocol=totemos-lan-spike` e `version=1`.
- WebSocket compatível: `handshake_ack` e `diagnostic_ack` observados.
- WebSocket incompatível: `handshake_rejected` com `TENANT_MISMATCH`, fechamento `1008` e motivo `TENANT_MISMATCH`.
- Fechamento voluntário iniciado pelo cliente Linux, após `close(1000, ...)`, observou erro e fechamento `1006`, motivo vazio e `wasClean=false`. A causa continua inconclusiva, sem conversão artificial para sucesso.
- Após a correção mínima de ciclo de vida, navegar de `/spike` para `/parear` chamou `server.stop()`: o cliente recebeu `1001`, motivo `server stopped` e `wasClean=true`; a porta deixou de aceitar TCP e o anúncio mDNS desapareceu.
- Após `am force-stop com.totemos.kds`, o cliente recebeu `1006`, sem motivo e `wasClean=false`, como queda abrupta. Reabrir o development client e `/spike` restaurou o health e a publicação.
- O ADB atual foi `100.76.66.95:38433`, estado `device`. O APK Totem existente foi instalado com `adb install -r` e retornou `Success`. O bundle Metro usou Tailscale somente para carregamento do JavaScript.
- No Totem, o Zeroconf Android encontrou `TotemOS Linux Spike`, a UI exibiu `Servidor: 192.168.15.3:43210` e `Erro: Timeout ao consultar health do KDS`. O ping `192.168.15.5 → 192.168.15.3` teve 0% de perda, enquanto `toybox nc` para `192.168.15.3:43210` expirou com listener em `0.0.0.0`.
- O UFW está ativo, mas `ufw status verbose` exigiu root e `sudo -n ufw status verbose` exigiu senha. Nenhuma regra, firewall ou roteador foi alterado. A evidência é compatível com bloqueio de entrada no host, mas a tabela efetiva de regras não foi lida.
- Na rechecagem, o Linux continuou em `enp4s0=192.168.15.3/24` e o Galaxy em `wlan0=192.168.15.5/24`, com rota direta e ping bidirecional. Sem fixture não havia listener; com o fixture, `ss` confirmou `0.0.0.0:43210` e `curl http://192.168.15.3:43210/_spike/health` retornou `200`. O `toybox nc` do Galaxy para o mesmo endereço e porta expirou, enquanto o Avahi anunciou `192.168.15.3:43210` com TXT esperado.
- A regra mínima pendente de autorização é `sudo ufw allow from 192.168.15.5 to 192.168.15.3 port 43210 proto tcp`. O estado efetivo das regras não foi registrado por falta de privilégio, e a regra não foi executada nem duplicada.

# Permissões, ciclo de vida e limitações nativas

- `INTERNET` é necessário para o cliente HTTP/WebSocket. A permissão deve ser conferida no manifest final do development build.
- `CHANGE_WIFI_MULTICAST_STATE` e as permissões de estado de rede estão declaradas pelo manifest do Zeroconf. A própria biblioteca controla `MulticastLock` durante operações ativas.
- O adapter não implementa serviço Android permanente nem mantém lock global.
- A versão instalada também documenta `ACCESS_LOCAL_NETWORK` para Android API 37 quando aplicável. O adapter não chama `checkLocalNetworkAccess`; esse caso precisa ser verificado no aparelho alvo antes de qualquer decisão futura.
- Mesma sub-rede, ausência de client isolation, firewall permitindo TCP 43210, resolução de endereço e multicast funcional são pré-condições.
- O servidor fica em foreground durante o spike. Não há alegação de funcionamento após tela bloqueada, background, Doze, troca de Wi-Fi ou handoff de mesh.
- O manifest debug gerado confirmou `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE` e `usesCleartextTraffic=true` somente no build experimental. O autolinking gerado incluiu Nitro, Nitro HTTP Server e Zeroconf.
- A flag de cleartext continua condicionada a `TOTEMOS_LAN_SPIKE=1`; isso não aprova cleartext em release.
- As rotas diagnósticas KDS e Totem usam `useFocusEffect`; o cleanup do KDS foi observado ao perder foco. O servidor continua restrito a foreground e o Totem ainda não teve HTTP/WS nativos concluídos.
- O fechamento iniciado pelo cliente continua observando `1006`, mesmo quando solicita `close(1000)`; permanece `FAIL` e não foi convertido em sucesso. O fechamento de servidor após cleanup de foco observou `1001` limpo. Impacto: o caminho voluntário não demonstra handshake de encerramento limpo e pode gerar erro/reconexão ruidosa. Hipótese técnica atual: adaptador WebSocket nativo ou race na sequência de fechamento. Correção futura exige reprodução mínima com captura dos frames/FIN e logs nativos antes de qualquer alteração.

# Scope audit

O diff rastreado contra `origin/develop` contém 7.539 inserções e 4.159 remoções. A revisão do worktree também incluiu os 31 arquivos não rastreados do spike, testes e documentação:

| Área | Mudança medida | Motivo |
| --- | ---: | --- |
| `apps/kds/package-lock.json` | +7.471 / -4.154 | Jest/jest-expo para o runner solicitado e dependências transitivas dos módulos nativos; o lockfile também sofreu normalização de árvore pelo npm |
| `apps/kds/package.json` | +12 / -2 | módulos nativos, runner mínimo e script de teste |
| `apps/kds/tsconfig.json` | +2 / -1 | tipos Jest para os testes do KDS |
| `apps/totem/package-lock.json` | +51 / -1 | Zeroconf e `expo-build-properties`, com dependências transitivas pequenas |
| `apps/totem/package.json` | +3 / -1 | Zeroconf e config plugin |

O lockfile KDS passou de 941 para 1.174 entradas de pacote, 233 entradas novas. A maior parte é a árvore do Jest/jest-expo; também entram Nitro, buffer, módulos Nitro, Zeroconf e Build Properties. O lockfile Totem passou de 1.167 para 1.171 entradas, quatro novas.

Há 31 arquivos não rastreados, totalizando 2.749 linhas na medição atual, antes dos artefatos CNG. Eles são os adapters, protocolos, testes, duas rotas isoladas, dois app configs, este relatório e `GATES.md`. Os diretórios `android/`, `.cxx`, Gradle e APKs gerados pelo prebuild/build estão ignorados e não entram no status. Não há backend, Prisma, pedidos, pagamentos ou Dashboard. Não foram encontrados credenciais, tokens reais ou configurações persistentes do Windows. IPs locais e caminhos Windows aparecem somente como evidência datada ou fixture de teste; não são configuração do runtime. As duplicações de protocolo entre KDS e Totem são deliberadas, pois cada app precisa validar sua borda sem importar código produtivo do outro. A alteração adicional desta rodada ficou restrita ao cleanup de foco das duas rotas diagnósticas. Não foi removido código diagnóstico necessário para reduzir contagem.

# Alternativas avaliadas

- Android NSD diretamente: é a API oficial DNS-SD, mas exigiria outra ponte nativa. O spike usa Zeroconf para manter a menor superfície experimental.
- Zeroconf estável `0.17.x`: existe, mas a dependência escolhida no card é a release candidate `1.0.0-rc.2`, que declara RN >=0.82 e a API por objeto usada neste adapter. Não houve troca silenciosa.
- DNSSD embutido no Zeroconf: existe como alternativa para problemas de NSD, mas o spike mantém o padrão NSD e deixa a decisão para evidência do aparelho.
- `react-native-dnssd` e transporte alternativo: não apresentaram evidência melhor dentro do card e não foram introduzidos.

# Decisão técnica

**INCONCLUSIVE.**

A viabilidade dos componentes foi demonstrada nos cenários nativos comprovados, mas a integração direta KDS Android ↔ Totem Android não foi validada e o fechamento voluntário continua `FAIL`. Portanto a arquitetura não pode ser declarada `VIABLE`; também não há evidência para `NOT_VIABLE`. O estado global permanece `INCONCLUSIVE`.

# One-device procedure

Esta etapa valida partes dos dois adapters com um telefone Android e o host Linux na mesma LAN. O computador deve estar na Ethernet `enp4s0` e o telefone no Wi-Fi da mesma sub-rede. Ela não substitui o teste KDS Android ↔ Totem Android.

## Pré-requisitos sem instalar nada

No Linux:

```bash
ip -brief addr
ip route
systemctl is-active avahi-daemon
for tool in avahi-browse avahi-resolve avahi-publish-service curl ss node; do command -v "$tool"; done
node -e 'console.log(process.version, typeof WebSocket)'
```

Resultado esperado: uma interface Ethernet e uma rota para a mesma sub-rede do telefone, `avahi-daemon` ativo, os três comandos Avahi, `curl` e Node disponíveis. `websocat` não é obrigatório porque Node 26 fornece cliente WebSocket global.

## Etapa A, KDS no Android e Linux como cliente

1. Em uma máquina com SDK Android e um telefone conectado, gere ou use um development client experimental do KDS. O comando local, quando o SDK existir, é:

   ```bash
   cd apps/kds
   TOTEMOS_LAN_SPIKE=1 npx expo run:android --device
   ```

   A biblioteca nativa foi adicionada, portanto o client precisa ser reconstruído. Não usar Expo Go.

2. Abra manualmente `/spike` no KDS e mantenha a tela em foreground. Registre a versão Android, a porta e os logs do app.

3. No Linux, descubra o serviço:

   ```bash
   avahi-browse -rt _totemos-kds._tcp
   ```

   Resultado esperado: `TotemOS KDS Spike`, tipo `_totemos-kds._tcp`, domínio `local.`, porta `43210` e um hostname resolvível. Use `avahi-resolve -n <hostname.local>` para obter o endereço.

4. Consulte health sem dados reais:

   ```bash
   curl --fail --show-error --silent \
     'http://<IP_DO_KDS>:<PORTA>/_spike/health'
   ```

   Resultado esperado:

   ```json
   {"protocol":"totemos-lan-spike","version":1,"status":"ok"}
   ```

5. Abra o WebSocket usando apenas Node, sem instalar cliente adicional:

   ```bash
   KDS_IP=<IP_DO_KDS> KDS_PORT=<PORTA> node <<'NODE'
   const url = `ws://${process.env.KDS_IP}:${process.env.KDS_PORT}/_spike/ws`;
   const socket = new WebSocket(url);
   const fail = message => {
     console.error(message);
     process.exitCode = 1;
     socket.close();
   };

   socket.onopen = () => socket.send(JSON.stringify({
     type: 'handshake',
     protocolVersion: 1,
     negocioId: 'tenant-a',
   }));

   socket.onmessage = event => {
     const message = JSON.parse(String(event.data));
     console.log(message);
     if (message.type === 'handshake_ack') {
       socket.send(JSON.stringify({ type: 'diagnostic', id: 'linux-client-1' }));
     } else if (message.type === 'diagnostic_ack') {
       if (message.id !== 'linux-client-1' || message.status !== 'ok') {
         fail('diagnostic_ack inválido');
         return;
       }
       socket.close(1000, 'done');
     } else if (message.type === 'handshake_rejected' || message.type === 'error') {
       fail(`resposta inesperada: ${JSON.stringify(message)}`);
     }
   };

   socket.onerror = () => fail('erro no WebSocket');
   setTimeout(() => fail('timeout do WebSocket'), 5000);
   NODE
   ```

   Resultado esperado: `handshake_ack`, depois `diagnostic_ack` com `id=linux-client-1` e `status=ok`, seguido de fechamento limpo.

6. Para validar a rejeição nativa do KDS, repita o cliente com `negocioId: 'tenant-b'`. Resultado esperado: `handshake_rejected` com `TENANT_MISMATCH`, sem `diagnostic_ack`.

## Etapa B, Totem no Android e Linux como servidor diagnóstico

1. O Linux precisa servir simultaneamente health HTTP e WebSocket na porta anunciada. Abaixo está um fixture temporário, sem arquivo do projeto e sem dependência nova. Ele usa o `ws` transitivo já instalado pelo runner de testes do KDS, somente para o experimento. Execute em `apps/kds` e encerre com `Ctrl-C`:

   ```bash
   cd apps/kds
   node <<'NODE'
   const http = require('node:http');
   const { Server: WebSocketServer } = require('ws');

   const port = 43210;
   const protocol = 'totemos-lan-spike';
   const tenant = process.env.SPIKE_TENANT || 'tenant-a';
   const httpServer = http.createServer((request, response) => {
     console.log(`HTTP ${request.method} ${request.url}`);
     if (request.method === 'GET' && request.url === '/_spike/health') {
       response.writeHead(200, { 'content-type': 'application/json' });
       response.end(JSON.stringify({ protocol, version: 1, status: 'ok' }));
       return;
     }
     response.writeHead(404);
     response.end('Not found');
   });

   const webSocketServer = new WebSocketServer({ server: httpServer, path: '/_spike/ws' });
   webSocketServer.on('connection', socket => {
     let authorized = false;
     socket.on('message', raw => {
       let message;
       try {
         message = JSON.parse(String(raw));
       } catch {
         socket.send(JSON.stringify({ type: 'handshake_rejected', code: 'INVALID_MESSAGE' }));
         socket.close(1008, 'INVALID_MESSAGE');
         return;
       }

       if (!authorized) {
         if (message.type !== 'handshake' || message.protocolVersion !== 1) {
           socket.send(JSON.stringify({ type: 'handshake_rejected', code: 'UNSUPPORTED_PROTOCOL' }));
           socket.close(1008, 'UNSUPPORTED_PROTOCOL');
           return;
         }
         if (message.negocioId !== tenant) {
           socket.send(JSON.stringify({ type: 'handshake_rejected', code: 'TENANT_MISMATCH' }));
           socket.close(1008, 'TENANT_MISMATCH');
           return;
         }
         authorized = true;
         socket.send(JSON.stringify({ type: 'handshake_ack', protocol, version: 1 }));
         return;
       }

       if (message.type !== 'diagnostic' || typeof message.id !== 'string') {
         socket.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE' }));
         return;
       }
       socket.send(JSON.stringify({ type: 'diagnostic_ack', id: message.id, status: 'ok' }));
     });
   });

   httpServer.listen(port, '0.0.0.0', () => {
     console.log(`fixture listening on 0.0.0.0:${port}, tenant=${tenant}`);
   });
   const shutdown = () => webSocketServer.close(() => httpServer.close(() => process.exit(0)));
   process.on('SIGINT', shutdown);
   process.on('SIGTERM', shutdown);
   NODE
   ```

2. Em outro terminal Linux, publique o serviço compatível:

   ```bash
   avahi-publish-service -v \
     'TotemOS Linux Spike' _totemos-kds._tcp 43210 \
     protocol=totemos-lan-spike version=1
   ```

3. Em uma máquina com SDK Android e o telefone conectado, gere ou use um development client experimental do Totem:

   ```bash
   cd apps/totem
   TOTEMOS_LAN_SPIKE=1 npx expo run:android --device
   ```

4. Antes de testar HTTP/WS, autorize temporariamente somente a origem do Galaxy e a porta do fixture, se a inspeção do UFW confirmar o bloqueio:

   ```bash
   sudo ufw allow from 192.168.15.5 to 192.168.15.3 port 43210 proto tcp
   ```

   A regra exige autorização explícita e deve ser removida ao terminar:

   ```bash
   sudo ufw delete allow from 192.168.15.5 to 192.168.15.3 port 43210 proto tcp
   ```

   Não desabilite o UFW nem libere a sub-rede inteira. O teste desta rodada não executou esses comandos.

5. Abra `/spike` no Totem. Resultado esperado: `procurando_servidor`, `servidor_encontrado`, `conectando`, `conectado`, health `ok`, `handshake_ack` e `diagnostic_ack` no fixture.

6. Para validar a rejeição do Totem, encerre o fixture e reinicie-o com `SPIKE_TENANT=tenant-b`. Resultado esperado: o Totem encontra o serviço, mas exibe erro `TENANT_MISMATCH` e não há troca de diagnóstico após a rejeição.

7. Encerre e reinicie o fixture. O Totem deve detectar a queda, entrar em retry e reconectar sem reiniciar o app quando o mesmo serviço voltar.

Nesta execução, o endereço e as mensagens de descoberta foram registrados, mas HTTP, WebSocket, tenant mismatch no Totem, reconexão e duração de estabilidade ficaram `BLOCKED` ou `NOT_TESTED` pela porta TCP do host. Não foram inventados tempos.

# Execução final com dois Androids físicos

Depois da etapa com um telefone, repetir com KDS e Totem em dois Androids físicos na mesma Wi-Fi:

1. construir os dois development clients com `TOTEMOS_LAN_SPIKE=1`;
2. abrir o KDS em foreground e registrar publicação mDNS;
3. abrir o Totem e registrar descoberta, health, WebSocket e diagnóstico;
4. repetir com `tenant-a` compatível;
5. usar um cliente ou build experimental com `tenant-b` para confirmar rejeição no KDS e no Totem;
6. desligar o KDS, registrar indisponibilidade, religá-lo e confirmar redescoberta sem reiniciar o Totem;
7. manter a sessão pelo período definido pelo responsável, registrando desconexões;
8. repetir com troca de Wi-Fi, tela bloqueada e retorno ao foreground separadamente, sem tratar foreground como evidência de background.

# Riscos

- As duas bibliotecas nativas requerem rebuild do development client.
- O KDS e o Totem compilaram no host com Nitro/NDK/CMake/Gradle e foram instalados no Galaxy A54; o KDS foi validado nativamente e o Totem passou contra o fixture Windows. A integração direta entre os dois Androids não foi executada.
- Zeroconf é release candidate, apesar da API instalada ser coerente com o adapter.
- Android NSD pode falhar por OEM, versão, client isolation, Doze, troca de rede ou multicast filtrado.
- HTTP/WS sem TLS e `negocioId` fictício não são segurança de produção.
- O servidor não deve ser mantido em background sem desenho específico de serviço Android.
- A compatibilidade do Nitro HTTP com RN 0.86.3 teve execução nativa no KDS, e a estabilidade inicial do cliente Totem foi observada contra o fixture Windows. Isso ainda não cobre dois Androids nem o fechamento voluntário limpo.

# Instruções de reprodução dos gates JavaScript

```bash
cd apps/kds && npm ci && npm test -- --runInBand && npm run lint && npm run typecheck
cd ../totem && npm ci && npm test -- --runInBand && npm run lint && npm run typecheck
```

O export Metro usado neste spike foi:

```bash
export_dir=$(mktemp -d)
npx expo export --platform android --output-dir "$export_dir"
```

O export valida o bundle JavaScript e não substitui `npx expo run:android` ou outro build nativo.

# Próximos passos

1. Não instalar Android Emulator neste computador, não adquirir hardware adicional e não alterar a arquitetura experimental nesta etapa.
2. Manter `KDS Android ↔ Totem Android` como `NOT_TESTED`; só executar essa matriz se houver dois Androids físicos disponíveis em uma mesma LAN, sem tratar emulador ou túnel como substituto de evidência física.
3. Manter o fechamento voluntário como `FAIL` até uma investigação específica com captura de frames WebSocket, FIN/close handshake e logs do adaptador nativo. Não alterar a implementação por hipótese.
4. Reavaliar os gates de dependências Expo em decisão separada, sem atualizar dependências como parte deste card.
5. O handshake fictício deve ser substituído pelo contrato de pareamento/deviceToken de outro card antes de qualquer uso produtivo.

# Decisão

## Tentativa de build nativo KDS no Windows

Em 17/10/2026, no worktree `C:/Users/Nito/www/worktrees/TotemOS-kds-lan-spike-win`, a sessão PowerShell foi configurada com Java 17 e o Android SDK local. O comando `adb devices -l` retornou somente `List of devices attached`, sem serial, modelo, API ou ABI.

Como o Galaxy A54 não estava no estado `device`, a execução foi interrompida antes de `npx expo run:android --device`. Não houve download Gradle, autolinking, compilação, instalação de APK, abertura de `/spike` ou teste HTTP, mDNS e WebSocket nesta tentativa. Nenhuma regra do Firewall do Windows foi alterada, nenhum ADB reverse, Tailscale, emulador, atualização de dependência ou mudança de configuração permanente foi utilizado.

Resultado desta tentativa: **BLOCKED**, aguardando conexão USB, depuração USB habilitada e autorização da chave RSA no Galaxy A54.

O aparelho foi posteriormente pareado por Wireless Debugging em `192.168.15.2:38701`, conectado em `192.168.15.2:33635` e confirmado como `SM_A546E`, Android 16/API 36, ABI `arm64-v8a`. A seleção explícita do serial IP foi rejeitada pelo Expo CLI, mas a seleção interativa escolheu o aparelho corretamente. O prebuild KDS terminou e o Gradle iniciou, registrando compileSdk/targetSdk 36, NDK 27.1.12297006 e autolinking de `react-native-nitro-http-server`, `react-native-nitro-modules` e `react-native-nitro-buffer`.

Durante a configuração Gradle, o build tentou instalar automaticamente Android Build-Tools 35.0.0. Esse componente não fazia parte da autorização original para o toolchain. O processo foi interrompido antes da compilação do APK, instalação no aparelho, abertura de `/spike` e testes de comunicação. O componente adicional já instalado pelo build não foi removido automaticamente. Resultado desta tentativa: **BLOCKED**, aguardando autorização explícita para manter o Build-Tools 35 e repetir o build.

**INCONCLUSIVE.**

A preparação deste worktree continua `PASS_FOR_NATIVE_TESTING`. A decisão do spike continua inconclusiva porque faltam HTTP/WS do Totem Android ↔ Linux, dois Androids e estabilidade prolongada; mDNS do Totem foi observado, mas não substitui o transporte TCP.

## Execução nativa do KDS no Windows com Galaxy A54 via USB

Em 18/10/2026, no worktree `C:/Users/Nito/www/worktrees/TotemOS-kds-lan-spike-win`, `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` e `PATH` foram definidos apenas na sessão PowerShell. `TOTEMOS_LAN_SPIKE=1` também ficou restrito à sessão.

O `adb devices -l` confirmou o Galaxy A54 em estado `device` pelo serial USB `RXCWC03JJ2K`, modelo `SM_A546E`, Android 16/API 36, ABI `arm64-v8a`. O IP Wi-Fi atual do aparelho foi `192.168.15.2/24`; o host Windows usou `192.168.15.3` na interface Ethernet.

O comando solicitado `npx expo run:android --device` executou o prebuild e iniciou o Gradle. Os logs confirmaram o autolinking de Nitro Modules, Nitro Buffer, RNHttpServer e Zeroconf. A compilação nativa parou no CMake/Ninja do Windows por regeneração repetida do `build.ninja` e pelo limite de caminho dos objetos do RNHttpServer. Não houve atualização de dependência nem alteração de Firewall.

Para concluir o mesmo build sem alterar o código, o NitroBuffer e o RNHttpServer foram compilados diretamente com CMake usando caminhos curtos e `CMAKE_SUPPRESS_REGENERATION=ON`. Em seguida, `app:assembleDebug` foi executado com as tarefas CMake já concluídas excluídas. O Gradle terminou com `BUILD SUCCESSFUL` e o APK `apps/kds/android/app/build/outputs/apk/debug/app-debug.apk` foi instalado com `adb install -r`, resultado `Success`. A instalação foi feita por USB, sem `adb reverse`.

O development client abriu pelo Metro em `http://192.168.15.3:8081` e a rota `kds://spike` foi entregue ao `MainActivity`. O log JS registrou `Running "main"`; o Nitro carregou `HybridHttpServerSpec`; e o Android registrou o anúncio mDNS:

```text
TotemOS KDS Spike, _totemos-kds._tcp, port 43210,
TXT protocol=totemos-lan-spike, version=1
```

O health foi consultado do Windows pela LAN, sem túnel:

```text
GET http://192.168.15.2:43210/_spike/health
HTTP 200
{"protocol":"totemos-lan-spike","version":1,"status":"ok"}

GET http://192.168.15.2:43210/_spike/does-not-exist
HTTP 404

192.168.15.3 -> 192.168.15.2:43210
TcpTestSucceeded: True
```

O anúncio mDNS foi confirmado no Android por `MdnsAdvertiser` e pela conclusão do probing em `wlan0`. O host Windows não possui `dns-sd` nem `avahi-browse`; uma consulta multicast DNS temporária em Node foi enviada, mas expirou sem resposta. Portanto, a publicação nativa está confirmada, enquanto a descoberta mDNS pelo host Windows ficou `NOT_TESTED`.

Os testes WebSocket foram executados do Windows contra `ws://192.168.15.2:43210/_spike/ws`:

```text
tenant-a:
OPEN
handshake_ack {"protocol":"totemos-lan-spike","version":1}
diagnostic_ack {"id":"windows-client-1","status":"ok"}

tenant-b:
handshake_rejected {"code":"TENANT_MISMATCH"}
CLOSE {"code":1008,"reason":"TENANT_MISMATCH","wasClean":true}
```

O fechamento voluntário foi reproduzido separadamente com `socket.close(1000, "client requested")`. O resultado efetivo foi `ERROR` seguido de `CLOSE {"code":1006,"reason":"","wasClean":false}`, sem conversão artificial para sucesso.

Resultado desta etapa: `KDS_WINDOWS_NATIVE_PASS` para build nativo instalado, HTTP LAN, WebSocket, isolamento de tenant e publicação mDNS no aparelho. A execução posterior do Totem contra fixture Windows está registrada na seção seguinte. A decisão geral do spike permanece `INCONCLUSIVE`, porque a integração direta KDS Android ↔ Totem Android continua `NOT_TESTED` e o fechamento voluntário continua `FAIL`. Nenhuma regra do Firewall do Windows foi alterada, e não foram usados Tailscale, ADB reverse ou emulador como evidência de LAN.

## Reexecução final após reconexão USB

Ainda em 18/10/2026, o Galaxy A54 foi reconectado por USB e confirmado como `RXCWC03JJ2K device`. O comando `npx expo run:android --device` foi repetido. O seletor escolheu `SM_A546E`, o autolinking confirmou Nitro Buffer, RNHttpServer, Nitro Modules e Zeroconf, e o Gradle voltou a parar somente no limite de caminho do CMake/Ninja do RNHttpServer. O workaround documentado terminou com `BUILD SUCCESSFUL` em 45 segundos, e a reinstalação do APK retornou `Success`.

Após abrir novamente o development client e `kds://spike`, o aparelho manteve `192.168.15.2/24` e o host manteve `192.168.15.3`. O log registrou `Running "main"`, `HybridHttpServerSpec`, `MdnsAdvertiser` em `_totemos-kds._tcp:43210` e `Probing finished` em `wlan0`.

Resultados efetivos da reexecução:

```text
GET /_spike/health -> HTTP 200
GET /_spike/not-found -> HTTP 404
Test-NetConnection 192.168.15.2:43210 -> TcpTestSucceeded: True
tenant-a -> handshake_ack -> diagnostic_ack {"id":"windows-client-rerun","status":"ok"}
tenant-b -> handshake_rejected {"code":"TENANT_MISMATCH"} -> CLOSE 1008, wasClean=true
socket.close(1000, "client requested") -> CLOSE 1006, wasClean=false
```

O resultado permanece `KDS_WINDOWS_NATIVE_PASS`. O Metro foi encerrado depois dos testes. G15 continua parcial pelas limitações já registradas.

## Execução Totem Android contra fixture Windows

Em 18/10/2026, a sessão PowerShell do worktree `C:/Users/Nito/www/worktrees/TotemOS-kds-lan-spike-win` foi configurada somente para o processo atual com:

```text
JAVA_HOME=C:/Users/Nito/Tools/TotemOS-card19/jdk-17.0.20.1+1
ANDROID_HOME=C:/Users/Nito/AppData/Local/Android/Sdk
ANDROID_SDK_ROOT=%ANDROID_HOME%
TOTEMOS_LAN_SPIKE=1
```

O `adb devices -l` confirmou:

```text
RXCWC03JJ2K device product:a54xnsxx model:SM_A546E device:a54x
```

O Galaxy A54 estava conectado por USB e permaneceu em `device`. O IP Wi-Fi observado no aparelho foi `192.168.15.2/24`. O host Windows usou a interface Ethernet `192.168.15.3/24`, com perfil `Public` e conectividade `Internet`. A inspeção do Firewall do Windows foi somente leitura. Nenhuma regra foi alterada.

### Build nativo do Totem e workaround CMake/Ninja

O comando solicitado foi executado em `apps/totem`:

```powershell
npx expo run:android --device
```

O prebuild foi concluído e o autolinking registrou Zeroconf, Expo Modules, Reanimated e Worklets. A primeira tentativa nativa falhou no Windows durante a regeneração do Ninja de `react-native-reanimated` com `manifest 'build.ninja' still dirty after 100 tries`. Após corrigir os artefatos gerados desse módulo, a configuração do CMake do app encontrou o limite de caminho do Windows, com `Filename longer than 260 characters` em objeto de `react-native-safe-area-context`.

O workaround usado foi o mesmo padrão já validado no KDS:

1. usar um drive `subst T:` temporário apontando para o worktree;
2. reconfigurar o diretório `.cxx` gerado do Reanimated com `-DCMAKE_SUPPRESS_REGENERATION:BOOL=ON`;
3. compilar o target Reanimated diretamente com Ninja;
4. executar `app:assembleDebug` com `--configure-on-demand`, `--build-cache`, `--max-workers=1`, `--no-parallel` e somente as tarefas CMake já concluídas do Reanimated excluídas;
5. instalar `apps/totem/android/app/build/outputs/apk/debug/app-debug.apk` com `adb install -r`.

O resultado foi `BUILD SUCCESSFUL` e instalação `Success`. O workaround ficou apenas em `.cxx`, `android/build` e outros artefatos Android ignorados, além do drive temporário. Não houve alteração de código fonte, dependência, configuração persistente ou checkout principal. `subst T: /D` foi executado ao terminar.

### Fixture Windows e protocolo

Como o Windows não tinha `dns-sd` nem `avahi-browse`, foi usado um fixture temporário em memória a partir de `apps/kds`, sem arquivo novo no repositório e sem instalar dependência. Ele reutilizou o `ws` transitivo já existente, abriu HTTP/WebSocket em `0.0.0.0:43210` e publicou mDNS por `dgram` como `_totemos-kds._tcp.local.`, com TXT `protocol=totemos-lan-spike` e `version=1`, apontando para `192.168.15.3`.

O development client do Totem foi servido pelo Metro em `http://192.168.15.3:8081`. O intent `totem:///spike` abriu a rota experimental no A54. A tela exibiu:

```text
Estado: conectado
Servidor: 192.168.15.3:43210
HTTP: ok
Evento: diagnostic_ack:totem-diagnostic-6
Retry: 0
```

Resultados efetivos separados:

| Teste | Resultado |
| --- | --- |
| descoberta mDNS | `PASS`: o fixture registrou consultas originadas de `192.168.15.2`; o Zeroconf resolveu o serviço e a UI mostrou `192.168.15.3:43210` |
| HTTP health pela LAN | `PASS`: `toybox nc` executado no A54 recebeu `HTTP 200` e `{"protocol":"totemos-lan-spike","version":1,"status":"ok"}` |
| HTTP rota inexistente pela LAN | `PASS`: `toybox nc` no A54 recebeu `HTTP 404 Not Found` |
| handshake compatível | `PASS`: o fixture registrou `tenant-a`, enviou `handshake_ack` e recebeu o diagnóstico |
| diagnóstico | `PASS`: `diagnostic_ack` com `id=totem-diagnostic-6` e `status=ok` |
| `TENANT_MISMATCH` | `PASS`: fixture esperando `tenant-b` respondeu `handshake_rejected`; a UI mostrou `Erro: Handshake rejeitado: TENANT_MISMATCH` e não houve `diagnostic_ack` |
| stop/restart | `PASS`: parar o fixture levou o Totem a retry/erro; subir o mesmo serviço restaurou health, handshake e diagnóstico sem reinstalar o APK |
| fechamento 1006 | `PASS` como reprodução separada: o fixture chamou `terminate()` e registrou `WS_CLOSE {code:1006}`; o Totem refez a conexão |
| estabilidade | `PASS`: 15 minutos, aproximadamente 902 segundos observados, final `conectado`, `HTTP: ok`, `Retry: 0` |

O fechamento `1006` foi mantido separado do teste de tenant. No caso de tenant divergente, o cliente Totem encerrou o socket localmente com seu tratamento de erro depois de receber `TENANT_MISMATCH`; no caso 1006, o fixture terminou o socket abruptamente. Não foi feita conversão de 1006 para sucesso.

### Limites desta rodada

- O fixture Windows valida o cliente Totem contra o contrato experimental, mas não substitui a matriz KDS Android ↔ Totem Android.
- Dois Androids físicos não foram executados nesta rodada.
- Nenhum emulador foi instalado ou iniciado.
- Nenhuma regra de Firewall foi criada, removida ou alterada.
- Não foram usados Tailscale, ADB reverse ou túnel como evidência de comunicação LAN.

O resultado desta rodada é `TOTEM_WINDOWS_NATIVE_PASS` para build, instalação, descoberta mDNS, HTTP LAN, handshake WebSocket, diagnóstico, tenant mismatch, reconexão, fechamento abrupto 1006 e estabilidade de 15 minutos. A decisão global do spike permanece **INCONCLUSIVE**: a viabilidade dos componentes foi demonstrada, mas a integração direta KDS Android ↔ Totem Android não foi validada, o fechamento voluntário permanece `FAIL` e os gates de dependências Expo G7-G10 permanecem `FAIL` preexistente.

## Correção do retry após rejeição de handshake

Na revisão do Card #19, foi reproduzido e corrigido exclusivamente o retry indevido após `handshake_rejected` com `TENANT_MISMATCH` no cliente LAN experimental do Totem.

- RED: o novo teste cobriu descoberta, health, criação do WebSocket, rejeição `TENANT_MISMATCH`, callbacks `onerror`/`onclose` atrasados e avanço de 5 segundos nos timers. Antes da correção, o `onerror` tardio substituiu o erro terminal por um erro de transporte e o `retryAttempt` avançou de `0` para `1`.
- Causa raiz: `fail(error, false)` não agendava retry no caminho da rejeição, mas callbacks posteriores de `onerror` e `onclose` ainda podiam seguir o fluxo transitório enquanto `active=true`.
- GREEN: o cliente passou a registrar a intenção de fechamento por socket. Rejeição terminal de handshake e encerramento solicitado ignoram `onerror`/`onclose` posteriores, preservando o erro e sem iniciar retry; falhas transitórias e desconexões inesperadas continuam iniciando retry. A geração da conexão segue descartando eventos de sockets antigos.
- Regressão: o cliente ainda reconecta após queda inesperada, cancela timers e listeners em `stop()`, inicia nova sessão depois de `stop()` e ignora callbacks obsoletos.
- Resultado: `apps/totem` passou em 7 suítes e 21 testes; KDS permaneceu em 5 suítes e 17 testes. Lint, typecheck e export Metro Android passaram nos dois apps.
- O fechamento independente `close(1000) → 1006` não foi alterado nem tratado por hipótese; permanece `FAIL` e fora do escopo desta correção.

## Resumo proposto para PR

### Objetivo

Validar a viabilidade experimental de um KDS Android publicar HTTP/WebSocket e mDNS na LAN, e de um Totem Android descobrir o serviço, consultar health, executar handshake e diagnóstico. O escopo não inclui pedidos, pagamentos, sincronização, pareamento definitivo ou autenticação produtiva.

### Implementação

- Adapters isolados para Nitro HTTP Server, WebSocket e Zeroconf.
- Protocolo diagnóstico com health, handshake, `diagnostic_ack` e `TENANT_MISMATCH`.
- Rotas manuais `/spike` no KDS e Totem.
- Ativação somente com `TOTEMOS_LAN_SPIKE=1` e `__DEV__`.
- Cleartext habilitado somente no config experimental.
- `negocioId` fictício usado apenas para diagnóstico. Não é mecanismo de segurança.

### Testes executados

- KDS: 5 suítes e 17 testes, lint, typecheck e export Metro `PASS`.
- Totem: 7 suítes e 21 testes, lint, typecheck e export Metro `PASS`.
- Regressão do cliente LAN: `TENANT_MISMATCH` terminal ignora `onerror`/`onclose` posteriores, preserva o erro, não aumenta retry, não redescobre e não cria novo WebSocket; queda transitória, stop/restart e callbacks obsoletos permanecem cobertos e `PASS`.
- KDS Android nativo no Galaxy A54: build, instalação, HTTP, WebSocket, `TENANT_MISMATCH` e publicação mDNS `PASS`.
- Totem Android contra fixture Windows: mDNS, HTTP 200/404 pela LAN, handshake, `diagnostic_ack`, `TENANT_MISMATCH`, retry/reconexão e estabilidade de 15 minutos `PASS`.
- Fechamento abrupto reproduzido com `1006`, comportamento esperado quando não há close frame.
- Fechamento voluntário solicitado com `close(1000)` reproduziu erro, `1006` e `wasClean=false`, portanto permanece `FAIL`.

### Evidências físicas

- Galaxy A54 `SM-A546E`, Android 16/API 36, conectado por USB em estado `device`.
- KDS e Totem instalados por APK debug no aparelho.
- Totem exibiu `conectado`, servidor LAN, `HTTP: ok`, `diagnostic_ack` e `Retry: 0` ao final da sessão estável.
- O fixture Windows recebeu as conexões do endereço Wi-Fi do aparelho. A comunicação de evidência usou LAN direta, sem Tailscale e sem ADB reverse.

### Problemas conhecidos

- KDS Android ↔ Totem Android não foi executado por falta de um segundo Android físico.
- A rota `/spike` permanece no manifest do Router, mas é funcionalmente inerte sem a flag experimental ou fora de `__DEV__`.
- O fechamento voluntário `close(1000)` continua falhando como `1006`. Impacta a comprovação de encerramento limpo e pode produzir erro/reconexão ruidosa. A hipótese atual é comportamento do adaptador nativo ou uma race na sequência de fechamento. Não há evidência suficiente para alterar a implementação.
- O `negocioId` é fictício, não autentica e não autoriza acesso.
- G7-G10 falham por deriva de versões Expo preexistente na base, sem relação observada com os módulos do spike.

### Testes pendentes

- Matriz direta KDS Android ↔ Totem Android, incluindo descoberta, HTTP, WebSocket, tenant mismatch, reconexão e estabilidade.
- Investigação específica do close handshake voluntário com frames WebSocket, FIN/close handshake e logs nativos.
- Substituição do handshake fictício pelo contrato de pareamento/deviceToken de outro card antes de qualquer uso produtivo.

### Decisão de ambiente

Não instalar Android Emulator neste computador, não instalar system images, não adquirir hardware adicional e não alterar a arquitetura experimental nesta etapa. O emulador não resolveria a lacuna de evidência física sem uma validação separada das limitações de multicast/mDNS entre a rede emulada e a LAN real. O worktree e o checkout principal permanecem preservados; nenhum merge ou atualização do Trello foi feito.
