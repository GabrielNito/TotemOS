-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DONO', 'GERENTE');

-- CreateEnum
CREATE TYPE "TipoDispositivo" AS ENUM ('TOTEM', 'PAINEL');

-- CreateEnum
CREATE TYPE "StatusCodigoPareamento" AS ENUM ('ATIVO', 'CONSUMIDO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('AGUARDANDO_PAGAMENTO', 'PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO_AGUARDANDO_ESTORNO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ModoIdentificacao" AS ENUM ('NOME', 'CODIGO', 'OPCIONAL');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'ESTORNADO');

-- CreateEnum
CREATE TYPE "MeioPagamento" AS ENUM ('CREDITO', 'DEBITO', 'PIX');

-- CreateTable
CREATE TABLE "Negocio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pinDonoHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegocioConfig" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "modoIdentificacao" "ModoIdentificacao" NOT NULL DEFAULT 'OPCIONAL',
    "tempoPadraoPreparo" INTEGER NOT NULL DEFAULT 15,
    "permitirPagamentoOffline" BOOLEAN NOT NULL DEFAULT true,
    "mensagemBoasVindas" TEXT,

    CONSTRAINT "NegocioConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DONO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoDispositivo" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pareadoEm" TIMESTAMP(3),
    "mpPointDeviceId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "revogadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoPareamento" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "criadoPorUsuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoDispositivo" NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusCodigoPareamento" NOT NULL DEFAULT 'ATIVO',
    "consumidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoPareamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PareamentoRateLimit" (
    "chave" TEXT NOT NULL,
    "janelaInicio" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PareamentoRateLimit_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "precoBase" DECIMAL(10,2) NOT NULL,
    "imagemUrl" TEXT,
    "tempoEstimadoPreparo" INTEGER NOT NULL DEFAULT 0,
    "esgotado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoVariacao" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "esgotado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProdutoVariacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adicional" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "maximo" INTEGER NOT NULL DEFAULT 1,
    "esgotado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Adicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combo" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "precoFixo" DECIMAL(10,2) NOT NULL,
    "imagemUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Combo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoDeEscolha" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "minimo" INTEGER NOT NULL DEFAULT 1,
    "maximo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GrupoDeEscolha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDoGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "deltaPreco" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "esgotado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ItemDoGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "dispositivoId" TEXT,
    "idempotencyKey" TEXT,
    "senha" INTEGER NOT NULL,
    "dataSequencial" TEXT NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "nomeCliente" TEXT,
    "codigoCliente" TEXT,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,
    "origemOffline" BOOLEAN NOT NULL DEFAULT false,
    "preparoZero" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nomeProduto" TEXT NOT NULL,
    "precoNoMomento" DECIMAL(10,2) NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "observacao" TEXT,
    "variacaoNome" TEXT,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItemAdicional" (
    "id" TEXT NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "adicionalId" TEXT,
    "nomeAdicional" TEXT NOT NULL,
    "precoNoMomento" DECIMAL(10,2) NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PedidoItemAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItemEscolha" (
    "id" TEXT NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "itemDoGrupoId" TEXT,
    "nomeItem" TEXT NOT NULL,
    "deltaNoMomento" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PedidoItemEscolha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "mpIntentId" TEXT,
    "mpPaymentId" TEXT,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "meio" "MeioPagamento",
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_slug_key" ON "Negocio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "NegocioConfig_negocioId_key" ON "NegocioConfig"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_tokenHash_key" ON "Dispositivo"("tokenHash");

-- CreateIndex
CREATE INDEX "CodigoPareamento_codigoHash_status_idx" ON "CodigoPareamento"("codigoHash", "status");

-- CreateIndex
CREATE INDEX "CodigoPareamento_negocioId_createdAt_idx" ON "CodigoPareamento"("negocioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CodigoPareamento_codigoHash_ativo_key"
ON "CodigoPareamento" ("codigoHash")
WHERE "status" = 'ATIVO';

-- CreateIndex
CREATE INDEX "PareamentoRateLimit_janelaInicio_idx" ON "PareamentoRateLimit"("janelaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_idempotencyKey_key" ON "Pedido"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_negocioId_dataSequencial_senha_key" ON "Pedido"("negocioId", "dataSequencial", "senha");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_mpIntentId_key" ON "Pagamento"("mpIntentId");

-- AddForeignKey
ALTER TABLE "NegocioConfig" ADD CONSTRAINT "NegocioConfig_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoPareamento" ADD CONSTRAINT "CodigoPareamento_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoPareamento" ADD CONSTRAINT "CodigoPareamento_criadoPorUsuarioId_fkey" FOREIGN KEY ("criadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoVariacao" ADD CONSTRAINT "ProdutoVariacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adicional" ADD CONSTRAINT "Adicional_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combo" ADD CONSTRAINT "Combo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoDeEscolha" ADD CONSTRAINT "GrupoDeEscolha_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDoGrupo" ADD CONSTRAINT "ItemDoGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoDeEscolha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemAdicional" ADD CONSTRAINT "PedidoItemAdicional_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "PedidoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemAdicional" ADD CONSTRAINT "PedidoItemAdicional_adicionalId_fkey" FOREIGN KEY ("adicionalId") REFERENCES "Adicional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemEscolha" ADD CONSTRAINT "PedidoItemEscolha_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "PedidoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItemEscolha" ADD CONSTRAINT "PedidoItemEscolha_itemDoGrupoId_fkey" FOREIGN KEY ("itemDoGrupoId") REFERENCES "ItemDoGrupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
