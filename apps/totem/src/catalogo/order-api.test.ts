import * as SecureStore from "expo-secure-store";
import { restoreDeviceSession } from "../device-pairing/session";
import { createOrderSubmission } from "./order-api";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock("../device-pairing/session", () => ({
  restoreDeviceSession: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
  jest
    .mocked(restoreDeviceSession)
    .mockResolvedValue({
      kind: "authenticated",
      deviceToken: "test-token",
      dispositivo: { negocioId: "tenant", tipo: "TOTEM" },
    } as Awaited<ReturnType<typeof restoreDeviceSession>>);
  globalThis.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "order",
        negocioId: "tenant",
        status: "AGUARDANDO_PAGAMENTO",
        valorTotal: "25.00",
      }),
    });
});
test("autentica o envio e usa a mesma chave persistida em cada retentativa", async () => {
  const state = createOrderSubmission("tenant");
  await state.prepare({
    nomeCliente: "Ana",
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  const attempt = state.attempt!;
  await state.submit();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/pedidos$/),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test-token",
        "Idempotency-Key": attempt.key,
      }),
      body: JSON.stringify(attempt.request),
    }),
  );
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "totemos.order-attempt.tenant",
    expect.any(String),
  );
});
test("não envia com sessão de outro tenant", async () => {
  jest
    .mocked(restoreDeviceSession)
    .mockResolvedValue({
      kind: "authenticated",
      deviceToken: "other",
      dispositivo: { negocioId: "other", tipo: "TOTEM" },
    } as Awaited<ReturnType<typeof restoreDeviceSession>>);
  const state = createOrderSubmission("tenant");
  await state.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  await expect(state.submit()).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
test("HTTP 503 mantém tentativa; HTTP 400 permite corrigir sem apagar carrinho", async () => {
  const state = createOrderSubmission("tenant");
  await state.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  jest.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
  await expect(state.submit()).rejects.toThrow();
  expect(state.attempt).not.toBeNull();
  jest.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response);
  await expect(state.submit()).rejects.toThrow();
  expect(state.attempt).toBeNull();
});
