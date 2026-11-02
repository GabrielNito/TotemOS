import { TrackingError } from "./order-tracking-api";

export const orderStatuses = [
  "AGUARDANDO_PAGAMENTO",
  "PENDENTE",
  "EM_PREPARO",
  "PRONTO",
  "ENTREGUE",
  "CANCELADO_AGUARDANDO_ESTORNO",
  "CANCELADO",
] as const;
export type OrderStatusValue = (typeof orderStatuses)[number];
export type TrackingSnapshot = {
  id: string;
  status: OrderStatusValue;
  senha: number | null;
  dataOperacional: string | null;
  versao: number;
  demo: boolean;
  demoAmbiente: string | null;
  valorTotal: string;
  autorizacaoOperacional: { tipo: "DEMO"; financeira: false } | null;
};
export const orderCopy: Record<
  OrderStatusValue,
  { title: string; description: string }
> = {
  AGUARDANDO_PAGAMENTO: {
    title: "Pedido registrado",
    description:
      "Aguardando autorização para preparo. A liberação ainda não foi confirmada; seu pedido ainda não entrou na cozinha.",
  },
  PENDENTE: {
    title: "Aguardando preparo",
    description:
      "Pedido autorizado para a cozinha. Aguardando início do preparo.",
  },
  EM_PREPARO: {
    title: "Pedido em preparação",
    description: "A cozinha está preparando seu pedido.",
  },
  PRONTO: {
    title: "Pronto para retirada",
    description: "Retire seu pedido no balcão. Confira a senha com a equipe.",
  },
  ENTREGUE: {
    title: "Pedido entregue",
    description:
      "Entrega confirmada pelo estabelecimento. Você pode iniciar um novo atendimento.",
  },
  CANCELADO_AGUARDANDO_ESTORNO: {
    title: "Cancelamento aguardando estorno",
    description:
      "O estorno ainda não foi confirmado. Solicite assistência ao estabelecimento para este atendimento.",
  },
  CANCELADO: {
    title: "Pedido cancelado",
    description:
      "Cancelamento confirmado. Este estado não confirma devolução financeira. Solicite assistência ao estabelecimento para encerrar este atendimento.",
  },
};
export function isOrderStatus(value: unknown): value is OrderStatusValue {
  return (
    typeof value === "string" &&
    (orderStatuses as readonly string[]).includes(value)
  );
}
export function validOrderId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}
export function parseTracking(
  value: unknown,
  expectedId: string,
): TrackingSnapshot {
  const p = value as TrackingSnapshot | null;
  const date = p?.dataOperacional;
  if (
    !p ||
    !validOrderId(p.id) ||
    p.id !== expectedId ||
    !isOrderStatus(p.status) ||
    !(p.senha === null || (Number.isSafeInteger(p.senha) && p.senha > 0)) ||
    !(
      date === null ||
      (typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date)
    ) ||
    !Number.isSafeInteger(p.versao) ||
    p.versao < 1 ||
    typeof p.demo !== "boolean" ||
    !(
      p.demoAmbiente === null ||
      (typeof p.demoAmbiente === "string" && !!p.demoAmbiente.trim())
    ) ||
    typeof p.valorTotal !== "string" ||
    !/^\d+\.\d{2}$/.test(p.valorTotal) ||
    !Number.isFinite(Number(p.valorTotal)) ||
    !(
      p.autorizacaoOperacional === null ||
      (p.autorizacaoOperacional?.tipo === "DEMO" &&
        p.autorizacaoOperacional.financeira === false)
    )
  ) {
    throw new TrackingError("invalid");
  }
  return {
    id: p.id,
    status: p.status,
    senha: p.senha,
    dataOperacional: p.dataOperacional,
    versao: p.versao,
    demo: p.demo,
    demoAmbiente: p.demoAmbiente,
    valorTotal: p.valorTotal,
    autorizacaoOperacional: p.autorizacaoOperacional
      ? { tipo: "DEMO", financeira: false }
      : null,
  };
}
export type TrackingState = {
  snapshot?: TrackingSnapshot;
  syncedAt?: number;
  busy: boolean;
  stale: boolean;
  error?: TrackingError;
};

/** One request at a time, including while an aborted transport settles. */
export class OrderTracking {
  state: TrackingState;
  private onChange = (_state: TrackingState) => {};
  private active = false;
  private disposed = false;
  private generation = 0;
  private running = false;
  private failures = 0;
  private retryAt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private persisted?: { snapshot: TrackingSnapshot; syncedAt: number };
  constructor(
    private get: (signal: AbortSignal) => Promise<TrackingSnapshot>,
    private save: (
      snapshot: TrackingSnapshot,
      syncedAt: number,
    ) => Promise<void>,
    initial?: { snapshot: TrackingSnapshot; syncedAt: number },
  ) {
    this.state = { ...initial, busy: false, stale: !!initial };
  }
  private emit(patch: Partial<TrackingState>) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
  subscribe(listener: (state: TrackingState) => void) {
    this.disposed = false;
    this.onChange = listener;
  }
  setActive(active: boolean) {
    if (this.disposed || this.active === active) return;
    this.active = active;
    this.generation++;
    clearTimeout(this.timer);
    if (!active) {
      this.controller?.abort();
      this.emit({ busy: false, stale: !!this.state.snapshot });
    } else this.refresh();
  }
  refresh = () => {
    if (this.disposed || !this.active || this.running) return;
    // A valid GET can finish persisting after its foreground generation pauses.
    // Reconcile that durable confirmation before accepting another response.
    if (
      this.persisted &&
      (!this.state.snapshot ||
        this.persisted.snapshot.versao > this.state.snapshot.versao)
    ) {
      this.emit({
        ...this.persisted,
        stale: this.persisted.snapshot.status !== "ENTREGUE",
        error: undefined,
        busy: false,
      });
    }
    if (this.state.snapshot?.status === "ENTREGUE") return;
    clearTimeout(this.timer);
    const delay = this.retryAt - Date.now();
    if (delay > 0) {
      this.timer = setTimeout(this.refresh, delay);
      return;
    }
    void this.poll();
  };
  private async poll() {
    this.running = true;
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const current = () =>
      !this.disposed && this.active && generation === this.generation;
    this.emit({ busy: true });
    let delay = 5000;
    let blocked = false;
    try {
      const next = await this.get(controller.signal);
      if (!current()) return;
      if (!this.state.snapshot || next.versao > this.state.snapshot.versao) {
        const syncedAt = Date.now();
        await this.save(next, syncedAt);
        this.persisted = { snapshot: next, syncedAt };
        if (!current()) return;
        this.emit({ snapshot: next, syncedAt, stale: false, error: undefined });
      } else if (
        next.versao === this.state.snapshot.versao &&
        JSON.stringify(next) === JSON.stringify(this.state.snapshot)
      ) {
        this.emit({ syncedAt: Date.now(), stale: false, error: undefined });
      } else {
        throw new TrackingError("invalid");
      }
      this.failures = 0;
    } catch (error) {
      if (!current()) return;
      const safe =
        error instanceof TrackingError ? error : new TrackingError("storage");
      this.emit({ error: safe, stale: true });
      delay = Math.max(
        Math.min(60000, 5000 * 2 ** Math.min(++this.failures, 4)),
        safe.retryAfterMs ?? 0,
      );
      if (safe.status === 429 || safe.retryAfterMs)
        this.retryAt = Date.now() + delay;
      blocked = [400, 401, 403, 404].includes(safe.status ?? 0);
    } finally {
      this.running = false;
      if (current()) {
        this.emit({ busy: false });
        if (!blocked && this.state.snapshot?.status !== "ENTREGUE")
          this.timer = setTimeout(this.refresh, delay);
      } else if (this.active && !this.disposed) this.refresh();
    }
  }
  dispose() {
    this.disposed = true;
    this.active = false;
    this.generation++;
    clearTimeout(this.timer);
    this.controller?.abort();
  }
}
