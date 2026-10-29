-- A senha diária pertence ao KDS; pedidos aguardando pagamento ainda não a possuem.
ALTER TABLE "Pedido" ALTER COLUMN "senha" DROP NOT NULL;
