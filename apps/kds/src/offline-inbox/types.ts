export type OfflineOrderRequest = {
  nomeCliente?: string;
  codigoCliente?: string;
  observacoes?: string;
  itens: {
    produtoId: string;
    quantidade: number;
    observacao?: string;
    variacaoNome?: string;
    adicionais: { adicionalId: string; quantidade: number }[];
    escolhas?: { itemDoGrupoId: string }[];
  }[];
};

export type OfflineEnvelope = {
  negocioId: string;
  dispositivoId: string;
  idempotencyKey: string;
  recebidoEm: number;
  valorEstimado?: number;
  pedido: OfflineOrderRequest;
};

export type ReconciliationItem = Pick<
  OfflineEnvelope,
  "dispositivoId" | "idempotencyKey" | "pedido"
>;

export interface OfflineInboxStorage {
  load(): Promise<OfflineEnvelope[]>;
  save(envelopes: OfflineEnvelope[]): Promise<void>;
}

export interface OfflineReconciliationApi {
  reconcile(lote: { pedidos: ReconciliationItem[] }): Promise<{
    pedidos: {
      id: string;
      idempotencyKey: string;
      status: "AGUARDANDO_PAGAMENTO";
    }[];
  }>;
}
