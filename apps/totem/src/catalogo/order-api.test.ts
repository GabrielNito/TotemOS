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
  jest.mocked(restoreDeviceSession).mockResolvedValue({
    kind: "authenticated",
    deviceToken: "test-token",
    dispositivo: { id: "device", negocioId: "tenant", tipo: "TOTEM" },
  } as Awaited<ReturnType<typeof restoreDeviceSession>>);
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      negocioId: "tenant",
      dispositivoId: "device",
      status: "AGUARDANDO_PAGAMENTO",
      valorTotal: "25.00",
    }),
  });
});
test("replay de outro dispositivo é rejeitado mesmo no mesmo negócio", async () => {
  const state = createOrderSubmission("tenant");
  await state.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      id: "11111111-1111-4111-8111-111111111111",
      negocioId: "tenant",
      dispositivoId: "foreign",
      status: "PRONTO",
      valorTotal: "25.00",
    }),
  } as Response);
  await expect(state.submit()).rejects.toThrow();
  expect(state.attempt?.result).toBeUndefined();
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
  jest.mocked(restoreDeviceSession).mockResolvedValue({
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
test("HTTP 400 no primeiro envio permite corrigir sem apagar carrinho", async () => {
  const state = createOrderSubmission("tenant");
  await state.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  jest.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response);
  await expect(state.submit()).rejects.toThrow();
  expect(state.attempt).toBeNull();
});

test("404 após resposta perdida conserva o payload e a chave da tentativa", async () => {
  const state = createOrderSubmission("tenant");
  await state.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  const attempt = state.attempt;
  jest.mocked(fetch).mockRejectedValueOnce(new Error("resposta perdida"));
  await expect(state.submit()).rejects.toThrow();
  jest
    .mocked(fetch)
    .mockResolvedValueOnce({ ok: false, status: 404 } as Response);
  await expect(state.submit()).rejects.toThrow();
  expect(state.attempt).toEqual({ ...attempt, postStarted: true });
});

test("não repete um POST incerto após troca de dispositivo no mesmo tenant", async () => {
  const state = createOrderSubmission("tenant", "previous-device");
  await state.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  await expect(state.submit()).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect(state.attempt).not.toBeNull();
});

test("restaura tentativa sem POST no mesmo dispositivo e bloqueia acesso por outro", async () => {
  const beforePost = createOrderSubmission("tenant", "device");
  await beforePost.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  const saved = jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)![1];
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(saved);
  const restored = createOrderSubmission("tenant", "device");
  await restored.restore();
  expect(restored.attempt).toEqual(beforePost.attempt);
  await expect(
    createOrderSubmission("tenant", "new-device").restore(),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

test("não reenvia tentativa legada sem vínculo e sem pedido confirmado", async () => {
  const legacy = {
    negocioId: "tenant",
    key: "11111111-1111-4111-8111-111111111111",
    request: { itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }] },
  };
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(JSON.stringify(legacy));
  const state = createOrderSubmission("tenant", "device");
  await expect(state.restore()).rejects.toThrow();
  await expect(state.submit()).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test.each([404, 200])(
  "verifica autoria do pedido legado antes de publicar o snapshot (HTTP %s)",
  async (status) => {
    const id = "11111111-1111-4111-8111-111111111111";
    const legacy = {
      negocioId: "tenant",
      key: id,
      request: { itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }] },
      result: {
        id,
        negocioId: "tenant",
        status: "PENDENTE",
        valorTotal: "25.00",
      },
    };
    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValue(JSON.stringify(legacy));
    jest.mocked(restoreDeviceSession).mockResolvedValue({
      kind: "authenticated",
      deviceToken: "test-token",
      dispositivo: {
        id: "device",
        negocioId: "tenant",
        tipo: "TOTEM",
        ativo: true,
      },
    } as Awaited<ReturnType<typeof restoreDeviceSession>>);
    const snapshot = {
      id,
      status: "PRONTO",
      senha: 1,
      dataOperacional: null,
      versao: 2,
      demo: false,
      demoAmbiente: null,
      valorTotal: "25.00",
      autorizacaoOperacional: null,
    };
    jest.mocked(fetch).mockResolvedValue({
      ok: status === 200,
      status,
      json: async () => snapshot,
    } as Response);
    const state = createOrderSubmission("tenant", "device");
    if (status === 404) {
      await expect(state.restore()).rejects.toThrow();
      expect(state.attempt).toBeNull();
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    } else {
      await state.restore();
      const saved = jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)![1];
      expect(JSON.parse(saved)).toMatchObject({
        dispositivoId: "device",
        key: legacy.key,
        request: legacy.request,
        tracking: { snapshot },
      });
      expect(state.attempt?.tracking?.snapshot).toEqual(snapshot);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/acompanhamento$/),
      expect.objectContaining({ method: "GET" }),
    );
  },
);

test("400 após perda de resposta e reinício mantém tentativa gravada", async () => {
  const state = createOrderSubmission("tenant", "device");
  await state.prepare({
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  });
  jest.mocked(fetch).mockRejectedValueOnce(new Error("resposta perdida"));
  await expect(state.submit()).rejects.toThrow();
  const saved = jest.mocked(SecureStore.setItemAsync).mock.calls.at(-1)![1];
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(saved);
  const restored = createOrderSubmission("tenant", "device");
  await restored.restore();
  jest
    .mocked(fetch)
    .mockResolvedValueOnce({ ok: false, status: 400 } as Response);
  await expect(restored.submit()).rejects.toThrow();
  expect(restored.attempt).toMatchObject(JSON.parse(saved));
  expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
    "totemos.order-attempt.tenant",
    "",
  );
});
