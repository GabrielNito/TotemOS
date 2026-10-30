CREATE TABLE "TransicaoPedido" (
  "id" TEXT NOT NULL,
  "negocioId" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "atorId" TEXT NOT NULL,
  "identidade" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "statusAnterior" "StatusPedido" NOT NULL,
  "statusNovo" "StatusPedido" NOT NULL,
  "versaoAnterior" INTEGER NOT NULL,
  "versaoNova" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransicaoPedido_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransicaoPedido_negocioId_identidade_atorId_idempotencyKey_key"
  ON "TransicaoPedido"("negocioId", "identidade", "atorId", "idempotencyKey");
CREATE INDEX "TransicaoPedido_negocioId_pedidoId_createdAt_idx"
  ON "TransicaoPedido"("negocioId", "pedidoId", "createdAt");
ALTER TABLE "TransicaoPedido" ADD CONSTRAINT "TransicaoPedido_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
