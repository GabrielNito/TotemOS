import {
  buildOrderRequest,
  OrderSubmission,
  OrderRejectedError,
} from "./order-submission";
import type { CartLine } from "./model";
import type { TrackingSnapshot } from "./order-tracking";

const cart: CartLine[] = [
  {
    key: "line",
    quantidade: 2,
    precoNoMomento: 1,
    product: {
      id: "product",
      nome: "Lanche",
      descricao: null,
      imagemUrl: null,
      precoBase: 1,
      tempoEstimadoPreparo: 0,
      variacoes: [{ id: "v", nome: "Duplo", preco: 99, esgotado: false }],
      adicionais: [
        { id: "a", nome: "Queijo", preco: 10, maximo: 2, esgotado: false },
      ],
    },
    selection: { variacaoId: "v", adicionais: { a: 2 } },
  },
];

test("envia somente identificação, referências e quantidades, sem preços ou tenant", () => {
  expect(buildOrderRequest(cart, " Ana ", "NOME")).toEqual({
    nomeCliente: "Ana",
    itens: [
      {
        produtoId: "product",
        quantidade: 2,
        variacaoNome: "Duplo",
        adicionais: [{ adicionalId: "a", quantidade: 2 }],
      },
    ],
  });
  expect(() => buildOrderRequest(cart, "", "NOME")).toThrow();
});

function setup() {
  let saved: string | null = null;
  const storage = {
    get: jest.fn(async () => saved),
    set: jest.fn(async (value: string) => {
      saved = value;
    }),
  };
  const send = jest.fn();
  const make = () =>
    new OrderSubmission(
      "tenant",
      storage,
      send,
      () => "11111111-1111-4111-8111-111111111111",
    );
  return { make, storage, send };
}
const response = {
  id: "11111111-1111-4111-8111-111111111111",
  negocioId: "tenant",
  status: "AGUARDANDO_PAGAMENTO",
  valorTotal: "218.00",
};

test("persiste antes de enviar e recupera a mesma tentativa após falha/reinício", async () => {
  const { make, storage, send } = setup();
  send.mockRejectedValueOnce(new Error("rede")).mockResolvedValue(response);
  const first = make();
  await first.prepare(buildOrderRequest(cart, "Ana", "NOME"));
  await expect(first.submit()).rejects.toThrow("rede");
  const recovered = make();
  await recovered.restore();
  await expect(recovered.submit()).resolves.toMatchObject({
    id: response.id,
    valorTotal: "218.00",
  });
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
  expect(storage.set.mock.invocationCallOrder[0]).toBeLessThan(
    send.mock.invocationCallOrder[0],
  );
  expect(() => recovered.prepare({ itens: [] })).toThrow();
});

test("bloqueia dois envios simultâneos e não envia se falhar a persistência", async () => {
  const { make, send } = setup();
  let resolve!: (value: typeof response) => void;
  send.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const state = make();
  await state.prepare(buildOrderRequest(cart, "", "CODIGO"));
  const pending = state.submit();
  await expect(state.submit()).rejects.toThrow();
  resolve(response);
  await pending;
  expect(send).toHaveBeenCalledTimes(1);
  const other = setup();
  other.storage.set.mockRejectedValue(new Error("disco"));
  await expect(
    other.make().prepare(buildOrderRequest(cart, "Ana", "NOME")),
  ).rejects.toThrow("disco");
  expect(other.send).not.toHaveBeenCalled();
});

test("rejeita resposta de outro negócio ou status inesperado", async () => {
  const { make, send } = setup();
  const state = make();
  await state.prepare(buildOrderRequest(cart, "Ana", "NOME"));
  send.mockResolvedValue({ ...response, negocioId: "other" });
  await expect(state.submit()).rejects.toThrow();
});

test("erro definitivo permite corrigir carrinho sem perder itens; erro incerto mantém bloqueio", async () => {
  const { make, send } = setup();
  const state = make();
  await state.prepare(buildOrderRequest(cart, "Ana", "NOME"));
  send.mockRejectedValue(new OrderRejectedError("Produto indisponível"));
  await expect(state.submit()).rejects.toThrow("Produto indisponível");
  expect(state.attempt).toBeNull();
  await expect(
    state.prepare(buildOrderRequest(cart, "Ana", "NOME")),
  ).resolves.toBeUndefined();
});

test.each([
  "PENDENTE",
  "EM_PREPARO",
  "PRONTO",
  "ENTREGUE",
  "CANCELADO",
  "CANCELADO_AGUARDANDO_ESTORNO",
])(
  "recupera POST perdido após commit com estado corrente %s e mesma chave/payload",
  async (status) => {
    const { make, send } = setup();
    send
      .mockRejectedValueOnce(new Error("resposta perdida"))
      .mockResolvedValue({ ...response, status });
    const first = make();
    await first.prepare(buildOrderRequest(cart, "Ana", "NOME"));
    await expect(first.submit()).rejects.toThrow();
    const restored = make();
    await restored.restore();
    await expect(restored.submit()).resolves.toMatchObject({
      id: response.id,
      status,
    });
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
    const confirmed = make();
    await confirmed.restore();
    await confirmed.submit();
    expect(send).toHaveBeenCalledTimes(2);
  },
);

test.each([{ id: "invalid" }, { valorTotal: "" }, { status: "PAGO" }])(
  "resposta incompatível mantém tentativa incerta",
  async (change) => {
    const f = setup();
    const s = f.make();
    await s.prepare(buildOrderRequest(cart, "Ana", "NOME"));
    f.send.mockResolvedValue({ ...response, ...change });
    await expect(s.submit()).rejects.toThrow();
    expect(s.attempt?.result).toBeUndefined();
  },
);

const tracked: TrackingSnapshot = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "ENTREGUE",
  senha: 12,
  dataOperacional: "2026-11-02",
  versao: 5,
  valorTotal: "218.00",
  demo: true,
  demoAmbiente: "ensaio",
  autorizacaoOperacional: { tipo: "DEMO", financeira: false },
};
function finalization() {
  let saved: string | null = null;
  const storage = {
    get: jest.fn(async () => saved),
    set: jest.fn(async (v: string) => {
      saved = v;
    }),
  };
  const clearCart = jest.fn(async () => {});
  const send = jest.fn(async () => ({ ...response, id: tracked.id }));
  const make = () =>
    new OrderSubmission("tenant", storage, send, () => tracked.id, clearCart);
  const ready = async () => {
    const s = make();
    await s.prepare(buildOrderRequest(cart, "Ana", "NOME"));
    await s.submit();
    return s;
  };
  return { make, ready, storage, clearCart, send };
}
test.each([
  "AGUARDANDO_PAGAMENTO",
  "PENDENTE",
  "EM_PREPARO",
  "PRONTO",
  "CANCELADO",
  "CANCELADO_AGUARDANDO_ESTORNO",
] as const)("bloqueia encerramento em %s", async (status) => {
  const f = finalization();
  const s = await f.ready();
  await s.saveTracking({ ...tracked, status }, 100);
  await expect(s.finish()).rejects.toThrow();
  expect(f.clearCart).not.toHaveBeenCalled();
});
test("POST ENTREGUE sem GET confirmado não autoriza encerramento", async () => {
  const f = setup();
  f.send.mockResolvedValue({ ...response, status: "ENTREGUE" });
  const s = f.make();
  await s.prepare(buildOrderRequest(cart, "Ana", "NOME"));
  await s.submit();
  await expect(s.finish()).rejects.toThrow();
});
test.each(["cart", "attempt"])(
  "retoma finalização interrompida em %s sem perder a referência antes do carrinho",
  async (failure) => {
    const f = finalization();
    const s = await f.ready();
    await s.saveTracking(tracked, 100);
    if (failure === "cart")
      f.clearCart.mockRejectedValueOnce(new Error("disco"));
    // Keep the closing marker durable in both crash windows.
    if (failure === "attempt") {
      f.storage.set.mockReset();
      let durable: string | null = JSON.stringify(s.attempt);
      f.storage.get.mockImplementation(async () => durable);
      f.storage.set.mockImplementation(async (v) => {
        if (!v) throw new Error("disco");
        durable = v;
      });
    }
    await expect(s.finish()).rejects.toThrow("disco");
    expect(s.attempt?.closing).toBe(true);
    expect(() => s.prepare(buildOrderRequest(cart, "Outro", "NOME"))).toThrow();
    if (failure === "attempt") f.storage.set.mockImplementation(async () => {});
    const restored = f.make();
    await restored.restore();
    expect(restored.attempt).toBeNull();
    expect(f.clearCart).toHaveBeenCalled();
  },
);
test("falha na marca durável não limpa nada; duplo toque é bloqueado", async () => {
  const f = finalization();
  const s = await f.ready();
  await s.saveTracking(tracked, 100);
  f.storage.set.mockRejectedValueOnce(new Error("disco"));
  await expect(s.finish()).rejects.toThrow();
  expect(f.clearCart).not.toHaveBeenCalled();
  const pending = s.finish();
  await expect(s.finish()).rejects.toThrow();
  await pending;
  expect(s.attempt).toBeNull();
  expect(f.storage.set.mock.calls.at(-1)?.[0]).toBe("");
});
test("reinício preserva snapshot em preparo, pronto ou entregue e bloqueia armazenamento inválido", async () => {
  const f = finalization();
  const s = await f.ready();
  for (const [status, versao] of [
    ["EM_PREPARO", 3],
    ["PRONTO", 4],
    ["ENTREGUE", 5],
  ] as const) {
    await s.saveTracking({ ...tracked, status, versao }, 100);
    const restored = f.make();
    await restored.restore();
    expect(restored.attempt?.tracking?.snapshot.status).toBe(status);
  }
  f.storage.get.mockResolvedValueOnce("{invalido");
  await expect(f.make().restore()).rejects.toThrow();
  f.storage.get.mockRejectedValueOnce(new Error("disco"));
  await expect(f.make().restore()).rejects.toThrow();
});
test("falha ao persistir tentativa retém UUID/payload e exige nova persistência antes do POST", async () => {
  const f = setup();
  const s = f.make();
  f.storage.set.mockRejectedValueOnce(new Error("disco"));
  await expect(
    s.prepare(buildOrderRequest(cart, "Ana", "NOME")),
  ).rejects.toThrow();
  expect(s.attempt?.key).toBe("11111111-1111-4111-8111-111111111111");
  expect(() => s.prepare(buildOrderRequest(cart, "Outro", "NOME"))).toThrow();
  f.send.mockResolvedValue(response);
  await s.submit();
  expect(f.storage.set.mock.calls[0][0]).toBe(f.storage.set.mock.calls[1][0]);
  expect(f.send.mock.calls[0][0].nomeCliente).toBe("Ana");
});
test.each([
  { itens: [null] },
  { itens: [{ produtoId: "p", quantidade: -1, adicionais: [] }] },
  {
    negocioId: "other",
    itens: [{ produtoId: "p", quantidade: 1, adicionais: [] }],
  },
])(
  "conteúdo inválido persistido bloqueia recuperação sem transmissão",
  async (request) => {
    const f = setup();
    f.storage.get.mockResolvedValueOnce(
      JSON.stringify({
        negocioId: "tenant",
        key: "11111111-1111-4111-8111-111111111111",
        request,
      }),
    );
    await expect(f.make().restore()).rejects.toThrow();
    expect(f.send).not.toHaveBeenCalled();
  },
);
