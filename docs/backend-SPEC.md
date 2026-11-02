# Backend — SPEC (NestJS + Bun + Prisma + PostgreSQL)

Especificação técnica, modelo de dados, políticas de segurança e contratos HTTP do backend da plataforma TotemOS.

## Classificação do Estado Atual

Para clareza arquitetural, todos os itens deste documento são categorizados conforme o estágio de maturidade técnica no repositório:

- **IMPLEMENTADO**: Código existente em `apps/backend/src`, coberto por testes automatizados em `bun test`.
- **DECIDIDO**: Contrato aprovado e especificado com precisão, aguardando execução de desenvolvimento.
- **PLANEJADO**: Funcionalidade prevista no roadmap, sem código ou contrato fechado.
- **EXPERIMENTAL**: Spike ou hipótese técnica isolada, sem integração ao fluxo produtivo.

O MVP (P0) do roadmap é **estritamente cloud-online**, utilizando backend NestJS hospedado e banco de dados PostgreSQL. Comunicação em rede local (LAN) e reconciliação offline não fazem parte do escopo operacional do P0.

---

## 1. Stack e Tecnologias

- **Runtime**: Bun
- **Framework**: NestJS com adaptador Fastify (`@nestjs/platform-fastify`)
- **ORM**: Prisma
- **Banco de Dados**: PostgreSQL
- **Validação e DTOs**: Zod e ValidationPipe NestJS (`nestjs-zod`)
- **Testes**: `bun:test`
- **Fuso Horário Operacional**: `America/Sao_Paulo` (definido no PostgreSQL para apuração de data e numeração de senhas)

---

## 2. Modelo de Dados Prisma (`schema.prisma`)

Modelo de dados persistido em `apps/backend/prisma/schema.prisma` (versão auditada):

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  DONO
  GERENTE
}

enum TipoDispositivo {
  TOTEM
  PAINEL
}

enum StatusCodigoPareamento {
  ATIVO
  CONSUMIDO
  EXPIRADO
}

enum StatusPedido {
  AGUARDANDO_PAGAMENTO
  PENDENTE
  EM_PREPARO
  PRONTO
  ENTREGUE
  CANCELADO_AGUARDANDO_ESTORNO
  CANCELADO
}

enum ModoIdentificacao {
  NOME
  CODIGO
  OPCIONAL
}

enum StatusPagamento {
  PENDENTE
  APROVADO
  RECUSADO
  ESTORNADO
}

enum MeioPagamento {
  CREDITO
  DEBITO
  PIX
}

model Negocio {
  id          String   @id @default(uuid())
  nome        String
  slug        String   @unique
  pinDonoHash String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  usuarios          Usuario[]
  dispositivos      Dispositivo[]
  codigosPareamento CodigoPareamento[]
  config            NegocioConfig?
  categorias        Categoria[]
  produtos          Produto[]
  combos            Combo[]
  pedidos           Pedido[]
  liberacoesDemo    LiberacaoDemo[]
  contadoresSenha   ContadorSenha[]
}

model NegocioConfig {
  id                       String            @id @default(uuid())
  negocioId                String            @unique
  negocio                  Negocio           @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  modoIdentificacao        ModoIdentificacao @default(OPCIONAL)
  tempoPadraoPreparo       Int               @default(15)
  permitirPagamentoOffline Boolean           @default(true)
  mensagemBoasVindas       String?
}

model Usuario {
  id        String   @id @default(uuid())
  negocioId String
  negocio   Negocio  @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  email     String   @unique
  senhaHash String
  nome      String
  role      Role     @default(DONO)
  createdAt DateTime @default(now())

  codigosPareamento CodigoPareamento[] @relation("CodigoPareamentoCriadoPor")
  liberacoesDemo    LiberacaoDemo[]
}

model Dispositivo {
  id              String          @id @default(uuid())
  negocioId       String
  negocio         Negocio         @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  nome            String
  tipo            TipoDispositivo
  tokenHash       String          @unique
  pareadoEm       DateTime?
  mpPointDeviceId String?
  ativo           Boolean         @default(true)
  revogadoEm      DateTime?
  createdAt       DateTime        @default(now())
}

model CodigoPareamento {
  id                 String                 @id @default(uuid())
  negocioId          String
  negocio            Negocio                @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  criadoPorUsuarioId String
  criadoPor          Usuario                @relation("CodigoPareamentoCriadoPor", fields: [criadoPorUsuarioId], references: [id], onDelete: Restrict)
  nome               String
  tipo               TipoDispositivo
  codigoHash         String
  expiraEm           DateTime
  status             StatusCodigoPareamento @default(ATIVO)
  consumidoEm        DateTime?
  createdAt          DateTime               @default(now())

  @@index([codigoHash, status])
  @@index([negocioId, createdAt])
}

model PareamentoRateLimit {
  chave        String   @id
  janelaInicio DateTime
  tentativas   Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([janelaInicio])
}

model Categoria {
  id        String    @id @default(uuid())
  negocioId String
  negocio   Negocio   @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  nome      String
  ordem     Int       @default(0)
  ativo     Boolean   @default(true)
  produtos  Produto[]
}

model Produto {
  id                   String            @id @default(uuid())
  negocioId            String
  negocio              Negocio           @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  categoriaId          String
  categoria            Categoria         @relation(fields: [categoriaId], references: [id])
  nome                 String
  descricao            String?
  precoBase            Decimal           @db.Decimal(10, 2)
  imagemUrl            String?
  tempoEstimadoPreparo Int               @default(0)
  esgotado             Boolean           @default(false)
  ativo                Boolean           @default(true)
  variacoes            ProdutoVariacao[]
  adicionais           Adicional[]
  itensDoPedido        PedidoItem[]
}

model ProdutoVariacao {
  id        String  @id @default(uuid())
  produtoId String
  produto   Produto @relation(fields: [produtoId], references: [id], onDelete: Cascade)
  nome      String
  preco     Decimal @db.Decimal(10, 2)
  esgotado  Boolean @default(false)
}

model Adicional {
  id        String                @id @default(uuid())
  produtoId String
  produto   Produto               @relation(fields: [produtoId], references: [id], onDelete: Cascade)
  nome      String
  preco     Decimal               @db.Decimal(10, 2)
  maximo    Int                   @default(1)
  esgotado  Boolean               @default(false)
  itens     PedidoItemAdicional[]
}

model Combo {
  id              String           @id @default(uuid())
  negocioId       String
  negocio         Negocio          @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  nome            String
  descricao       String?
  precoFixo       Decimal          @db.Decimal(10, 2)
  imagemUrl       String?
  ativo           Boolean          @default(true)
  gruposDeEscolha GrupoDeEscolha[]
}

model GrupoDeEscolha {
  id      String        @id @default(uuid())
  comboId String
  combo   Combo         @relation(fields: [comboId], references: [id], onDelete: Cascade)
  titulo  String
  minimo  Int           @default(1)
  maximo  Int           @default(1)
  itens   ItemDoGrupo[]
}

model ItemDoGrupo {
  id             String              @id @default(uuid())
  grupoId        String
  grupo          GrupoDeEscolha      @relation(fields: [grupoId], references: [id], onDelete: Cascade)
  nome           String
  deltaPreco     Decimal             @default(0.00) @db.Decimal(10, 2)
  esgotado       Boolean             @default(false)
  escolhasPedido PedidoItemEscolha[]
}

model Pedido {
  id               String       @id @default(uuid())
  negocioId        String
  negocio          Negocio      @relation(fields: [negocioId], references: [id], onDelete: Cascade)
  dispositivoId    String?
  idempotencyKey   String?      @unique
  senhaAtribuidaEm DateTime?    @db.Timestamptz(3)
  senha            Int?
  dataSequencial   String
  status           StatusPedido @default(AGUARDANDO_PAGAMENTO)
  nomeCliente      String?
  codigoCliente    String?
  valorTotal       Decimal      @db.Decimal(10, 2)
  observacoes      String?
  origemOffline    Boolean      @default(false)
  preparoZero      Boolean      @default(false)
  demo             Boolean      @default(false)
  demoAmbiente     String?
  versao           Int          @default(1)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  itens            PedidoItem[]
  pagamentos       Pagamento[]
  liberacaoDemo    LiberacaoDemo?
  transicoes       TransicaoPedido[]
  atribuicoesSenha AtribuicaoSenha[]

  @@unique([negocioId, dataSequencial, senha])
}

model PedidoItem {
  id             String                @id @default(uuid())
  pedidoId       String
  pedido         Pedido                @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  produtoId      String?
  produto        Produto?              @relation(fields: [produtoId], references: [id])
  nomeProduto    String
  precoNoMomento Decimal               @db.Decimal(10, 2)
  quantidade     Int                   @default(1)
  observacao     String?
  variacaoNome   String?
  adicionais     PedidoItemAdicional[]
  escolhas       PedidoItemEscolha[]
}

model PedidoItemAdicional {
  id             String     @id @default(uuid())
  pedidoItemId   String
  pedidoItem     PedidoItem @relation(fields: [pedidoItemId], references: [id], onDelete: Cascade)
  adicionalId    String?
  adicional      Adicional? @relation(fields: [adicionalId], references: [id])
  nomeAdicional  String
  precoNoMomento Decimal    @db.Decimal(10, 2)
  quantidade     Int        @default(1)
}

model PedidoItemEscolha {
  id             String       @id @default(uuid())
  pedidoItemId   String
  pedidoItem     PedidoItem   @relation(fields: [pedidoItemId], references: [id], onDelete: Cascade)
  itemDoGrupoId  String?
  itemDoGrupo    ItemDoGrupo? @relation(fields: [itemDoGrupoId], references: [id])
  nomeItem       String
  deltaNoMomento Decimal      @db.Decimal(10, 2)
}

model Pagamento {
  id          String          @id @default(uuid())
  pedidoId    String
  pedido      Pedido          @relation(fields: [pedidoId], references: [id], onDelete: Cascade)
  mpIntentId  String?         @unique
  mpPaymentId String?
  status      StatusPagamento @default(PENDENTE)
  meio        MeioPagamento?
  valor       Decimal         @db.Decimal(10, 2)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model LiberacaoDemo {
  id             String         @id @default(uuid())
  negocioId      String
  negocio        Negocio        @relation(fields: [negocioId], references: [id], onDelete: Restrict)
  pedidoId       String         @unique
  pedido         Pedido         @relation(fields: [pedidoId], references: [id], onDelete: Restrict)
  usuarioId      String
  usuario        Usuario        @relation(fields: [usuarioId], references: [id], onDelete: Restrict)
  idempotencyKey String
  payloadHash    String
  motivo         String
  ambiente       String
  versaoAnterior Int
  versaoLiberada Int
  transicoes     StatusPedido[]
  createdAt      DateTime       @default(now())

  @@unique([negocioId, usuarioId, idempotencyKey])
  @@index([negocioId, createdAt])
}

model TransicaoPedido {
  id             String       @id @default(uuid())
  negocioId      String
  pedidoId       String
  pedido         Pedido       @relation(fields: [pedidoId], references: [id], onDelete: Restrict)
  atorId         String
  identidade     String
  idempotencyKey String
  payloadHash    String
  statusAnterior StatusPedido
  statusNovo     StatusPedido
  versaoAnterior Int
  versaoNova     Int
  createdAt      DateTime     @default(now())

  @@unique([negocioId, identidade, atorId, idempotencyKey])
  @@index([negocioId, pedidoId, createdAt])
}

model ContadorSenha {
  negocioId       String
  negocio         Negocio @relation(fields: [negocioId], references: [id], onDelete: Restrict)
  dataOperacional String
  ultimoNumero    Int

  @@id([negocioId, dataOperacional])
}

model AtribuicaoSenha {
  id                 String   @id @default(uuid())
  negocioId          String
  pedidoId           String
  pedido             Pedido   @relation(fields: [pedidoId], references: [id], onDelete: Restrict)
  atorId             String
  idempotencyKey     String
  senha              Int
  dataOperacional    String
  versaoAnterior     Int
  versaoNova         Int
  primeiraAtribuicao Boolean
  createdAt          DateTime @default(now()) @db.Timestamptz(3)

  @@unique([negocioId, atorId, idempotencyKey])
  @@index([negocioId, pedidoId, createdAt])
}
```

O Prisma 6.x não suporta índices únicos parciais no arquivo de schema. A migration do PostgreSQL cria explicitamente o índice parcial para códigos ativos:

```sql
CREATE UNIQUE INDEX "CodigoPareamento_codigoHash_ativo_key"
ON "CodigoPareamento" ("codigoHash")
WHERE "status" = 'ATIVO';
```

---

## 3. Segurança, Autenticação e Controle de Acesso

O sistema adota duas formas distintas de identidade na API, separando usuários humanos da Dashboard e equipamentos terminais (Totem e KDS).

### 3.1 Identidade Humana vs Dispositivo

| Atributo | Usuário Humano (`identity: 'USER'`) | Dispositivo (`identity: 'DEVICE'`) |
| --- | --- | --- |
| **Público** | Dono e Gerentes na Dashboard Web | Totem de autoatendimento e Painel KDS |
| **Tipo de Credencial** | Bearer JWT emitido em `POST /auth/login` | `deviceToken` opaco gerado no pareamento |
| **Segredo de Validação** | Assinatura com `JWT_SECRET` | Hash HMAC-SHA256 com `DEVICE_TOKEN_PEPPER` |
| **Armazenamento no Banco** | Senha como hash bcrypt em `Usuario.senhaHash` | Token hasheado em `Dispositivo.tokenHash` |
| **Claims e Payload Injetado** | `{ sub, email, negocioId, role, identity: 'USER', isDispositivo: false }` | `{ sub, email: '', negocioId, identity: 'DEVICE', isDispositivo: true, tipoDispositivo }` |
| **Guard Primário** | `JwtAuthGuard` | `DeviceTokenGuard` |
| **Acesso a Rotas Admin** | Permitido conforme Role via `RolesGuard` | **Terminantemente bloqueado** via `RolesGuard` |

### 3.2 Ciclo de Vida do Dispositivo e `deviceToken`

1. **Geração do Código de Pareamento (`POST /dispositivos/parear/codigo`)**:
   - Apenas usuários humanos com perfil `DONO` podem solicitar.
   - Gera um código numérico de 6 dígitos aleatório (`randomInt`).
   - Armazena o código hasheado com HMAC-SHA256 usando `PAIRING_CODE_PEPPER`.
   - Prazo de expiração fixado em 15 minutos (`expiraEm`).
   - Códigos expirados anteriores do tenant são limpos atomicamente.
2. **Consumo e Ativação (`POST /dispositivos/parear/ativar`)**:
   - Rota pública protegida por rate limit em banco (`PareamentoRateLimit`), limitando a 30 tentativas por minuto por IP de origem.
   - A transação executa com nível de isolamento `Serializable` para evitar consumo concorrente do mesmo código.
   - Gera um `deviceToken` criptograficamente seguro via `randomBytes(32).toString('base64url')`.
   - O `deviceToken` em texto claro é retornado ao cliente **uma única vez** na resposta. O banco de dados armazena apenas seu `tokenHash` (calculado via HMAC-SHA256 com `DEVICE_TOKEN_PEPPER`).
3. **Validação Contínua (`DeviceTokenGuard`)**:
   - Para cada requisição com cabeçalho `Authorization: Bearer <deviceToken>`, o guard calcula o HMAC e busca no banco o dispositivo com `tokenHash`.
   - A requisição só é autorizada se o dispositivo existir, possuir `ativo = true` e `revogadoEm = null`.
4. **Revogação Imediata (`DELETE /dispositivos/:id`)**:
   - Exclusivo para usuários humanos com perfil `DONO`.
   - Atualiza `ativo = false` e `revogadoEm = new Date()`.
   - A revogação entra em vigor imediatamente, rejeitando qualquer requisição subsequente com 401 Unauthorized.

### 3.3 Guards e Decorators de Autorização

- **`JwtAuthGuard`**: Valida a assinatura do JWT, valida a expiração e confere que a identidade pertence a um usuário humano válido (`role` é `DONO` ou `GERENTE`, `identity !== 'DEVICE'`, `!isDispositivo`).
- **`DeviceTokenGuard`**: Valida o token opaco do dispositivo, checando integridade via HMAC e persistência ativa no PostgreSQL.
- **`AnyAuthGuard`**: Mecanismo polimórfico. Tenta autenticar primeiro como usuário humano (`JwtAuthGuard`). Caso falhe, tenta autenticar como dispositivo (`DeviceTokenGuard`).
- **`RolesGuard` com `@Roles(Role.DONO, Role.GERENTE)`**: Restrito exclusivamente a usuários humanos. Se o requisitante for um dispositivo (`identity === 'DEVICE'` ou `isDispositivo: true`), o acesso é rejeitado com 403 Forbidden.
- **`DeviceTypeGuard` com `@DeviceTypes(TipoDispositivo.TOTEM)` ou `@DeviceTypes(TipoDispositivo.PAINEL)`**: Permite usuários humanos livremente. Caso a requisição venha de um dispositivo, valida se seu `tipoDispositivo` corresponde aos tipos autorizados na rota.

### 3.4 PIN de Segurança do Dono

- Código numérico de 4 dígitos configurado no onboarding do estabelecimento.
- Gravado exclusivamente como hash bcrypt em `Negocio.pinDonoHash`.
- Exigido para autorizar operações críticas:
  - Validação pontual via `POST /auth/validar-pin`.
  - Liberação operacional DEMO em `POST /pedidos/:id/liberacao-demo`.
  - Atualização de configurações sensíveis do negócio (planejado).
  - Cancelamentos manuais e autorização de estornos (planejado).

---

## 4. Ciclo de Vida do Pedido, Estados e Regras de Negócio

### 4.1 Separação entre Estados Financeiros e de Produção

O TotemOS desacopla categoricamente o status de transação financeira do status físico do pedido na cozinha:

- **Estados Financeiros (`Pagamento.status`)**:
  - `PENDENTE`: Aguardando processamento do pagamento.
  - `APROVADO`: Transação financeira confirmada pelo adquirente.
  - `RECUSADO`: Pagamento negado ou cancelado no gateway.
  - `ESTORNADO`: Valor devolvido ao cliente.
- **Estados de Produção (`Pedido.status`)**:
  - `AGUARDANDO_PAGAMENTO`: Estado inicial obrigatório de todo novo pedido gerado no Totem.
  - `PENDENTE`: Pedido autorizado e elegível para a fila da cozinha.
  - `EM_PREPARO`: Pedido aceito e em elaboração na cozinha pelo KDS.
  - `PRONTO`: Pedido finalizado, aguardando retirada pelo cliente.
  - `ENTREGUE`: Pedido retirado pelo cliente e concluído.
  - `CANCELADO_AGUARDANDO_ESTORNO` e `CANCELADO`: Estados de cancelamento.

### 4.2 Nascimento do Pedido e Elegibilidade de Cozinha

1. Todo pedido nasce via `POST /pedidos` com `status: AGUARDANDO_PAGAMENTO` e `senha: null`.
2. Pedidos contendo exclusivamente produtos com preparo zero (`tempoEstimadoPreparo = 0`, como bebidas em lata) são marcados com `preparoZero: true`, mas **também nascem** com `status: AGUARDANDO_PAGAMENTO` e `senha: null`.
3. Um pedido só se torna elegível para a fila da cozinha (`PENDENTE`) após confirmação financeira oficial ou mediante liberação operacional DEMO devidamente auditada.
4. Quando um pedido com `preparoZero: true` recebe autorização operacional (seja por pagamento aprovado ou por liberação DEMO), seu status avança automaticamente para `PRONTO`, sem passar por `EM_PREPARO`.

### 4.3 Atribuição Atômica de Senha Diária pelo KDS (`POST /pedidos/:id/senha`)

Contrato aprovado e implementado no incremento do card #31:

- A numeração sequencial diária é de autoridade do Painel de Pedidos (KDS), executada via solicitação autenticada de dispositivo `PAINEL`.
- O backend NestJS calcula e persiste a senha atomicamente no PostgreSQL por negócio e dia civil `America/Sao_Paulo` (`dataOperacional`), utilizando a tabela `ContadorSenha` com incremento serializado e gravando o registro imutável em `AtribuicaoSenha`.
- O campo `Pedido.senha` nasce `null` e só é preenchido uma única vez nesta rota.
- Requisições repetidas com a mesma chave de idempotência retornam o mesmo número já emitido (`repetida: true`).
- Rotas de leitura (`GET /pedidos`, `GET /pedidos/fila`, `GET /pedidos/:id`) nunca geram ou alteram senhas.

### 4.4 Política de Liberação Operacional DEMO (`POST /pedidos/:id/liberacao-demo`)

Contrato aprovado e implementado no incremento do card #29:

- Finalidade exclusiva: permitir testes e demonstrações de ponta a ponta em ambientes não produtivos sem necessidade de cartão de crédito real ou maquininha física.
- Restrições invioláveis:
  - O servidor exige variáveis de ambiente `DEMO_ENVIRONMENT_ALLOWED=true` e `DEMO_ENVIRONMENT_NAME` explicitamente configuradas.
  - O pedido deve ter sido criado com a flag `demo: true`.
  - Exige usuário humano autenticado com perfil `DONO` e validação do PIN do dono no body.
  - **Nunca grava `Pagamento APROVADO` fictício**. A autorização é puramente operacional (`autorizacaoOperacional: { tipo: 'DEMO', financeira: false }`).
  - Persiste registro de auditoria imutável na tabela `LiberacaoDemo`, contendo motivo, identificador do usuário, hash do payload e versões do pedido.

### 4.5 Transições de Status no KDS (`PATCH /pedidos/:id/status`)

- Operações permitidas pelo KDS: `EM_PREPARO`, `PRONTO`, `ENTREGUE`.
- Exige que o pedido já possua senha atribuída (`senha !== null`) e autorização operacional válida.
- Exige cabeçalho `X-Idempotency-Key` e campo `versaoEsperada` para controle de concorrência otimista. Rejeita com 409 Conflict caso a versão tenha sido alterada por outro terminal.
- Cada transição bem-sucedida gera um registro de auditoria imutável na tabela `TransicaoPedido`.

---

## 5. Multi-tenancy, Snapshots, Idempotência e Integridade

### 5.1 Isolamento Estrito de Tenant (`negocioId`)

- Em rotas autenticadas, o `negocioId` é derivado **exclusivamente da sessão autenticada** (`request.user.negocioId`). O backend nunca aceita o `negocioId` via corpo da requisição ou query string nessas rotas.
- Todas as operações no banco de dados incluem obrigatoriamente a cláusula de filtro `where: { negocioId }`.
- Tentativas de consultar ou alterar recursos de outro estabelecimento retornam 404 Not Found, evitando vazamento sobre a existência do ID.

### 5.2 Snapshots Imutáveis de Preço e Prevenção contra Fraude (Anti-tampering)

- Regra de negócio global: O cliente (Totem ou Dashboard) **jamais envia preços** no payload de criação de pedido (`POST /pedidos`).
- O schema Zod rejeita estritamente a presença de campos como `valorTotal`, `precoBase`, `preco` ou `precoNoMomento` no corpo da requisição.
- O backend consulta o catálogo no banco de dados para os itens selecionados, valida se estão ativos e não esgotados, verifica os limites de adicionais configurados e grava snapshots definitivos:
  - `PedidoItem.precoNoMomento`
  - `PedidoItemAdicional.precoNoMomento`
  - `PedidoItemEscolha.deltaNoMomento`
  - `Pedido.valorTotal` (calculado no servidor)
- O valor histórico de um pedido concluído nunca é recalculado com base nas variações futuras do catálogo.

### 5.3 Idempotência e Concorrência Otimista

- Cabeçalho `X-Idempotency-Key` (UUID v4) é suportado e armazenado nas operações mutantes de pedidos (`POST /pedidos`, `POST /pedidos/:id/senha`, `PATCH /pedidos/:id/status`, `POST /pedidos/:id/liberacao-demo`).
- Em caso de reenvio de requisição com a mesma chave, o backend detecta a repetição e retorna a resposta armazenada anteriormente sem executar novas mutações.
- A coluna `Pedido.versao` é incrementada atomicamente a cada mutação de estado. As rotas operacionais do KDS exigem `versaoEsperada`, prevenindo atualizações simultâneas conflitantes.

---

## 6. Limites do Spike LAN e Cenários de Pagamento

### 6.1 Limites do Spike LAN (`INCONCLUSIVE`)

O experimento técnico documentado em `docs/spikes/kds-local-network.md` avaliou a hipótese de um servidor HTTP/WebSocket embarcado no KDS com descoberta mDNS na rede local. O resultado do spike é **INCONCLUSIVE**:

1. **Evidência obtida**: Adapters isolados compilaram e executaram em hardware físico (Galaxy A54) e contra fixture em máquina de teste; mDNS anunciou e resolveu serviços; rotas de health HTTP e WebSocket responderam a mensagens diagnósticas.
2. **Limitações impeditivas**:
   - A integração direta entre dois dispositivos Android físicos (KDS Android ↔ Totem Android) na mesma rede Wi-Fi não foi testada por indisponibilidade de um segundo aparelho físico.
   - O encerramento voluntário de conexão WebSocket (`close(1000)`) terminou com erro e código 1006 (`FAIL`).
   - Problemas inerentes a redes locais comerciais (isolamento de clientes Wi-Fi em roteadores, Doze Mode do Android e ausência de TLS) não possuem garantia no protocolo atual.
3. **Decisão do P0**: O MVP do TotemOS é **exclusivamente cloud-online** via HTTPS/WSS. Nenhuma rota de reconciliação LAN ou sincronização offline é suportada no P0.

### 6.2 Separação de Cenários de Pagamento

- **Ambiente DEMO (Implementado no P0)**: Ensaios operacionais de ponta a ponta sem maquininha física, utilizando liberação auditada com PIN do dono.
- **Ambiente Sandbox (Planejado, P2)**: Simulação de gateway de pagamento via API (cartão mockado e Pix estático) sem terminal físico Point.
- **Produção Real com Point Física (Pós-MVP)**: Disparo de intent para maquininhas físicas Mercado Pago Point (`POST /pagamentos/intent`) e processamento assíncrono de webhooks com verificação de assinatura criptográfica.

---

## 7. Catálogo Completo de Endpoints HTTP e Payloads

### 7.1 Resumo Geral por Status

| Rota | Método | Status | Autenticação Requerida | Papel / Escopo |
| --- | --- | --- | --- | --- |
| `/auth/registrar` | POST | **IMPLEMENTADO** | Pública | Onboarding de negócio e usuário Dono |
| `/auth/login` | POST | **IMPLEMENTADO** | Pública | Login do usuário humano na Dashboard |
| `/auth/me` | GET | **IMPLEMENTADO** | Bearer JWT | Perfil do usuário humano autenticado |
| `/auth/validar-pin` | POST | **IMPLEMENTADO** | Bearer JWT | Validação de PIN de segurança do Dono |
| `/dispositivos/parear/codigo` | POST | **IMPLEMENTADO** | Bearer JWT | Dono: gera código de 6 dígitos para pareamento |
| `/dispositivos/parear/ativar` | POST | **IMPLEMENTADO** | Pública (Rate Limit) | Ativação do dispositivo via código, retorna token |
| `/dispositivos` | GET | **IMPLEMENTADO** | Bearer JWT | Dono ou Gerente: lista dispositivos do tenant |
| `/dispositivos/:id` | DELETE | **IMPLEMENTADO** | Bearer JWT | Dono: revoga dispositivo e invalida token |
| `/dispositivos/me` | GET | **IMPLEMENTADO** | `deviceToken` | Identidade e configurações do dispositivo |
| `/catalogo/publico/:negocioId` | GET | **IMPLEMENTADO** | Pública | Cardápio público para Totem (apenas itens disponíveis) |
| `/catalogo/admin` | GET | **IMPLEMENTADO** | Bearer JWT | Dono ou Gerente: visão administrativa completa |
| `/catalogo/categorias` | POST | **IMPLEMENTADO** | Bearer JWT | Dono ou Gerente: cria categoria no cardápio |
| `/catalogo/categorias/:id` | PUT | **IMPLEMENTADO** | Bearer JWT | Dono ou Gerente: edita categoria no cardápio |
| `/catalogo/produtos` | POST | **IMPLEMENTADO** | Bearer JWT | Dono ou Gerente: cria produto no cardápio |
| `/catalogo/produtos/:id` | PUT | **IMPLEMENTADO** | Bearer JWT | Dono ou Gerente: edita produto no cardápio |
| `/catalogo/produtos/:id` | DELETE | **IMPLEMENTADO** | Bearer JWT | Dono ou Gerente: desativação lógica de produto |
| `/pedidos` | POST | **IMPLEMENTADO** | AnyAuth + Totem/User | Cria pedido com cálculo seguro e snapshot |
| `/pedidos` | GET | **IMPLEMENTADO** | AnyAuth + Painel/User | Lista pedidos do tenant |
| `/pedidos/fila` | GET | **IMPLEMENTADO** | AnyAuth + Painel/User | Fila de pedidos elegíveis da cozinha |
| `/pedidos/:id/acompanhamento`| GET | **IMPLEMENTADO** | `deviceToken` (Totem) | Projeção mínima para acompanhamento no totem criador |
| `/pedidos/:id` | GET | **IMPLEMENTADO** | AnyAuth + Painel/User | Consulta detalhe do pedido |
| `/pedidos/:id/senha` | POST | **IMPLEMENTADO** | `deviceToken` (Painel)| Atribuição sequencial diária de senha pelo KDS |
| `/pedidos/:id/status` | PATCH | **IMPLEMENTADO** | AnyAuth + Painel/User | Transição de status no KDS (`EM_PREPARO`, `PRONTO`, `ENTREGUE`) |
| `/pedidos/:id/liberacao-demo`| POST | **IMPLEMENTADO** | Bearer JWT (Dono) | Liberação operacional auditada em ambiente DEMO |
| `/dispositivos/:id/maquininha-point` | POST | **PLANEJADO** | Bearer JWT | Associação com terminal Point |
| `/negocios/:id/config` | GET, PUT | **PLANEJADO** | Bearer JWT (Dono/PIN) | Configurações gerais do negócio |
| `/pagamentos/intent` | POST | **PLANEJADO** | `deviceToken` (Totem) | Disparo de cobrança na maquininha Point física |
| `/pagamentos/webhook/mercadopago` | POST | **PLANEJADO** | Pública (HMAC MP) | Webhook assíncrono de confirmação financeira |
| `/pedidos/:id/cancelar` | POST | **PLANEJADO** | Bearer JWT (Dono/PIN) | Cancelamento formal e estorno financeiro |
| `/relatorios/faturamento/:id` | GET | **PLANEJADO** | Bearer JWT | Relatório gerencial de faturamento |
| `/relatorios/mais-vendidos/:id` | GET | **PLANEJADO** | Bearer JWT | Relatório de itens mais vendidos |
| `/pedidos/reconciliar` | POST | **EXPERIMENTAL** | Hipótese offline | Reconciliação em lote após queda de rede |

---

### 7.2 Detalhamento de Endpoints Implementados e Payloads

#### Módulo: Autenticação e Usuários

##### `POST /auth/registrar`
- **Autenticação**: Pública.
- **Request Body**:
  ```json
  {
    "nomeNegocio": "Hamburgueria Artesanal",
    "slugNegocio": "hamburgueria-artesanal",
    "pinDono": "1234",
    "nomeUsuario": "Carlos Dono",
    "email": "carlos@hamburgueria.com",
    "senhaPlana": "senhaForte123"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "id": "uuid-do-usuario",
      "nome": "Carlos Dono",
      "email": "carlos@hamburgueria.com",
      "role": "DONO",
      "negocioId": "uuid-do-negocio",
      "negocioNome": "Hamburgueria Artesanal"
    }
  }
  ```

##### `POST /auth/login`
- **Autenticação**: Pública.
- **Request Body**:
  ```json
  {
    "email": "carlos@hamburgueria.com",
    "senhaPlana": "senhaForte123"
  }
  ```
- **Response (200 OK)**: Retorna o mesmo formato de resposta do registro, com token JWT válido por 7 dias.

##### `GET /auth/me`
- **Autenticação**: `Bearer <jwt>`.
- **Response (200 OK)**: Dados do usuário logado e de seu estabelecimento associado.

##### `POST /auth/validar-pin`
- **Autenticação**: `Bearer <jwt>`.
- **Request Body**:
  ```json
  {
    "negocioId": "uuid-do-negocio",
    "pin": "1234"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "valido": true
  }
  ```

---

#### Módulo: Dispositivos e Pareamento

##### `POST /dispositivos/parear/codigo`
- **Autenticação**: `Bearer <jwt>`, restrito a perfil `DONO`.
- **Request Body**:
  ```json
  {
    "nome": "Totem Entrada 01",
    "tipo": "TOTEM"
  }
  ```
  *(Valores aceitos em `tipo`: `"TOTEM"` ou `"PAINEL"`)*
- **Response (201 Created)**:
  ```json
  {
    "codigo": "489201",
    "expiraEm": "2026-11-01T22:30:00.000Z"
  }
  ```

##### `POST /dispositivos/parear/ativar`
- **Autenticação**: Pública (sujeita a rate limit por IP).
- **Request Body**:
  ```json
  {
    "codigo": "489201"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "deviceToken": "k8Xz_9BvLw1... (token de uso contínuo, exibido uma única vez)",
    "dispositivo": {
      "id": "uuid-do-dispositivo",
      "negocioId": "uuid-do-negocio",
      "nome": "Totem Entrada 01",
      "tipo": "TOTEM",
      "pareadoEm": "2026-11-01T22:16:00.000Z",
      "ativo": true,
      "revogadoEm": null,
      "createdAt": "2026-11-01T22:16:00.000Z"
    }
  }
  ```

##### `GET /dispositivos`
- **Autenticação**: `Bearer <jwt>`, perfis `DONO` ou `GERENTE`.
- **Response (200 OK)**: Lista resumida de todos os dispositivos pareados do tenant, sem revelar segredos criptográficos.

##### `DELETE /dispositivos/:id`
- **Autenticação**: `Bearer <jwt>`, restrito a `DONO`.
- **Response (204 No Content)**: Dispositivo marcado imediatamente como inativo e revogado.

##### `GET /dispositivos/me`
- **Autenticação**: `Bearer <deviceToken>`.
- **Response (200 OK)**: Identidade do dispositivo autenticado e parâmetros operacionais do estabelecimento (modo de identificação e mensagem de boas-vindas).

---

#### Módulo: Catálogo

##### `GET /catalogo/publico/:negocioId`
- **Autenticação**: Pública.
- **Response (200 OK)**: Categorias ativas com produtos ativos e não esgotados, acompanhados de suas variações e adicionais disponíveis.

##### `GET /catalogo/admin`
- **Autenticação**: `Bearer <jwt>`, perfis `DONO` ou `GERENTE`.
- **Response (200 OK)**: Visão de gestão completa com todas as categorias (mesmo inativas ou vazias), produtos inativos ou esgotados e controles administrativos.

##### `POST /catalogo/categorias`
- **Autenticação**: `Bearer <jwt>`, perfis `DONO` ou `GERENTE`.
- **Request Body**:
  ```json
  {
    "nome": "Bebidas",
    "ordem": 1
  }
  ```
- **Response (201 Created)**: Categoria criada vinculada ao tenant da sessão.

##### `PUT /catalogo/categorias/:id`
- **Autenticação**: `Bearer <jwt>`, perfis `DONO` ou `GERENTE`.
- **Request Body**: Campos opcionais (`nome`, `ordem`, `ativo`).
- **Response (200 OK)**: Categoria atualizada.

##### `POST /catalogo/produtos`
- **Autenticação**: `Bearer <jwt>`, perfis `DONO` ou `GERENTE`.
- **Request Body**:
  ```json
  {
    "categoriaId": "uuid-da-categoria",
    "nome": "X-Bacon Especial",
    "descricao": "Hambúrguer 180g, queijo cheddar e bacon crocante",
    "precoBase": 32.50,
    "imagemUrl": "https://cdn.exemplo.com/x-bacon.png",
    "tempoEstimadoPreparo": 15,
    "esgotado": false,
    "ativo": true,
    "adicionais": [
      {
        "nome": "Bacon Extra",
        "preco": 5.00,
        "maximo": 2
      }
    ]
  }
  ```
- **Response (201 Created)**: Produto cadastrado com adicionais associados.

##### `PUT /catalogo/produtos/:id`
- **Autenticação**: `Bearer <jwt>`, perfis `DONO` ou `GERENTE`.
- **Request Body**: Atualização parcial de atributos do produto ou substituição da lista de adicionais.
- **Response (200 OK)**: Produto atualizado.

##### `DELETE /catalogo/produtos/:id`
- **Autenticação**: `Bearer <jwt>`, perfis `DONO` ou `GERENTE`.
- **Response (204 No Content)**: Desativação lógica do produto (`ativo = false`).

---

#### Módulo: Pedidos e Ciclo de Produção

##### `POST /pedidos`
- **Autenticação**: `AnyAuthGuard` + `DeviceTypeGuard` (apenas `TOTEM` ou usuário humano).
- **Headers Opcionais**: `X-Idempotency-Key: <uuid>`.
- **Request Body**:
  ```json
  {
    "idempotencyKey": "uuid-opcional",
    "nomeCliente": "João",
    "codigoCliente": "J40",
    "observacoes": "Sem cebola no hambúrguer",
    "itens": [
      {
        "produtoId": "uuid-do-produto",
        "quantidade": 1,
        "observacao": "Ponto da carne bem passado",
        "variacaoNome": "Duplo",
        "adicionais": [
          {
            "adicionalId": "uuid-do-adicional",
            "quantidade": 1
          }
        ]
      }
    ]
  }
  ```
  *(Campos de preço como `valorTotal`, `precoBase` e `precoNoMomento` são expressamente proibidos e causam rejeição 400 Bad Request).*
- **Response (201 Created)**:
  ```json
  {
    "id": "uuid-do-pedido",
    "status": "AGUARDANDO_PAGAMENTO",
    "senha": null,
    "valorTotal": "37.50",
    "preparoZero": false,
    "versao": 1,
    "createdAt": "2026-11-01T22:20:00.000Z"
  }
  ```

##### `GET /pedidos/fila`
- **Autenticação**: `AnyAuthGuard` + `DeviceTypeGuard` (apenas `PAINEL` ou usuário humano).
- **Query Params**: `limite` (padrão 50, máx 100), `cursor` (paginação opcional).
- **Response (200 OK)**: Lista paginada dos pedidos em estado `PENDENTE`, `EM_PREPARO` ou `PRONTO`.

##### `GET /pedidos/:id/acompanhamento`
- **Autenticação**: `DeviceTokenGuard` restrito exclusivamente ao dispositivo `TOTEM` que criou o pedido.
- **Response (200 OK)**: Projeção resumida contendo status, senha (se emitida) e total, sem expor dados financeiros internos ou de outros totens.

##### `GET /pedidos` e `GET /pedidos/:id`
- **Autenticação**: `AnyAuthGuard` (dispositivos `TOTEM` são rejeitados). Usuários humanos recebem detalhamento administrativo completo; dispositivos `PAINEL` recebem dados operacionais do pedido.

##### `POST /pedidos/:id/senha`
- **Autenticação**: `DeviceTokenGuard` restrito exclusivamente a `PAINEL` (KDS).
- **Headers Obrigatórios**: `X-Idempotency-Key: <uuid>`.
- **Request Body**: `{}` (objeto vazio estrito).
- **Response (200 OK / 201 Created)**:
  ```json
  {
    "resultadoOperacao": {
      "tipo": "ATRIBUICAO_SENHA",
      "repetida": false
    },
    "pedido": {
      "id": "uuid-do-pedido",
      "status": "PENDENTE",
      "senha": 14,
      "dataOperacional": "2026-11-01",
      "versao": 2,
      "demo": false
    }
  }
  ```

##### `PATCH /pedidos/:id/status`
- **Autenticação**: `AnyAuthGuard` + `DeviceTypeGuard` (apenas `PAINEL` ou usuário humano).
- **Headers Obrigatórios**: `X-Idempotency-Key: <uuid>`.
- **Request Body**:
  ```json
  {
    "status": "EM_PREPARO",
    "versaoEsperada": 2
  }
  ```
  *(Status aceitos nesta rota: `"EM_PREPARO"`, `"PRONTO"`, `"ENTREGUE"`).*
- **Response (200 OK)**:
  ```json
  {
    "resultadoOperacao": {
      "tipo": "TRANSICAO",
      "repetida": false
    },
    "pedido": {
      "id": "uuid-do-pedido",
      "status": "EM_PREPARO",
      "senha": 14,
      "dataOperacional": "2026-11-01",
      "versao": 3,
      "demo": false,
      "demoAmbiente": null,
      "elegivelCozinha": true
    }
  }
  ```

##### `POST /pedidos/:id/liberacao-demo`
- **Autenticação**: `Bearer <jwt>`, restrito a usuário humano `DONO`.
- **Headers Obrigatórios**: `X-Idempotency-Key: <uuid>`.
- **Request Body**:
  ```json
  {
    "motivo": "Ensaio operacional do fluxo de cozinha",
    "pin": "1234",
    "versaoEsperada": 1
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "resultadoOperacao": {
      "tipo": "LIBERACAO_DEMO",
      "repetida": false
    },
    "pedido": {
      "id": "uuid-do-pedido",
      "status": "PENDENTE",
      "senha": null,
      "versao": 2,
      "demo": true,
      "demoAmbiente": "staging",
      "elegivelCozinha": true,
      "autorizacaoOperacional": {
        "tipo": "DEMO",
        "financeira": false
      }
    }
  }
  ```

---

## 8. Documentos Complementares e Referências Internas

- Contrato da liberação DEMO: [`docs/liberacao-demo.md`](liberacao-demo.md)
- Contrato da numeração de senha diária KDS: [`docs/senha-diaria-kds.md`](senha-diaria-kds.md)
- Matriz de transições e elegibilidade de pedidos: [`docs/transicoes-pedidos.md`](transicoes-pedidos.md)
- Pareamento de dispositivos: [`docs/device-pairing-contract.md`](device-pairing-contract.md)
- Relatório do spike de rede local: [`docs/spikes/kds-local-network.md`](spikes/kds-local-network.md)
- Especificação da arquitetura técnica: [`docs/arquitetura-tecnica-v1.md`](arquitetura-tecnica-v1.md)
