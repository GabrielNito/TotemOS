import type { CartLine } from "./model";

export type OrderRequest = {
  nomeCliente?: string;
  codigoCliente?: string;
  itens: {
    produtoId: string;
    quantidade: number;
    variacaoNome?: string;
    adicionais: { adicionalId: string; quantidade: number }[];
  }[];
};
export type PendingOrder = {
  id: string;
  negocioId: string;
  status: "AGUARDANDO_PAGAMENTO";
  valorTotal: string | number;
};
export type OrderAttempt = {
  negocioId: string;
  key: string;
  request: OrderRequest;
  result?: PendingOrder;
};
type Storage = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
};
type Send = (request: OrderRequest, key: string) => Promise<unknown>;
export class OrderRejectedError extends Error {}

export function buildOrderRequest(
  cart: CartLine[],
  name: string,
  mode: "NOME" | "CODIGO" | "OPCIONAL",
): OrderRequest {
  if (!cart.length || (mode === "NOME" && !name.trim()))
    throw new Error("Confira os itens e a identificação.");
  return {
    ...(mode !== "CODIGO" && name.trim() ? { nomeCliente: name.trim() } : {}),
    itens: cart.map((line) => {
      const variation = line.product.variacoes.find(
        (v) => v.id === line.selection.variacaoId,
      );
      if (line.product.variacoes.length && !variation)
        throw new Error("Escolha uma opção do produto.");
      return {
        produtoId: line.product.id,
        quantidade: line.quantidade,
        ...(variation ? { variacaoNome: variation.nome } : {}),
        adicionais: Object.entries(line.selection.adicionais)
          .filter(([, n]) => n > 0)
          .map(([adicionalId, quantidade]) => ({ adicionalId, quantidade })),
      };
    }),
  };
}

function validateResult(value: unknown, negocioId: string): PendingOrder {
  const result = value as PendingOrder | null;
  if (
    !result ||
    typeof result.id !== "string" ||
    !result.id ||
    result.negocioId !== negocioId ||
    result.status !== "AGUARDANDO_PAGAMENTO" ||
    !["string", "number"].includes(typeof result.valorTotal) ||
    !Number.isFinite(Number(result.valorTotal)) ||
    Number(result.valorTotal) < 0
  )
    throw new Error(
      "Não foi possível confirmar o resultado. Tente consultar novamente.",
    );
  return {
    id: result.id,
    negocioId,
    status: result.status,
    valorTotal: result.valorTotal,
  };
}

/** Locks an uncertain attempt until its exact request has been recovered. */
export class OrderSubmission {
  attempt: OrderAttempt | null = null;
  private busy = false;
  constructor(
    private negocioId: string,
    private storage: Storage,
    private send: Send,
    private uuid: () => string,
  ) {}
  async restore() {
    const saved = await this.storage.get();
    if (!saved) return;
    const value = JSON.parse(saved) as OrderAttempt;
    if (
      value.negocioId !== this.negocioId ||
      !value.key ||
      !Array.isArray(value.request?.itens) ||
      !value.request.itens.length
    )
      throw new Error(
        "Tentativa de pedido inválida. Solicite ajuda ao estabelecimento.",
      );
    if (value.result)
      value.result = validateResult(value.result, this.negocioId);
    this.attempt = value;
  }
  prepare(request: OrderRequest): Promise<void> {
    if (this.attempt || this.busy)
      throw new Error("Existe um pedido em andamento.");
    const key = this.uuid();
    const attempt: OrderAttempt = {
      negocioId: this.negocioId,
      key,
      request: JSON.parse(JSON.stringify(request)),
    };
    if (!attempt.request.nomeCliente)
      attempt.request.codigoCliente = `T-${key.slice(0, 8).toUpperCase()}`;
    this.busy = true;
    return this.storage
      .set(JSON.stringify(attempt))
      .then(() => {
        this.attempt = attempt;
      })
      .finally(() => {
        this.busy = false;
      });
  }
  async submit(): Promise<PendingOrder> {
    if (this.busy || !this.attempt)
      throw new Error("Envio em andamento ou pedido ausente.");
    if (this.attempt.result) return this.attempt.result;
    this.busy = true;
    try {
      const result = validateResult(
        await this.send(this.attempt.request, this.attempt.key),
        this.negocioId,
      );
      // An unsuccessful write keeps the original request available for a safe retry.
      await this.storage.set(JSON.stringify({ ...this.attempt, result }));
      this.attempt.result = result;
      return result;
    } catch (error) {
      if (error instanceof OrderRejectedError) {
        await this.storage.set("");
        this.attempt = null;
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
