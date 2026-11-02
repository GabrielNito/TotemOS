import {
  OrderTracking,
  parseTracking,
  type TrackingSnapshot,
} from "./order-tracking";
import { TrackingError } from "./order-tracking-api";

export const snapshot: TrackingSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "AGUARDANDO_PAGAMENTO",
  senha: null,
  dataOperacional: null,
  versao: 1,
  demo: true,
  demoAmbiente: "ensaio",
  valorTotal: "48.00",
  autorizacaoOperacional: null,
};
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("valida identidade, campos nullable e projeção sem dados pessoais", () => {
  expect(
    parseTracking({ ...snapshot, nomeCliente: "privado" }, snapshot.id),
  ).toEqual(snapshot);
  for (const change of [
    { id: "outro" },
    { status: "PAGO" },
    { senha: 0 },
    { versao: -1 },
    { dataOperacional: "2026-02-30" },
    { valorTotal: "" },
    { autorizacaoOperacional: { tipo: "DEMO", financeira: true } },
  ]) {
    expect(() =>
      parseTracking({ ...snapshot, ...change }, snapshot.id),
    ).toThrow();
  }
});

test("preserva estados reais, inclusive Preparo Zero, e impede regressão de versão", async () => {
  const get = jest.fn().mockResolvedValue(snapshot);
  const save = jest.fn(async () => {});
  const tracking = new OrderTracking(get, save);
  tracking.setActive(true);
  await tick();
  for (const [status, versao] of [
    ["PENDENTE", 2],
    ["EM_PREPARO", 3],
    ["PRONTO", 4],
  ] as const) {
    get.mockResolvedValue({
      ...snapshot,
      status,
      versao,
      senha: 12,
      dataOperacional: "2026-11-02",
    });
    tracking.refresh();
    await tick();
    expect(tracking.state.snapshot).toMatchObject({
      status,
      versao,
      senha: 12,
    });
  }
  get.mockResolvedValue({ ...snapshot, status: "PENDENTE", versao: 2 });
  tracking.refresh();
  await tick();
  expect(tracking.state.snapshot?.status).toBe("PRONTO");
  get.mockResolvedValue({ ...snapshot, status: "ENTREGUE", versao: 5 });
  tracking.refresh();
  await tick();
  jest.advanceTimersByTime(60000);
  await tick();
  tracking.refresh();
  expect(tracking.state.snapshot?.status).toBe("ENTREGUE");
  expect(get).toHaveBeenCalledTimes(6);
  tracking.dispose();
  const zero = new OrderTracking(
    async () => ({ ...snapshot, status: "PRONTO", versao: 3 }),
    save,
  );
  zero.setActive(true);
  await tick();
  expect(zero.state.snapshot?.status).toBe("PRONTO");
  zero.dispose();
});

test("pausa/retoma, aborta geração antiga e nunca sobrepõe requisições", async () => {
  let resolve!: (value: TrackingSnapshot) => void;
  const get = jest.fn(
    (_signal: AbortSignal) =>
      new Promise<TrackingSnapshot>((r) => {
        resolve = r;
      }),
  );
  const tracking = new OrderTracking(get, async () => {});
  tracking.setActive(true);
  tracking.refresh();
  expect(get).toHaveBeenCalledTimes(1);
  tracking.setActive(false);
  expect(get.mock.calls[0][0].aborted).toBe(true);
  tracking.setActive(true);
  expect(get).toHaveBeenCalledTimes(1);
  resolve(snapshot);
  await tick();
  expect(tracking.state.snapshot).toBeUndefined();
  expect(get).toHaveBeenCalledTimes(2);
  resolve({ ...snapshot, status: "PRONTO", versao: 4 });
  await tick();
  expect(tracking.state.snapshot?.status).toBe("PRONTO");
  tracking.dispose();
});

test("rede/503 preservam último resultado, backoff e recuperação; 429 impede retry manual antecipado", async () => {
  const get = jest.fn().mockResolvedValue(snapshot);
  const tracking = new OrderTracking(get, async () => {});
  tracking.setActive(true);
  await tick();
  get.mockRejectedValueOnce(new TrackingError("network"));
  tracking.refresh();
  await tick();
  expect(tracking.state).toMatchObject({ snapshot, stale: true });
  jest.advanceTimersByTime(9999);
  await tick();
  expect(get).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(1);
  await tick();
  expect(tracking.state.stale).toBe(false);
  get.mockRejectedValueOnce(new TrackingError("http", 429, 30000));
  tracking.refresh();
  await tick();
  tracking.refresh();
  jest.advanceTimersByTime(29999);
  await tick();
  expect(get).toHaveBeenCalledTimes(4);
  jest.advanceTimersByTime(1);
  await tick();
  expect(get).toHaveBeenCalledTimes(5);
  get.mockRejectedValueOnce(new TrackingError("http", 503));
  tracking.refresh();
  await tick();
  expect(tracking.state.snapshot).toEqual(snapshot);
  jest.advanceTimersByTime(10000);
  await tick();
  expect(tracking.state.stale).toBe(false);
  tracking.dispose();
});

test.each([401, 403, 404, 400])(
  "HTTP %s bloqueia polling automático e mantém referência",
  async (status) => {
    const get = jest
      .fn()
      .mockResolvedValueOnce(snapshot)
      .mockRejectedValue(new TrackingError("http", status));
    const tracking = new OrderTracking(get, async () => {});
    tracking.setActive(true);
    await tick();
    tracking.refresh();
    await tick();
    jest.advanceTimersByTime(120000);
    await tick();
    expect(get).toHaveBeenCalledTimes(2);
    expect(tracking.state.snapshot).toEqual(snapshot);
    expect(tracking.state.error?.status).toBe(status);
    tracking.dispose();
  },
);
