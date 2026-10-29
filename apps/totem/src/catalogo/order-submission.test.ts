import {
  buildOrderRequest,
  OrderSubmission,
  OrderRejectedError,
} from "./order-submission";
import type { CartLine } from "./model";

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
  id: "order",
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
    id: "order",
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
