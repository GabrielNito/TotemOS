import type { CartLine } from "./model";
import {
  isOrderStatus,
  parseTracking,
  validOrderId,
  type OrderStatusValue,
  type TrackingSnapshot,
} from "./order-tracking";

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
  status: OrderStatusValue;
  valorTotal: string | number;
};
export type OrderAttempt = {
  negocioId: string;
  dispositivoId?: string;
  key: string;
  request: OrderRequest;
  result?: PendingOrder;
  tracking?: { snapshot: TrackingSnapshot; syncedAt: number };
  closing?: true;
};
type Storage = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
};
type Send = (request: OrderRequest, key: string) => Promise<unknown>;
export class OrderRejectedError extends Error {}

function onlyKeys(value: object, keys: string[]) {
  return (
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function validRequest(request: OrderRequest) {
  const text = (v: unknown) => typeof v === "string" && !!v.trim();
  const quantity = (v: number) => Number.isSafeInteger(v) && v > 0;
  return (
    !!request &&
    onlyKeys(request, ["nomeCliente", "codigoCliente", "itens"]) &&
    (request.nomeCliente === undefined || text(request.nomeCliente)) &&
    (request.codigoCliente === undefined || text(request.codigoCliente)) &&
    Array.isArray(request.itens) &&
    request.itens.length > 0 &&
    request.itens.every(
      (item) =>
        !!item &&
        onlyKeys(item, [
          "produtoId",
          "quantidade",
          "variacaoNome",
          "adicionais",
        ]) &&
        text(item.produtoId) &&
        quantity(item.quantidade) &&
        (item.variacaoNome === undefined || text(item.variacaoNome)) &&
        Array.isArray(item.adicionais) &&
        item.adicionais.every(
          (a) =>
            !!a &&
            onlyKeys(a, ["adicionalId", "quantidade"]) &&
            text(a.adicionalId) &&
            quantity(a.quantidade),
        ),
    )
  );
}

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
    !validOrderId(result.id) ||
    result.negocioId !== negocioId ||
    !isOrderStatus(result.status) ||
    !["string", "number"].includes(typeof result.valorTotal) ||
    (typeof result.valorTotal === "string" &&
      !/^\d+(\.\d{1,2})?$/.test(result.valorTotal)) ||
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
    private clearCart?: () => Promise<void>,
    private dispositivoId?: string,
  ) {}
  async restore() {
    const saved = await this.storage.get();
    if (!saved) {
      this.attempt = null;
      return;
    }
    const value = JSON.parse(saved) as OrderAttempt;
    if (
      !value ||
      value.negocioId !== this.negocioId ||
      (value.dispositivoId !== undefined &&
        value.dispositivoId !== this.dispositivoId) ||
      !validOrderId(value.key) ||
      !validRequest(value.request)
    )
      throw new Error(
        "Tentativa de pedido inválida. Solicite ajuda ao estabelecimento.",
      );
    if (value.result !== undefined)
      value.result = validateResult(value.result, this.negocioId);
    if (value.tracking !== undefined) {
      if (!value.result || !Number.isFinite(value.tracking.syncedAt))
        throw new Error("Acompanhamento salvo inválido. Solicite assistência.");
      value.tracking.snapshot = parseTracking(
        value.tracking.snapshot,
        value.result.id,
      );
    }
    if (value.closing !== undefined && value.closing !== true)
      throw new Error("Encerramento inválido.");
    this.attempt = value;
    if (value.closing) await this.finish();
  }
  async saveTracking(snapshot: TrackingSnapshot, syncedAt: number) {
    if (this.busy || !this.attempt?.result || this.attempt.closing)
      throw new Error("Pedido indisponível para atualização.");
    const validated = parseTracking(snapshot, this.attempt.result.id);
    const previous = this.attempt.tracking?.snapshot;
    if (
      previous &&
      (validated.versao < previous.versao || previous.status === "ENTREGUE")
    )
      return;
    this.busy = true;
    try {
      const next = {
        ...this.attempt,
        tracking: { snapshot: validated, syncedAt },
      };
      await this.storage.set(JSON.stringify(next));
      this.attempt = next;
    } finally {
      this.busy = false;
    }
  }
  async finish() {
    if (
      this.busy ||
      !this.clearCart ||
      this.attempt?.tracking?.snapshot.status !== "ENTREGUE"
    )
      throw new Error("O atendimento ainda não pode ser encerrado.");
    this.busy = true;
    try {
      const closing = { ...this.attempt, closing: true as const };
      await this.storage.set(JSON.stringify(closing));
      this.attempt = closing;
      await this.clearCart();
      await this.storage.set("");
      this.attempt = null;
    } finally {
      this.busy = false;
    }
  }
  prepare(request: OrderRequest): Promise<void> {
    if (this.attempt || this.busy)
      throw new Error("Existe um pedido em andamento.");
    const key = this.uuid();
    const attempt: OrderAttempt = {
      negocioId: this.negocioId,
      ...(this.dispositivoId && { dispositivoId: this.dispositivoId }),
      key,
      request: JSON.parse(JSON.stringify(request)),
    };
    if (!attempt.request.nomeCliente)
      attempt.request.codigoCliente = `T-${key.slice(0, 8).toUpperCase()}`;
    this.busy = true;
    this.attempt = attempt;
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
      await this.storage.set(JSON.stringify(this.attempt));
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
