# Gates: KDS LAN spike

OWNS: apps/kds/**, apps/totem/**, docs/spikes/kds-local-network.md, GATES.md

Scope: validar a estrutura diagnóstica HTTP/WebSocket/mDNS entre KDS e Totem sem integrar pedidos reais.

- [x] G0: o ledger de gates é válido
  CHECK: node /home/local/dotfiles/.agents/skills/unlazy/scripts/gate-lint.mjs GATES.md
  EXPECT: LINT OK
  EVIDENCE: PASS: gate-lint reexecutado após a atualização do ledger; `LINT OK` com 3 avisos manuais em G13-G15.

- [x] G1: os testes automatizados do KDS passam
  CHECK: npm test -- --runInBand && node -e "console.log('KDS_TESTS_PASSED')"
  EXPECT: KDS_TESTS_PASSED
  CWD: apps/kds
  EVIDENCE: PASS: reexecutado após a correção de ciclo de vida; 5 suites e 17 testes passaram.

- [x] G2: os testes automatizados do Totem passam
  CHECK: npm test -- --runInBand && node -e "console.log('TOTEM_TESTS_PASSED')"
  EXPECT: TOTEM_TESTS_PASSED
  CWD: apps/totem
  EVIDENCE: PASS: reexecutado após a correção de ciclo de vida; 7 suites e 24 testes passaram, incluindo rejeição terminal de handshake, eventos tardios de discovery/WebSocket, reinício após stop e callbacks obsoletos.

- [x] G3: o lint do KDS passa sem erros ou warnings
  CHECK: npm run lint && node -e "console.log('KDS_LINT_PASSED')"
  EXPECT: KDS_LINT_PASSED
  CWD: apps/kds
  EVIDENCE: PASS: `npm run lint` reexecutado no KDS após a correção, sem saída de erro ou warning.

- [x] G4: o lint do Totem passa sem erros ou warnings
  CHECK: npm run lint && node -e "console.log('TOTEM_LINT_PASSED')"
  EXPECT: TOTEM_LINT_PASSED
  CWD: apps/totem
  EVIDENCE: PASS: `npm run lint` reexecutado no Totem após a correção, sem saída de erro ou warning.

- [x] G5: o typecheck do KDS passa
  CHECK: npm run typecheck && node -e "console.log('KDS_TYPECHECK_PASSED')"
  EXPECT: KDS_TYPECHECK_PASSED
  CWD: apps/kds
  EVIDENCE: PASS: `npm run typecheck` reexecutado no KDS após a correção, exit=0.

- [x] G6: o typecheck do Totem passa
  CHECK: npm run typecheck && node -e "console.log('TOTEM_TYPECHECK_PASSED')"
  EXPECT: TOTEM_TYPECHECK_PASSED
  CWD: apps/totem
  EVIDENCE: PASS: `npm run typecheck` reexecutado no Totem após a correção, exit=0.

- [ ] G7: o Expo Doctor valida o KDS
  CHECK: npx expo-doctor && node -e "console.log('KDS_EXPO_DOCTOR_PASSED')"
  EXPECT: KDS_EXPO_DOCTOR_PASSED
  CWD: apps/kds
  EVIDENCE: FAIL/PREEXISTING: exit=1; expo-doctor v1.20.4 encontrou seis patches já presentes em origin/develop: expo, expo-constants, expo-dev-client, expo-linking, expo-router e expo-splash-screen; nenhum módulo adicionado pelo spike aparece na divergência

- [ ] G8: o Expo Doctor valida o Totem
  CHECK: npx expo-doctor && node -e "console.log('TOTEM_EXPO_DOCTOR_PASSED')"
  EXPECT: TOTEM_EXPO_DOCTOR_PASSED
  CWD: apps/totem
  EVIDENCE: FAIL/PREEXISTING: exit=1; expo-doctor v1.20.4 encontrou sete patches já presentes em origin/develop: os seis patches Expo do KDS e jest-expo; nenhum módulo adicionado pelo spike aparece na divergência

- [ ] G9: as dependências Expo do KDS estão alinhadas
  CHECK: npx expo install --check && node -e "console.log('KDS_EXPO_INSTALL_CHECK_PASSED')"
  EXPECT: KDS_EXPO_INSTALL_CHECK_PASSED
  CWD: apps/kds
  EVIDENCE: FAIL/PREEXISTING: exit=1; expo install --check reportou os mesmos seis patches encontrados contra origin/develop; não foi feita atualização ampla fora do card

- [ ] G10: as dependências Expo do Totem estão alinhadas
  CHECK: npx expo install --check && node -e "console.log('TOTEM_EXPO_INSTALL_CHECK_PASSED')"
  EXPECT: TOTEM_EXPO_INSTALL_CHECK_PASSED
  CWD: apps/totem
  EVIDENCE: FAIL/PREEXISTING: exit=1; expo install --check reportou os mesmos sete patches encontrados contra origin/develop; não foi feita atualização ampla fora do card

- [x] G11: o export Metro Android é executável no KDS
  CHECK: export_dir=$(mktemp -d) && npx expo export --platform android --output-dir "$export_dir" && node -e "console.log('KDS_METRO_EXPORT_PASSED')"
  EXPECT: KDS_METRO_EXPORT_PASSED
  CWD: apps/kds
  EVIDENCE: PASS: export Metro Android do KDS reexecutado após a correção; bundle Android gerado em diretório temporário.

- [x] G12: o export Metro Android é executável no Totem
  CHECK: export_dir=$(mktemp -d) && npx expo export --platform android --output-dir "$export_dir" && node -e "console.log('TOTEM_METRO_EXPORT_PASSED')"
  EXPECT: TOTEM_METRO_EXPORT_PASSED
  CWD: apps/totem
  EVIDENCE: PASS: export Metro Android do Totem reexecutado após a correção; bundle Android gerado em diretório temporário.

- [x] G13: o relatório registra evidência e limitações para HTTP, WebSocket, mDNS, isolamento, recuperação e estabilidade
  EVIDENCE: PASS: docs/spikes/kds-local-network.md contém matriz separada por testes unitários, KDS Android nativo, Totem Android contra fixture Windows, limitações do cenário e teste direto KDS Android ↔ Totem Android ainda `NOT_TESTED`.

- [x] G14: a revisão final confirma que não há alterações fora do card, segredos ou funcionalidades produtivas
  EVIDENCE: PASS: diff completo inclui os cinco manifests/lockfiles alterados e 31 arquivos não rastreados do spike, testes e documentação; não há backend/schema/pedidos, credenciais ou arquivos gerados versionados. Os diretórios `android/`, `.cxx`, Gradle e APK permanecem ignorados. IPs, caminhos Windows e resultados de build aparecem somente em evidências documentais ou fixtures, não em configuração/runtime produtivo. Rota e adapters só operam com `__DEV__` e `extra.lanSpikeEnabled`.

- [ ] G15: os experimentos Android físico/emulador foram executados e registrados
  EVIDENCE: PARTIAL: KDS Android nativo `PASS` nos experimentos comprovados; Totem Android contra fixture Windows `PASS`; reconexão e estabilidade inicial `PASS` nos cenários executados. KDS Android ↔ Totem Android permanece `NOT_TESTED`; emulador não foi instalado nem iniciado. Fechamento voluntário com `close(1000)` permanece `FAIL`, enquanto 1006 após queda abrupta foi reproduzido como esperado. `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `PATH` e `TOTEMOS_LAN_SPIKE` ficaram restritos à sessão. Nenhuma regra de Firewall foi alterada, e não foram usados Tailscale ou ADB reverse como transporte.

## Consolidação para code review

- Veredicto global: `INCONCLUSIVE`.
- KDS Android nativo: `PASS` nos experimentos comprovados no Galaxy A54.
- Totem Android contra fixture Windows: `PASS` para mDNS, HTTP LAN, handshake, `diagnostic_ack`, `TENANT_MISMATCH`, reconexão e estabilidade de 15 minutos.
- Reconexão e estabilidade inicial: `PASS` nos cenários executados.
- Cliente Totem: rejeição `TENANT_MISMATCH` é terminal para a sessão atual; `resolved` e erros tardios de discovery, mensagens tardias do WebSocket rejeitado e `onerror`/`onclose` posteriores não incrementam `retryAttempt`, não iniciam nova descoberta, não apagam o erro e não criam novo WebSocket. Quedas transitórias continuam em retry, e `stop()`/gerações continuam protegendo cleanup e callbacks obsoletos.
- KDS Android ↔ Totem Android: `NOT_TESTED`.
- Fechamento WebSocket voluntário com `close(1000)`: `FAIL`, observado como erro seguido de `1006`, `wasClean=false`.
- Fechamento WebSocket após queda abrupta: `1006` esperado, reproduzido separadamente e não convertido artificialmente em sucesso.
- Expo dependency gates G7-G10: `FAIL` preexistente, sem atualização de dependências neste card.
- O `negocioId` do spike é somente uma comparação diagnóstica com identificador fictício. Não é autenticação, autorização, device binding ou segurança de produção.
- A rota `/spike` pode existir no manifest do Router, mas fica funcionalmente inerte sem `TOTEMOS_LAN_SPIKE=1` e fora de `__DEV__`; nesse estado não inicia HTTP, WebSocket, mDNS ou descoberta e apenas informa que o diagnóstico está desabilitado.

## Atualização do Card #19, execução KDS Windows em 18/10/2026

- `adb devices -l` confirmou o Galaxy A54 por USB em estado `device`, serial `RXCWC03JJ2K`, Android 16/API 36 e ABI `arm64-v8a`.
- `npx expo run:android --device` executou prebuild e autolinking Nitro/Zeroconf, mas o CMake/Ninja do Windows falhou por regeneração do `build.ninja` e limite de caminho. O build foi concluído com CMake direto em caminhos curtos e Gradle `app:assembleDebug`; resultado `BUILD SUCCESSFUL`.
- O APK debug foi instalado no aparelho com `adb install -r`, resultado `Success`. A rota `kds://spike` abriu o KDS e o log confirmou `HybridHttpServerSpec` e `MdnsAdvertiser` em `wlan0`.
- HTTP LAN Windows → Galaxy A54: `GET /_spike/health` retornou `200` com o payload esperado; rota inexistente retornou `404`; `Test-NetConnection` para `192.168.15.2:43210` retornou `TcpTestSucceeded: True`.
- mDNS: publicação `_totemos-kds._tcp` na porta `43210`, TXT `protocol=totemos-lan-spike` e `version=1`, com probing concluído no Android. A consulta multicast temporária do host expirou; o Windows não tem `dns-sd` nem `avahi-browse`.
- WebSocket LAN Windows → Galaxy A54: `tenant-a` recebeu `handshake_ack` e `diagnostic_ack`; `tenant-b` recebeu `handshake_rejected` com `TENANT_MISMATCH` e fechamento `1008`.
- Fechamento voluntário separado reproduziu `1006`, motivo vazio e `wasClean=false`.
- G15 permanece parcial somente pela ausência de dois Androids e emulador. O Totem físico e a estabilidade prolongada passaram no fixture Windows; nenhuma regra de Firewall foi alterada e não foram usados Tailscale, ADB reverse ou emulador como evidência.

### Reexecução USB final

- O `npx expo run:android --device` foi repetido com o Galaxy A54 `RXCWC03JJ2K device`. Nitro/Zeroconf autolinking passou; o CMake/Ninja do RNHttpServer repetiu a falha de caminho longo. O workaround CMake/Gradle terminou com `BUILD SUCCESSFUL` e a reinstalação USB retornou `Success`.
- A instalação atual respondeu HTTP `200` em `/_spike/health`, `404` em rota inexistente e `TcpTestSucceeded: True` em `192.168.15.3 -> 192.168.15.2:43210`.
- O log Android confirmou `HybridHttpServerSpec`, publicação `_totemos-kds._tcp:43210` e `Probing finished` em `wlan0`.
- A instalação atual confirmou `handshake_ack`, `diagnostic_ack`, `TENANT_MISMATCH` com fechamento `1008` e fechamento voluntário separado `1006/wasClean=false`. Metro encerrado após os testes.

## Atualização do Card #19, Totem Android contra fixture Windows em 18/10/2026

- O `npx expo run:android --device` do Totem foi executado em `apps/totem` com `TOTEMOS_LAN_SPIKE=1`. O autolinking incluiu Expo Modules, Zeroconf, Reanimated, Worklets e demais módulos nativos do app.
- A tentativa padrão falhou no CMake/Ninja do Windows: primeiro `react-native-reanimated` reportou `manifest 'build.ninja' still dirty after 100 tries`; depois o CMake do app encontrou `Filename longer than 260 characters` em objetos do `react-native-safe-area-context`.
- O mesmo workaround de artefatos gerados usado no KDS funcionou no Totem. O Reanimated foi reconfigurado com `CMAKE_SUPPRESS_REGENERATION=ON` e compilado diretamente pelo Ninja; o Gradle terminou `app:assembleDebug` com `BUILD SUCCESSFUL` e as tarefas CMake já concluídas foram apenas excluídas da repetição. Um `subst T:` temporário reduziu o caminho durante o build e foi removido ao terminar.
- O workaround persistiu somente em `.cxx`, `android/build` e demais artefatos Android ignorados. Não houve alteração de fonte, dependência, configuração persistente ou checkout principal. O APK foi instalado por USB com `adb install -r`, resultado `Success`.
- Fixture Windows temporário: Node e `ws` transitivo já presente em `apps/kds`, HTTP em `0.0.0.0:43210`, serviço `_totemos-kds._tcp.local.`, TXT `protocol=totemos-lan-spike` e `version=1`. Como `dns-sd` e `avahi-browse` não estavam disponíveis no Windows, a publicação mDNS foi feita no próprio fixture com `dgram`, sem instalar dependências.
- Host Windows: Ethernet `192.168.15.3/24`, perfil `Public`, conectividade `Internet`; Galaxy A54: Wi-Fi `192.168.15.2/24`, ADB USB `RXCWC03JJ2K device`. As consultas do Firewall foram somente leitura; nenhuma regra foi criada ou alterada.
- O A54 abriu `totem:///spike` pelo development client. A UI confirmou `Servidor: 192.168.15.3:43210`, `Estado: conectado`, `HTTP: ok` e `Evento: diagnostic_ack:totem-diagnostic-6`.
- Do próprio Android, `toybox nc` acessou `192.168.15.3:43210`: `GET /_spike/health` retornou `HTTP/1.1 200 OK` com o payload do protocolo; `GET /_spike/missing` retornou `HTTP/1.1 404 Not Found`.
- O fixture registrou consulta mDNS originada de `192.168.15.2`, conexão HTTP, handshake `tenant-a`, `handshake_ack` e `diagnostic_ack`.
- Com o fixture reiniciado esperando `tenant-b`, o Totem mostrou `Erro: Handshake rejeitado: TENANT_MISMATCH`; não houve `diagnostic_ack` dessa tentativa.
- A interrupção do fixture foi seguida por retry e reconexão sem reinstalar o app. Em experimento separado, `WebSocket.terminate()` produziu `WS_CLOSE {code:1006}` no fixture; o Totem refez health, handshake e diagnóstico.
- A estabilidade de 15 minutos terminou com `Estado: conectado`, `HTTP: ok`, `Retry: 0`, sem nova desconexão observada. Metro, fixture e drive temporário foram encerrados/removidos após a coleta.
