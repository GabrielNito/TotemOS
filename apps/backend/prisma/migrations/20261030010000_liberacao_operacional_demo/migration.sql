-- Pedidos anteriores permanecem reais e não podem ser convertidos pelo endpoint.
ALTER TABLE "Pedido"
  ADD COLUMN "demo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "demoAmbiente" TEXT,
  ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "LiberacaoDemo" (
  "id" TEXT NOT NULL,
  "negocioId" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "ambiente" TEXT NOT NULL,
  "versaoAnterior" INTEGER NOT NULL,
  "versaoLiberada" INTEGER NOT NULL,
  "transicoes" "StatusPedido"[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiberacaoDemo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiberacaoDemo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LiberacaoDemo_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LiberacaoDemo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LiberacaoDemo_pedidoId_key" ON "LiberacaoDemo"("pedidoId");
CREATE UNIQUE INDEX "LiberacaoDemo_negocioId_usuarioId_idempotencyKey_key" ON "LiberacaoDemo"("negocioId", "usuarioId", "idempotencyKey");
CREATE INDEX "LiberacaoDemo_negocioId_createdAt_idx" ON "LiberacaoDemo"("negocioId", "createdAt");
