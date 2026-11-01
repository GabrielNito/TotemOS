export type OpenStatus = "PENDENTE" | "EM_PREPARO" | "PRONTO";
export type Target = "EM_PREPARO" | "PRONTO" | "ENTREGUE";
export interface Summary {
  id: string;
  status: string;
  senha: number | null;
  dataOperacional: string | null;
  versao: number;
  demo: boolean;
}
export interface Order extends Summary {
  status: OpenStatus;
  demoAmbiente: string | null;
  createdAt: string;
  preparoZero: boolean;
  elegivelCozinha: true;
  autorizacaoOperacional: { tipo: "DEMO"; financeira: false } | null;
  itens: {
    nomeProduto: string;
    quantidade: number;
    variacaoNome: string | null;
    observacao: string | null;
    adicionais: { nomeAdicional: string; quantidade: number }[];
    escolhas: { nomeItem: string }[];
  }[];
}
export interface PendingOperation {
  key: string;
  orderId: string;
  kind: "senha" | "status";
  target?: Target;
  version?: number;
  attempts: number;
  nextAttempt: number;
}
export interface OperationStorage {
  load(): Promise<PendingOperation[]>;
  save(ops: PendingOperation[]): Promise<void>;
}
export interface QueueApi {
  list(signal?: AbortSignal): Promise<Order[]>;
  execute(op: PendingOperation, signal?: AbortSignal): Promise<Summary>;
}
export const nextTarget = (status: OpenStatus): Target =>
  (
    ({
      PENDENTE: "EM_PREPARO",
      EM_PREPARO: "PRONTO",
      PRONTO: "ENTREGUE",
    }) as const
  )[status];
