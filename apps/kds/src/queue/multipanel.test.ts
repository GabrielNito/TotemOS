import { QueueController } from "./controller";
import { PairingApiError } from "../device-pairing/api";
import type { Order, PendingOperation, QueueApi, Summary } from "./types";

const makeOrder = (id: string, extra: Partial<Order> = {}): Order => ({
  id,
  status: "PENDENTE",
  senha: 1,
  dataOperacional: "2026-11-01",
  versao: 3,
  demo: true,
  demoAmbiente: "ensaio",
  createdAt: "2026-11-01T12:00:00Z",
  preparoZero: false,
  elegivelCozinha: true,
  autorizacaoOperacional: { tipo: "DEMO", financeira: false },
  itens: [],
  ...extra,
});
// Models the #30/#31 contracts, not PostgreSQL locks. Synchronous commit is the
// deterministic linearization point; clients have separate journals and actors.
function server(initial: Order[]) {
  const rows = new Map<string, Summary>(
    initial.map((o) => [o.id, structuredClone(o)]),
  );
  const replay = new Map<string, string>();
  let counter = Math.max(
    0,
    ...initial
      .filter((o) => o.dataOperacional === "2026-11-02")
      .map((o) => o.senha ?? 0),
  );
  let effects = 0;
  let sequence = 0;
  const panels: QueueController[] = [];
  function panel(actor: string, journal: PendingOperation[] = []) {
    let saved = structuredClone(journal);
    let offline = false;
    let lost = false;
    const api: QueueApi = {
      list: jest.fn(async () => {
        if (offline) throw new Error("DNS unavailable");
        return [...rows.values()]
          .filter((o) =>
            ["PENDENTE", "EM_PREPARO", "PRONTO"].includes(o.status),
          )
          .map((o) => structuredClone(o) as Order);
      }),
      execute: jest.fn(async (op) => {
        if (offline) throw new Error("connection interrupted");
        const row = rows.get(op.orderId)!;
        const key = `${actor}:${op.kind}:${op.key}`;
        const payload = JSON.stringify([op.orderId, op.target, op.version]);
        if (replay.has(key)) {
          if (replay.get(key) !== payload)
            throw new PairingApiError(409, undefined, "payload");
          return structuredClone(row);
        }
        if (op.kind === "senha") {
          if (row.senha === null) {
            row.senha = ++counter;
            row.dataOperacional = "2026-11-02";
            row.versao++;
            effects++;
          }
        } else {
          const next = {
            PENDENTE: "EM_PREPARO",
            EM_PREPARO: "PRONTO",
            PRONTO: "ENTREGUE",
          }[row.status];
          if (
            row.versao !== op.version ||
            row.senha === null ||
            op.target !== next
          )
            throw new PairingApiError(409, undefined, "version");
          row.status = op.target!;
          row.versao++;
          effects++;
        }
        replay.set(key, payload);
        if (lost) {
          lost = false;
          throw new Error("HTTP response lost after commit");
        }
        return structuredClone(row);
      }),
    };
    const storage = {
      load: async () => structuredClone(saved),
      save: async (ops: PendingOperation[]) => {
        saved = structuredClone(ops);
      },
    };
    const controller = new QueueController(
      api,
      storage,
      () => `${actor}-${++sequence}`,
      jest.fn(),
    );
    panels.push(controller);
    return {
      controller,
      api,
      storage,
      offline: (v: boolean) => {
        offline = v;
      },
      loseResponse: () => {
        lost = true;
      },
      journal: () => saved,
    };
  }
  return {
    panel,
    rows,
    effects: () => effects,
    stop: () => panels.forEach((p) => p.stop()),
  };
}
afterEach(() => jest.useRealTimers());
it("two independent panels conflict, refetch, explicitly continue and converge through delivery", async () => {
  const s = server([makeOrder("one")]);
  const a = s.panel("A"),
    b = s.panel("B");
  try {
    await Promise.all([a.controller.start(), b.controller.start()]);
    const oldB = b.controller.state.orders[0];
    await a.controller.act(a.controller.state.orders[0]);
    await b.controller.act(oldB);
    expect(s.effects()).toBe(1);
    expect(b.controller.state.orders[0]).toMatchObject({
      status: "EM_PREPARO",
      versao: 4,
    });
    expect(b.controller.state.message).toContain("Outro painel");
    expect(b.api.execute).toHaveBeenCalledTimes(1);
    await Promise.all([a.controller.refresh(), b.controller.refresh()]);
    expect(a.controller.state.orders).toEqual(b.controller.state.orders);
    await b.controller.act(b.controller.state.orders[0]);
    await a.controller.refresh();
    await a.controller.act(a.controller.state.orders[0]);
    await b.controller.refresh();
    expect(s.effects()).toBe(3);
    expect(a.controller.state.orders).toEqual([]);
    expect(b.controller.state.orders).toEqual([]);
  } finally {
    s.stop();
  }
});
it.each([false, true])(
  "simultaneous null senha requests converge, preparoZero=%s",
  async (zero) => {
    const s = server([
      makeOrder("one", {
        senha: null,
        dataOperacional: null,
        status: zero ? "PRONTO" : "PENDENTE",
        preparoZero: zero,
      }),
    ]);
    const a = s.panel("A"),
      b = s.panel("B");
    try {
      await Promise.all([a.controller.start(), b.controller.start()]);
      expect(s.effects()).toBe(1);
      expect(a.controller.state.orders).toEqual(b.controller.state.orders);
      expect(a.controller.state.orders[0]).toMatchObject({
        senha: 1,
        dataOperacional: "2026-11-02",
      });
      if (zero) {
        await a.controller.act(a.controller.state.orders[0]);
        await b.controller.refresh();
        expect(b.controller.state.orders).toEqual([]);
      }
    } finally {
      s.stop();
    }
  },
);
it("different orders and operational dates stay independent", async () => {
  const s = server([
    makeOrder("one"),
    makeOrder("two", { dataOperacional: "2026-11-02" }),
  ]);
  const a = s.panel("A"),
    b = s.panel("B");
  try {
    await Promise.all([a.controller.start(), b.controller.start()]);
    await Promise.all([
      a.controller.act(a.controller.state.orders[0]),
      b.controller.act(b.controller.state.orders[1]),
    ]);
    await Promise.all([a.controller.refresh(), b.controller.refresh()]);
    expect(s.effects()).toBe(2);
    expect(a.controller.state.orders).toEqual(b.controller.state.orders);
    expect(a.controller.state.orders.map((o) => o.dataOperacional)).toEqual([
      "2026-11-01",
      "2026-11-02",
    ]);
  } finally {
    s.stop();
  }
});
it("lost commit response survives restart and another panel delivering while disconnected", async () => {
  jest.useFakeTimers();
  const s = server([makeOrder("one")]);
  const a = s.panel("A"),
    b = s.panel("B");
  try {
    await Promise.all([a.controller.start(), b.controller.start()]);
    a.loseResponse();
    await a.controller.act(a.controller.state.orders[0]);
    const original = a.journal()[0];
    expect(original).toMatchObject({
      target: "EM_PREPARO",
      version: 3,
      attempts: 1,
    });
    a.offline(true);
    a.controller.stop();
    await b.controller.refresh();
    await b.controller.act(b.controller.state.orders[0]);
    await b.controller.act(b.controller.state.orders[0]);
    b.controller.stop();
    await jest.advanceTimersByTimeAsync(120000);
    const restarted = s.panel("A", a.journal());
    await restarted.controller.start();
    expect(restarted.api.execute).toHaveBeenCalledWith(
      original,
      expect.anything(),
    );
    expect(restarted.journal()).toEqual([]);
    expect(restarted.controller.state.orders).toEqual([]);
    expect(s.effects()).toBe(3);
  } finally {
    s.stop();
  }
});
