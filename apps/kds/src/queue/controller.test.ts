import { QueueController } from "./controller";
import { PairingApiError } from "../device-pairing/api";
import type { Order, PendingOperation } from "./types";

export const order = (
  id = "11111111-1111-4111-8111-111111111111",
  extra: Partial<Order> = {},
): Order => ({
  id,
  status: "PENDENTE",
  senha: 12,
  dataOperacional: "2026-11-01",
  versao: 3,
  demo: true,
  demoAmbiente: "ensaio",
  createdAt: "2026-11-01T12:00:00.000Z",
  preparoZero: false,
  elegivelCozinha: true,
  autorizacaoOperacional: { tipo: "DEMO", financeira: false },
  itens: [],
  ...extra,
});
function setup(initial: PendingOperation[] = []) {
  let saved = initial;
  const api = {
    list: jest.fn(async () => [order()]),
    execute: jest.fn(async (op: PendingOperation) => ({
      ...order(op.orderId),
      status: op.target ?? "PENDENTE",
      versao: 4,
    })),
  };
  const storage = {
    load: jest.fn(async () => saved),
    save: jest.fn(async (ops: PendingOperation[]) => {
      saved = structuredClone(ops);
    }),
  };
  const expired = jest.fn();
  const controller = new QueueController(
    api,
    storage,
    () => "22222222-2222-4222-8222-222222222222",
    expired,
    5000,
  );
  return { controller, api, storage, expired };
}
afterEach(() => jest.useRealTimers());
it("loads empty queue without initial alerts", async () => {
  const { controller, api } = setup();
  api.list.mockResolvedValue([]);
  await controller.start();
  expect(controller.state.orders).toEqual([]);
  expect(controller.state.newIds).toEqual([]);
  controller.stop();
});
it("alerts new IDs once, never initial queue", async () => {
  const { controller, api } = setup();
  await controller.start();
  expect(controller.state.newIds).toEqual([]);
  api.list.mockResolvedValue([
    order(),
    order("33333333-3333-4333-8333-333333333333"),
  ]);
  await controller.refresh();
  expect(controller.state.newIds).toHaveLength(1);
  controller.acknowledge();
  await controller.refresh();
  expect(controller.state.newIds).toEqual([]);
  controller.stop();
});
it.each(["EM_PREPARO", "PRONTO", "ENTREGUE"] as const)(
  "confirms %s then reconciles",
  async (target) => {
    const { controller, api, storage } = setup();
    api.list.mockResolvedValue([
      order(undefined, {
        status:
          target === "PRONTO"
            ? "EM_PREPARO"
            : target === "ENTREGUE"
              ? "PRONTO"
              : "PENDENTE",
      }),
    ]);
    await controller.start();
    await controller.act(controller.state.orders[0]);
    expect(storage.save).toHaveBeenCalled();
    expect(api.execute.mock.calls[0][0]).toMatchObject({ target, version: 3 });
    controller.stop();
  },
);
it("assigns null senha including preparo zero PRONTO", async () => {
  const { controller, api } = setup();
  api.list.mockResolvedValue([
    order(undefined, { senha: null, status: "PRONTO", preparoZero: true }),
  ]);
  await controller.start();
  expect(api.execute.mock.calls[0][0]).toMatchObject({ kind: "senha" });
  controller.stop();
});
it("persists before request and suppresses double tap", async () => {
  const { controller, api, storage } = setup();
  await controller.start();
  let release!: () => void;
  api.execute.mockImplementation(async () => {
    expect(storage.save).toHaveBeenCalled();
    await new Promise<void>((r) => {
      release = r;
    });
    return order();
  });
  const first = controller.act(controller.state.orders[0]);
  await Promise.resolve();
  await controller.act(controller.state.orders[0]);
  await Promise.resolve();
  release();
  await first;
  expect(api.execute).toHaveBeenCalledTimes(1);
  controller.stop();
});
it("recovers lost response after restart with identical key and payload", async () => {
  const first = setup();
  await first.controller.start();
  first.api.execute.mockRejectedValue(new Error("network"));
  await first.controller.act(order());
  const pending = first.controller.state.pending;
  first.controller.stop();
  expect(pending).toHaveLength(1);
  const second = setup(pending.map((op) => ({ ...op, nextAttempt: 0 })));
  await second.controller.start();
  expect(second.api.execute.mock.calls[0][0]).toEqual({
    ...pending[0],
    nextAttempt: 0,
  });
  second.controller.stop();
});
it.each([403, 404, 409])(
  "resolves definitive %s with refetch without changing version",
  async (code) => {
    const { controller, api } = setup();
    await controller.start();
    api.execute.mockRejectedValue(
      new PairingApiError(code, undefined, "unsafe"),
    );
    await controller.act(order());
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(controller.state.pending).toEqual([]);
    expect(controller.state.message).not.toContain("unsafe");
    controller.stop();
  },
);
it.each([429, 503])("preserves uncertain %s and backs off", async (code) => {
  const { controller, api } = setup();
  await controller.start();
  api.execute.mockRejectedValue(
    new PairingApiError(code, undefined, "unsafe", 60000),
  );
  await controller.act(order());
  expect(controller.state.pending[0].nextAttempt).toBeGreaterThan(
    Date.now() + 50000,
  );
  await controller.refresh();
  expect(api.execute).toHaveBeenCalledTimes(1);
  controller.stop();
});
it("401 expires session", async () => {
  const { controller, api, expired } = setup();
  api.list.mockRejectedValue(new PairingApiError(401, undefined, "expired"));
  await controller.start();
  expect(expired).toHaveBeenCalledTimes(1);
  controller.stop();
});
it("delivered order disappears on reconciliation", async () => {
  const { controller, api } = setup();
  api.list.mockResolvedValue([order(undefined, { status: "PRONTO" })]);
  await controller.start();
  api.list.mockResolvedValue([]);
  await controller.act(controller.state.orders[0]);
  expect(controller.state.orders).toEqual([]);
  controller.stop();
});
it("does not overlap cycles or apply responses after stop", async () => {
  const { controller, api } = setup();
  let release!: (orders: Order[]) => void;
  api.list.mockImplementation(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  const run = controller.start();
  await controller.refresh();
  expect(api.list).toHaveBeenCalledTimes(1);
  controller.stop();
  release([order()]);
  await run;
  expect(controller.state.orders).toEqual([]);
});
it("keeps stale orders and disables actions on network failure", async () => {
  const { controller, api } = setup();
  await controller.start();
  api.list.mockRejectedValue(new Error("offline"));
  await controller.refresh();
  await controller.act(order());
  expect(controller.state.orders).toHaveLength(1);
  expect(controller.state.stale).toBe(true);
  expect(api.execute).not.toHaveBeenCalled();
  controller.stop();
});
it("ignores old cycle when returning from background before response", async () => {
  const { controller, api } = setup();
  let release!: (orders: Order[]) => void;
  api.list.mockImplementationOnce(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  const old = controller.start();
  await Promise.resolve();
  controller.stop();
  await controller.start();
  release([order()]);
  await old;
  expect(controller.state.orders).toEqual([]);
  controller.stop();
});
it("does not repeatedly auto-number after definitive conflict", async () => {
  const { controller, api } = setup();
  api.list.mockResolvedValue([order(undefined, { senha: null })]);
  api.execute.mockRejectedValue(
    new PairingApiError(409, undefined, "conflict"),
  );
  await controller.start();
  await controller.refresh();
  expect(api.execute).toHaveBeenCalledTimes(1);
  controller.stop();
});
it("polls only when active, and resumes from page one", async () => {
  jest.useFakeTimers();
  const { controller, api } = setup();
  await controller.start();
  await jest.advanceTimersByTimeAsync(5000);
  expect(api.list).toHaveBeenCalledTimes(2);
  controller.stop();
  await jest.advanceTimersByTimeAsync(20000);
  expect(api.list).toHaveBeenCalledTimes(2);
  await controller.start();
  expect(api.list).toHaveBeenCalledTimes(3);
  controller.stop();
});
it("never sends if durable persistence fails", async () => {
  const { controller, api, storage } = setup();
  await controller.start();
  storage.save.mockRejectedValue(new Error("disk"));
  await controller.act(order());
  expect(api.execute).not.toHaveBeenCalled();
  controller.stop();
});
it("replays original transition after another panel delivers the order", async () => {
  const pending: PendingOperation = {
    key: "22222222-2222-4222-8222-222222222222",
    orderId: order().id,
    kind: "status",
    target: "EM_PREPARO",
    version: 3,
    attempts: 1,
    nextAttempt: 0,
  };
  const { controller, api } = setup([pending]);
  api.execute.mockResolvedValue(
    order(undefined, { status: "ENTREGUE" as Order["status"], versao: 6 }),
  );
  api.list.mockResolvedValue([]);
  await controller.start();
  expect(api.execute).toHaveBeenCalledWith(pending, expect.anything());
  expect(controller.state.pending).toEqual([]);
  expect(controller.state.orders).toEqual([]);
  controller.stop();
});
it("401 during mutation terminates recovery", async () => {
  const { controller, api, expired } = setup();
  await controller.start();
  api.execute.mockRejectedValue(new PairingApiError(401, undefined, "revoked"));
  await controller.act(order());
  expect(expired).toHaveBeenCalledTimes(1);
  await controller.refresh();
  expect(api.execute).toHaveBeenCalledTimes(1);
  controller.stop();
});
it("two panels keep the losing version conflict for operator review", async () => {
  const first = setup();
  const second = setup();
  await first.controller.start();
  await second.controller.start();
  let version = 3;
  const execute = jest.fn(async (op: PendingOperation) => {
    if (op.version !== version)
      throw new PairingApiError(409, undefined, "conflict");
    version++;
    return order(undefined, { status: "EM_PREPARO", versao: version });
  });
  first.api.execute.mockImplementation(execute);
  second.api.execute.mockImplementation(execute);
  first.api.list.mockImplementation(async () => [
    order(undefined, { versao: version, status: "EM_PREPARO" }),
  ]);
  second.api.list.mockImplementation(async () => [
    order(undefined, { versao: version, status: "EM_PREPARO" }),
  ]);
  await first.controller.act(order());
  await second.controller.act(order());
  expect(execute).toHaveBeenCalledTimes(2);
  expect(second.controller.state.orders[0].versao).toBe(4);
  expect(second.controller.state.message).toContain("Outro painel");
  first.controller.stop();
  second.controller.stop();
});
it("clears connectivity error after successful recovery", async () => {
  const { controller, api } = setup();
  await controller.start();
  api.list.mockRejectedValueOnce(new Error("offline"));
  await controller.refresh();
  expect(controller.state.message).not.toBe("");
  controller.stop();
  jest.useFakeTimers();
  await jest.advanceTimersByTimeAsync(60000);
  api.list.mockResolvedValue([order()]);
  await controller.start();
  expect(controller.state.message).toBe("");
  controller.stop();
});
it("preserves confirmed numbering when a concurrent page contains an older version", async () => {
  const { controller, api } = setup();
  api.list.mockResolvedValue([order(undefined, { senha: null, versao: 3 })]);
  await controller.start();
  expect(controller.state.orders[0].senha).toBe(12);
  await controller.refresh();
  expect(api.execute).toHaveBeenCalledTimes(1);
  controller.stop();
});
