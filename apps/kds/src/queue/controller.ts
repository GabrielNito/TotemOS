import { PairingApiError } from "../device-pairing/api";
import { safeQueueError } from "./api";
import {
  nextTarget,
  type OperationStorage,
  type Order,
  type PendingOperation,
  type QueueApi,
} from "./types";
export interface QueueState {
  orders: Order[];
  pending: PendingOperation[];
  newIds: string[];
  busy: boolean;
  stale: boolean;
  loaded: boolean;
  lastSync: number | null;
  message: string;
}
export class QueueController {
  state: QueueState = {
    orders: [],
    pending: [],
    newIds: [],
    busy: false,
    stale: true,
    loaded: false,
    lastSync: null,
    message: "",
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private blocked = new Set<string>();
  private notice = "";
  private active = false;
  private running = false;
  private loadedJournal = false;
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  private seen = new Set<string>();
  private initialized = false;
  private retryAt = 0;
  private failures = 0;
  constructor(
    private api: QueueApi,
    private storage: OperationStorage,
    private uuid: () => string,
    private expired: () => void,
    private interval = 5000,
  ) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(patch: Partial<QueueState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  acknowledge = () => this.update({ newIds: [] });
  start = async () => {
    this.active = true;
    await this.refresh();
  };
  stop = () => {
    this.generation++;
    this.active = false;
    clearTimeout(this.timer);
    this.abort?.abort();
    this.update({ stale: true });
  };
  private schedule() {
    clearTimeout(this.timer);
    if (this.active)
      this.timer = setTimeout(
        () => {
          void this.refresh();
        },
        Math.max(this.interval, this.retryAt - Date.now()),
      );
  }
  private async persist(ops: PendingOperation[]) {
    await this.storage.save(ops);
    this.update({ pending: ops });
  }
  private async send(op: PendingOperation) {
    const generation = this.generation;
    try {
      const result = await this.api.execute(op, this.abort?.signal);
      // Persist acknowledgement even if focus was lost during the request.
      await this.persist(this.state.pending.filter((p) => p.key !== op.key));
      if (this.active && generation === this.generation)
        this.update({
          orders: this.state.orders.flatMap((order) =>
            order.id !== result.id
              ? [order]
              : ["PENDENTE", "EM_PREPARO", "PRONTO"].includes(result.status)
                ? [
                    {
                      ...order,
                      ...result,
                      status: result.status as Order["status"],
                    },
                  ]
                : [],
          ),
        });
      return true;
    } catch (error) {
      if (error instanceof PairingApiError && error.statusCode === 401) {
        this.active = false;
        this.expired();
        throw error;
      }
      const definitive =
        error instanceof PairingApiError &&
        [400, 403, 404, 409, 422].includes(error.statusCode);
      if (definitive) {
        this.notice = safeQueueError(error);
        this.blocked.add(op.orderId);
        await this.persist(this.state.pending.filter((p) => p.key !== op.key));
      } else {
        const attempts = op.attempts + 1;
        const delay = Math.max(
          Math.min(60000, 2000 * 2 ** Math.min(attempts, 5)),
          error instanceof PairingApiError ? (error.retryAfterMs ?? 0) : 0,
        );
        this.retryAt = Math.max(this.retryAt, Date.now() + delay);
        await this.persist(
          this.state.pending.map((p) =>
            p.key === op.key
              ? { ...p, attempts, nextAttempt: Date.now() + delay }
              : p,
          ),
        );
      }
      this.update({ message: safeQueueError(error), stale: true });
    }
  }
  private acceptOrders(orders: Order[]) {
    const confirmed = new Map(
      this.state.orders.map((order) => [order.id, order]),
    );
    orders = orders.map((order) => {
      const previous = confirmed.get(order.id);
      return previous && previous.versao > order.versao ? previous : order;
    });
    const newIds = this.initialized
      ? orders.filter((o) => !this.seen.has(o.id)).map((o) => o.id)
      : [];
    orders.forEach((o) => this.seen.add(o.id));
    this.initialized = true;
    this.update({
      orders,
      newIds: [...new Set([...this.state.newIds, ...newIds])],
      loaded: true,
      stale: false,
      lastSync: Date.now(),
      message: this.state.pending.length ? this.state.message : this.notice,
    });
  }
  refresh = async () => {
    if (!this.active || this.running) return;
    if (Date.now() < this.retryAt) {
      this.schedule();
      return;
    }
    this.running = true;
    const generation = this.generation;
    const current = () => this.active && generation === this.generation;
    this.abort = new AbortController();
    this.update({ busy: true });
    try {
      if (!this.loadedJournal) {
        const pending = await this.storage.load();
        if (!current()) return;
        this.update({ pending });
        this.loadedJournal = true;
      }
      // Recover original operations even when the order is no longer in the open queue.
      for (const op of this.state.pending) {
        if (!current()) return;
        if (op.nextAttempt <= Date.now()) {
          await this.send(op);
          if (this.retryAt > Date.now()) return;
        }
      }
      if (!current()) return;
      const orders = await this.api.list(this.abort.signal);
      if (!current()) return;
      this.acceptOrders(orders);
      this.failures = 0;
      this.retryAt = 0;
      let numbered = false;
      // One mutation at a time, bounded to one pass through this snapshot.
      for (const order of this.state.orders) {
        if (!current()) return;
        if (
          order.senha === null &&
          !this.blocked.has(order.id) &&
          !this.state.pending.some((p) => p.orderId === order.id)
        ) {
          const op: PendingOperation = {
            key: this.uuid(),
            orderId: order.id,
            kind: "senha",
            attempts: 0,
            nextAttempt: 0,
          };
          await this.persist([...this.state.pending, op]);
          if (current()) numbered = (await this.send(op)) || numbered;
          if (this.state.stale) break;
        }
      }
      if (numbered && current() && !this.state.stale) {
        const reconciled = await this.api.list(this.abort.signal);
        if (current()) this.acceptOrders(reconciled);
      }
    } catch (error) {
      if (current()) {
        this.failures++;
        this.retryAt =
          Date.now() +
          Math.max(
            Math.min(60000, 2000 * 2 ** Math.min(this.failures, 5)),
            error instanceof PairingApiError ? (error.retryAfterMs ?? 0) : 0,
          );
        this.update({ stale: true, message: safeQueueError(error) });
        if (error instanceof PairingApiError && error.statusCode === 401) {
          this.active = false;
          this.expired();
        }
      }
    } finally {
      this.running = false;
      this.update({ busy: false });
      this.schedule();
    }
  };
  act = async (order: Order) => {
    if (
      !this.active ||
      this.running ||
      this.state.stale ||
      this.state.pending.some((p) => p.orderId === order.id)
    )
      return;
    const current = this.state.orders.find((o) => o.id === order.id);
    if (!current || current.versao !== order.versao) return;
    this.running = true;
    this.abort = new AbortController();
    this.notice = "";
    this.update({ busy: true, message: "" });
    try {
      const op: PendingOperation = {
        key: this.uuid(),
        orderId: order.id,
        kind: order.senha === null ? "senha" : "status",
        ...(order.senha === null
          ? {}
          : { target: nextTarget(order.status), version: order.versao }),
        attempts: 0,
        nextAttempt: 0,
      };
      await this.persist([...this.state.pending, op]);
      if (this.active) await this.send(op);
    } catch {
      this.update({
        stale: true,
        message:
          "Não foi possível gravar a operação. Atualize para recuperar com segurança.",
      });
    } finally {
      this.running = false;
      this.update({ busy: false });
      if (this.active) await this.refresh();
    }
  };
}
