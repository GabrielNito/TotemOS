-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "senhaAtribuidaEm" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ContadorSenha" (
    "negocioId" TEXT NOT NULL,
    "dataOperacional" TEXT NOT NULL,
    "ultimoNumero" INTEGER NOT NULL,

    CONSTRAINT "ContadorSenha_pkey" PRIMARY KEY ("negocioId","dataOperacional")
);

-- CreateTable
CREATE TABLE "AtribuicaoSenha" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "atorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "senha" INTEGER NOT NULL,
    "dataOperacional" TEXT NOT NULL,
    "versaoAnterior" INTEGER NOT NULL,
    "versaoNova" INTEGER NOT NULL,
    "primeiraAtribuicao" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtribuicaoSenha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtribuicaoSenha_negocioId_pedidoId_createdAt_idx" ON "AtribuicaoSenha"("negocioId", "pedidoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AtribuicaoSenha_negocioId_atorId_idempotencyKey_key" ON "AtribuicaoSenha"("negocioId", "atorId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ContadorSenha" ADD CONSTRAINT "ContadorSenha_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtribuicaoSenha" ADD CONSTRAINT "AtribuicaoSenha_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
