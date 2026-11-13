# Guia rápido da P0 do TotemOS

O [card #43](https://trello.com/c/kAw2krOQ) cobre a reprodução do autoatendimento em laboratório. Use uma revisão conhecida de `develop`, um PostgreSQL vazio e contas, catálogo e pedidos sintéticos.

## Preparar o ambiente

Instale Git, Bun, Node.js 24 com npm, Docker com containers Linux e Android Studio com SDK, ADB e emuladores. Use três alvos Android de laboratório ou três AVDs independentes. Os aplicativos exigem development builds do Expo.

| Diretório | Aplicação | Instalação |
|---|---|---|
| `apps/backend` | NestJS, Prisma e PostgreSQL | `bun install` |
| `apps/dashboard` | Administração Next.js | `bun install` |
| `apps/totem` | Autoatendimento Android | `npm ci` |
| `apps/kds` | Fila operacional Android | `npm ci` |

Execute cada comando de instalação no diretório da aplicação. Use um worktree sem arquivos de configuração de outros ambientes. O exemplo abaixo usa PowerShell. Confira primeiro se o contexto Docker aponta para um daemon local.

```powershell
$qaDbPassword = [guid]::NewGuid().ToString('N')
$env:POSTGRES_PASSWORD = $qaDbPassword
$qaContainer = docker run --rm -d --label totemos.qa=p0-guia -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql -e POSTGRES_PASSWORD -e POSTGRES_DB=totemos_demo_test postgres:18
Remove-Item Env:POSTGRES_PASSWORD
if (!$qaContainer) { throw 'Falha ao criar o PostgreSQL de laboratório' }
$qaBinding = docker port $qaContainer 5432/tcp
if ($qaBinding -notmatch '^127\.0\.0\.1:\d+$') { throw 'Esperado PostgreSQL no loopback' }
$env:DATABASE_URL = "postgresql://postgres:${qaDbPassword}@${qaBinding}/totemos_demo_test?schema=public"
$env:DIRECT_URL = $env:DATABASE_URL
$env:DEMO_TEST_DATABASE_URL = $env:DATABASE_URL
$env:DEVICE_PAIRING_TEST_DATABASE_URL = $env:DATABASE_URL
```

Em `apps/backend`, aguarde `docker exec $qaContainer pg_isready -U postgres -d totemos_demo_test` retornar pronto. Rode `bunx prisma generate`, `bunx prisma migrate deploy` e `bunx prisma migrate status`. Confira o destino local das duas URLs antes da migração. O banco e as credenciais são exclusivos deste ensaio.

Use um host de laboratório em rede confiável. O bootstrap padrão do Backend escuta em todas as interfaces. Configure `JWT_SECRET`, `PAIRING_CODE_PEPPER` e `DEVICE_TOKEN_PEPPER` com valores aleatórios exclusivos. Use `NODE_ENV=development`, `PORT=3001`, `ALLOWED_ORIGINS=http://127.0.0.1:3000` e mantenha o ambiente sem credenciais Mercado Pago. As variáveis do Backend estão em [.env.example](../apps/backend/.env.example). Execute `bun run start:dev`. Em outro terminal, abra `apps/dashboard`, defina `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001` e rode `bun run dev --hostname 127.0.0.1`.

## Preparar o estabelecimento e os dispositivos

1. Registre um estabelecimento fictício no Dashboard ou via `POST /auth/registrar`. O contrato requer `nomeNegocio`, `slugNegocio`, `pinDono`, `nomeUsuario`, `email` e `senhaPlana`. Entre como DONO e consulte o identificador do negócio no assistente ou em `GET /auth/me`.
2. Cadastre uma categoria ativa e um produto disponível com preço fictício e preparo maior que zero. Revise o modo de identificação, tempo padrão e boas-vindas em **Configurações**. Para alterar, use o PIN sintético.
3. Pare o Backend e configure `TOTEMOS_ENV=demo`, `DEMO_ENABLED=true`, `DEMO_DATABASE_ISOLATED=true`, `DEMO_ENVIRONMENT_ID` com um nome único de laboratório e `DEMO_TENANT_IDS` com o ID do estabelecimento sintético. Preserve as variáveis do banco local e reinicie. A allowlist precisa estar ativa antes de criar o pedido que será liberado.
4. Em cada alvo autorizado, use `adb -s <serial> reverse tcp:3001 tcp:3001` e verifique a porta do Metro. Use `EXPO_PUBLIC_API_URL=http://127.0.0.1:3001` nas sessões do Expo. No Totem, use `EXPO_PUBLIC_KIOSK_PREVIEW=0`. Rode `npm run android` em cada aplicativo e selecione o alvo correto. Execute as instâncias KDS com o mesmo bundle em dois alvos distintos. Ao rodar dois servidores Metro, use portas distintas e faça o reverse correspondente em cada alvo. Consulte os procedimentos do [Totem](../apps/totem/README.md) e [KDS](../apps/kds/README.md).
5. Em **Dispositivos**, gere um código por instalação, um TOTEM e dois PAINÉIS. Consuma cada código no aplicativo correspondente e confira os três registros pareados.

## Executar o roteiro DEMO

1. No Totem, monte o carrinho com o produto fictício e conclua o envio. Use nome sintético se solicitado. O pedido deve nascer em `AGUARDANDO_PAGAMENTO`, sem senha e fora das duas filas. Confira o snapshot no histórico.
2. Leia o ID e a versão atual em `GET /pedidos` com a sessão DONO. Autorize via `POST /pedidos/:id/liberacao-demo`, Bearer do DONO, `Idempotency-Key` UUID e JSON com `motivo`, `pin` e `versaoEsperada`. Mantenha os segredos em memória. Confira HTTP 200 e `autorizacaoOperacional: { tipo: "DEMO", financeira: false }`. [Contrato DEMO](liberacao-demo.md).
3. Confirme o mesmo ID e senha nos dois KDS. Inicie preparo no primeiro, marque pronto no segundo e confirme a entrega no primeiro. Confira cada estado no Totem e o pedido entregue no Dashboard. Os indicadores devem separar DEMO de vendas comerciais. Após `ENTREGUE`, inicie **Novo atendimento** e confirme carrinho vazio.
4. Repita com um produto de preparo zero e confirme que entra direto como `PRONTO` após a senha. Em ensaio separado, revogue um PAINEL e confirme que retorna ao pareamento.

## Validação e limpeza

- Backend, no PostgreSQL descartável e antes de criar os dados do roteiro, execute `bun run lint`, `bunx tsc --noEmit`, `bun test`, `bun run build` e, em sequência, os scripts `test:demo:e2e`, `test:operacao:e2e`, `test:senha:e2e`, `test:pedidos:e2e`, `test:configuracoes:e2e` e `test:invariantes:e2e` com `bun run`. Use outro banco descartável se o ensaio já começou.
- Dashboard, execute `bun run lint`, `bun test`, `bun run typecheck` e `bun run build`.
- Totem e KDS, execute `npm run lint`, `npm run typecheck`, `npm test -- --runInBand` e `npx expo export --platform android --output-dir dist/ci --clear --max-workers 2`. No Totem, exporte separadamente com `EXPO_PUBLIC_KIOSK_PREVIEW=0` e `=1`, em diretórios distintos. Consulte a [CI](../.github/workflows/ci.yml).
- Se a API falhar, confira processo, CORS e porta. No Android, confira `adb devices -l`, os túneis e o valor da URL no Metro. Para pareamento expirado ou revogado, emita outro código para a instalação certa. Para DEMO indisponível, confira ambiente, allowlist, usuário, PIN e se o pedido foi criado após a configuração.
- Encerre Backend, Dashboard e Metro. Remova somente os túneis do ensaio com `adb -s <serial> reverse --remove tcp:<porta>`. Confira o ID e o label do próprio container e execute `docker stop $qaContainer`. O container usa `--rm` e armazenamento temporário. Feche o terminal que continha as credenciais e preserve somente evidências sanitizadas.

## Limites da demonstração

O modo conectado usa API, banco, pedidos e dispositivos reais com dados sintéticos. A prévia visual do Totem, `EXPO_PUBLIC_KIOSK_PREVIEW=1`, usa dados simulados. A autorização DEMO permite preparo e entrega em ambiente isolado sem cobrança. O Lock Task dedicado requer Android gerenciado e DPC autorizado. A fixação de tela é um modo distinto do Android. Pagamento real, Point, mesas, impressão e operação LAN/offline completa estão fora da P0.
