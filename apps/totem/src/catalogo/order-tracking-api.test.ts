import { getOrderTracking, TrackingError } from "./order-tracking-api";
import { restoreDeviceSession } from "../device-pairing/session";
jest.mock("../device-pairing/session", () => ({
  restoreDeviceSession: jest.fn(),
}));
const id = "11111111-1111-4111-8111-111111111111";
const body = {
  id,
  status: "PRONTO",
  senha: 12,
  dataOperacional: "2026-11-02",
  versao: 4,
  demo: true,
  demoAmbiente: "ensaio",
  valorTotal: "48.00",
  autorizacaoOperacional: { tipo: "DEMO", financeira: false },
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(restoreDeviceSession).mockResolvedValue({
    kind: "authenticated",
    deviceToken: "secret",
    dispositivo: {
      id: "device",
      negocioId: "tenant",
      tipo: "TOTEM",
      ativo: true,
      revogadoEm: null,
    },
  } as Awaited<ReturnType<typeof restoreDeviceSession>>);
  globalThis.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => body });
});
afterEach(() => jest.useRealTimers());
test("GET restrito autenticado sem tenant na URL, cache desabilitado e cancelável", async () => {
  await expect(
    getOrderTracking("tenant", id, new AbortController().signal),
  ).resolves.toEqual(body);
  expect(restoreDeviceSession).toHaveBeenCalledWith({
    expectedDeviceType: "TOTEM",
  });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(new RegExp(`/pedidos/${id}/acompanhamento$`)),
    expect.objectContaining({
      method: "GET",
      cache: "no-store",
      signal: expect.anything(),
      headers: expect.objectContaining({
        Authorization: "Bearer secret",
        "Cache-Control": "no-store",
      }),
    }),
  );
});
test.each([400, 401, 403, 404, 429, 503])(
  "HTTP %s tipado sem corpo/segredos e com Retry-After",
  async (status) => {
    jest.mocked(fetch).mockResolvedValue({
      ok: false,
      status,
      headers: { get: () => "30" },
    } as unknown as Response);
    await expect(getOrderTracking("tenant", id)).rejects.toMatchObject({
      status,
      retryAfterMs: 30000,
    });
  },
);
test("Retry-After em data HTTP", async () => {
  jest.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  jest.mocked(fetch).mockResolvedValue({
    ok: false,
    status: 429,
    headers: { get: () => new Date(Date.now() + 45000).toUTCString() },
  } as unknown as Response);
  await expect(getOrderTracking("tenant", id)).rejects.toMatchObject({
    retryAfterMs: 45000,
  });
});
test("sessão revogada encaminha pareamento e outro tenant não envia GET", async () => {
  jest
    .mocked(restoreDeviceSession)
    .mockResolvedValueOnce({ kind: "pairing", reason: "invalid-token" });
  await expect(getOrderTracking("tenant", id)).rejects.toMatchObject({
    status: 401,
  });
  await expect(getOrderTracking("outro", id)).rejects.toMatchObject({
    status: 403,
  });
  expect(fetch).not.toHaveBeenCalled();
});
test("ID inválido, resposta incompatível e rede não confirmam pedido", async () => {
  await expect(getOrderTracking("tenant", "../other")).rejects.toMatchObject({
    status: 400,
  });
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ ...body, id: "estrangeiro" }),
  } as Response);
  await expect(getOrderTracking("tenant", id)).rejects.toBeInstanceOf(
    TrackingError,
  );
  jest.mocked(fetch).mockRejectedValueOnce(new Error("segredo"));
  await expect(getOrderTracking("tenant", id)).rejects.toMatchObject({
    kind: "network",
  });
});
test("timeout e cancelamento externo abortam o transporte", async () => {
  jest
    .mocked(fetch)
    .mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    );
  const controller = new AbortController();
  const pending = getOrderTracking("tenant", id, controller.signal);
  const check = expect(pending).rejects.toMatchObject({ kind: "aborted" });
  await Promise.resolve();
  controller.abort();
  await check;
  const timeout = getOrderTracking("tenant", id);
  const timeoutCheck = expect(timeout).rejects.toMatchObject({
    kind: "timeout",
  });
  await Promise.resolve();
  jest.advanceTimersByTime(20000);
  await timeoutCheck;
});
