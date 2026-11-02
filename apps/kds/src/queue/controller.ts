import { PairingApiError } from "../device-pairing/api";
import { safeQueueError } from "./api";
import {
  nextTarget,
  type OperationStorage,
  type Order,
  type PendingOperation,
  type QueueApi,
  type Summary,
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
  rejected: Record<string, string>;
  recoveryPaused: boolean;
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
    rejected: {},
    recoveryPaused: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private blocked = new Map<string, number>();
  private confirmed = new Map<string, Summary>();
  private retryBaseline = new Map<string, number>();
  private recovering = new Set<string>();
  private resumeRequested = false;
  private reconciliationIncomplete = false;
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
    if (this.running) this.resumeRequested = true;
    await this.refresh();
  };
  stop = () => {
    this.generation++;
    this.active = false;
    clearTimeout(this.timer);
    this.abort?.abort();
    this.update({ stale: true });
  };
  recover = async () => {
    if (this.running || !this.active) return;
    this.running = true;
    this.update({ busy: true });
    try {
      if (this.state.pending.some((op) => op.halted))
        await this.persist(
          this.state.pending.map((op) => ({ ...op, halted: false })),
        );
      for (const op of this.state.pending)
        this.retryBaseline.set(op.key, op.attempts);
      this.update({ recoveryPaused: false });
    } catch {
      this.update({
        stale: true,
        message:
          "Não foi possível gravar a recuperação. O diário foi preservado.",
      });
      return;
    } finally {
      this.running = false;
      this.update({ busy: false });
    }
    await this.refresh();
  };
  private expire() {
    this.active = false;
    this.generation++;
    clearTimeout(this.timer);
    this.update({
      orders: [],
      pending: [],
      newIds: [],
      rejected: {},
      stale: true,
      loaded: false,
    });
    this.expired();
  }
  private paused(op: PendingOperation) {
    return (
      !!op.halted || op.attempts - (this.retryBaseline.get(op.key) ?? 0) >= 5
    );
  }
  private delay(attempts: number, error: unknown) {
    return Math.max(
      Math.min(
        60000,
        2000 * 2 ** Math.min(attempts, 5) * (0.8 + Math.random() * 0.4),
      ),
      error instanceof PairingApiError ? (error.retryAfterMs ?? 0) : 0,
    );
  }
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
    this.update({
      pending: ops,
      recoveryPaused: ops.some((op) => this.paused(op)),
    });
  }
  private async send(op: PendingOperation) {
    const generation = this.generation;
    try {
      const result = await this.api.execute(op, this.abort?.signal);
      const previous = this.confirmed.get(result.id);
      if (!previous || result.versao >= previous.versao)
        this.confirmed.set(result.id, result);
      // Persist acknowledgement even if focus was lost during the request.
      await this.persist(this.state.pending.filter((p) => p.key !== op.key));
      this.recovering.delete(op.key);
      const rejected = { ...this.state.rejected };
      delete rejected[op.orderId];
      this.update({ rejected });
      if (this.active && generation === this.generation)
        this.update({
          orders: this.state.orders.flatMap((order) =>
            order.id !== result.id
              ? [order]
              : order.versao > result.versao
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
        this.expire();
        throw error;
      }
      const definitive =
        error instanceof PairingApiError &&
        [400, 403, 404, 409, 422].includes(error.statusCode);
      if (definitive) {
        this.notice = safeQueueError(error);
        this.blocked.set(
          op.orderId,
          op.version ??
            this.state.orders.find((o) => o.id === op.orderId)?.versao ??
            0,
        );
        this.update({
          rejected: { ...this.state.rejected, [op.orderId]: this.notice },
        });
        if (this.recovering.has(op.key)) {
          // A policy denial of a replay cannot establish whether an earlier
          // request committed. Preserve identity, stop automatic transmission.
          await this.persist(
            this.state.pending.map((p) =>
              p.key === op.key ? { ...p, halted: true } : p,
            ),
          );
        } else
          await this.persist(
            this.state.pending.filter((p) => p.key !== op.key),
          );
      } else {
        this.recovering.add(op.key);
        const attempts = op.attempts + 1;
        const delay = this.delay(attempts, error);
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
    orders = orders.flatMap((order) => {
      const fact = this.confirmed.get(order.id);
      if (fact && !["PENDENTE", "EM_PREPARO", "PRONTO"].includes(fact.status)) {
        this.reconciliationIncomplete = true;
        return [];
      }
      const previous = confirmed.get(order.id);
      if (
        (fact && fact.versao > order.versao) ||
        (previous && previous.versao > order.versao)
      )
        this.reconciliationIncomplete = true;
      const merged =
        previous && previous.versao > order.versao ? previous : order;
      return [
        fact && fact.versao > merged.versao
          ? { ...merged, ...fact, status: fact.status as Order["status"] }
          : merged,
      ];
    });
    const rejected = { ...this.state.rejected };
    for (const order of orders) {
      const version = this.blocked.get(order.id);
      if (version !== undefined && order.versao > version) {
        this.blocked.delete(order.id);
        delete rejected[order.id];
      }
    }
    const newIds = this.initialized
      ? orders.filter((o) => !this.seen.has(o.id)).map((o) => o.id)
      : [];
    orders.forEach((o) => {
      this.seen.add(o.id);
      this.confirmed.set(o.id, o);
    });
    this.initialized = true;
    this.update({
      orders,
      newIds: [...new Set([...this.state.newIds, ...newIds])],
      loaded: true,
      stale: this.state.pending.length > 0 || this.reconciliationIncomplete,
      recoveryPaused: this.state.pending.some((op) => this.paused(op)),
      rejected,
      lastSync: this.reconciliationIncomplete
        ? this.state.lastSync
        : Date.now(),
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
        pending.forEach((op) => this.recovering.add(op.key));
        this.loadedJournal = true;
      }
      // Recover original operations even when the order is no longer in the open queue.
      for (const op of this.state.pending) {
        if (!current()) return;
        if (!this.paused(op) && op.nextAttempt <= Date.now()) {
          await this.send(op);
          if (this.retryAt > Date.now()) return;
        }
      }
      if (!current()) return;
      const orders = await this.readOrders(current);
      if (!current()) return;
      this.acceptOrders(orders);
      this.failures = 0;
      this.retryAt = 0;
      let attemptedNumbering = false;
      // One mutation at a time, bounded to one pass through this snapshot.
      for (const order of this.state.orders) {
        if (!current()) return;
        if (this.state.stale) break;
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
            version: order.versao,
          };
          await this.persist([...this.state.pending, op]);
          if (current()) {
            attemptedNumbering = true;
            await this.send(op);
          }
          if (this.state.stale) break;
        }
      }
      if (attemptedNumbering && current() && this.state.pending.length === 0) {
        const reconciled = await this.readOrders(current);
        if (current()) this.acceptOrders(reconciled);
      }
    } catch (error) {
      if (current()) {
        this.failures++;
        this.retryAt = Date.now() + this.delay(this.failures, error);
        this.update({ stale: true, message: safeQueueError(error) });
        if (error instanceof PairingApiError && error.statusCode === 401) {
          this.expire();
        }
      }
    } finally {
      this.running = false;
      this.update({ busy: false });
      if (this.resumeRequested && this.active) {
        this.resumeRequested = false;
        void this.refresh();
      } else this.schedule();
    }
  };
  // Cursor pages are not a transaction. Confirm missing cards in a second
  // complete observation; absence never implies a particular final status.
  private async readOrders(current: () => boolean): Promise<Order[]> {
    this.reconciliationIncomplete = false;
    const first = await this.api.list(this.abort?.signal);
    if (!current()) return [];
    if (!this.state.orders.some((o) => !first.some((n) => n.id === o.id)))
      return first;
    const second = await this.api.list(this.abort?.signal);
    if (!current()) return [];
    const merged = new Map(first.map((o) => [o.id, o]));
    this.reconciliationIncomplete =
      first.length !== second.length ||
      first.some(
        (o) => !second.some((n) => n.id === o.id && n.versao === o.versao),
      );
    for (const order of second) {
      if ((merged.get(order.id)?.versao ?? 0) <= order.versao)
        merged.set(order.id, order);
    }
    return [...merged.values()].sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  }
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
    const generation = this.generation;
    this.abort = new AbortController();
    this.notice = "";
    this.update({ busy: true, message: "" });
    try {
      const op: PendingOperation = {
        key: this.uuid(),
        orderId: order.id,
        kind: order.senha === null ? "senha" : "status",
        ...(order.senha === null
          ? { version: order.versao }
          : { target: nextTarget(order.status), version: order.versao }),
        attempts: 0,
        nextAttempt: 0,
      };
      await this.persist([...this.state.pending, op]);
      if (this.active && generation === this.generation) await this.send(op);
    } catch (error) {
      if (error instanceof PairingApiError && error.statusCode === 401) return;
      this.update({
        stale: true,
        message:
          "Não foi possível gravar a operação. Atualize para recuperar com segurança.",
      });
    } finally {
      this.running = false;
      this.update({ busy: false });
      this.resumeRequested = false;
      if (this.active) await this.refresh();
    }
  };
}
