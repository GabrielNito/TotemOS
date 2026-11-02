import { QueueJournalError } from "./types";
import { safeQueueError, createQueueApi, parsePage } from "./api";
import { parseRetryAfter } from "../device-pairing/api";
const pedido = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PRONTO",
  senha: null,
  dataOperacional: null,
  versao: 2,
  demo: true,
  demoAmbiente: "ensaio",
  createdAt: "2026-11-01T12:00:00.000Z",
  preparoZero: true,
  elegivelCozinha: true,
  autorizacaoOperacional: { tipo: "DEMO", financeira: false },
  itens: [
    {
      nomeProduto: "Água",
      quantidade: 1,
      variacaoNome: null,
      observacao: "Gelada",
      adicionais: [],
      escolhas: [],
    },
  ],
};
const reply = (data: unknown) => ({ ok: true, json: async () => data });
afterEach(() => jest.restoreAllMocks());
it("uses Bearer and paginates from first page with highest-version deduplication", async () => {
  const fetcher = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      reply({ pedidos: [pedido], proximoCursor: "a/b" }) as Response,
    )
    .mockResolvedValueOnce(
      reply({
        pedidos: [{ ...pedido, versao: 3, senha: 10 }],
        proximoCursor: null,
      }) as Response,
    )
    .mockResolvedValueOnce(
      reply({
        pedidos: [{ ...pedido, versao: 3, senha: 10 }],
        proximoCursor: null,
      }) as Response,
    );
  const api = createQueueApi("secret");
  expect(await api.list()).toMatchObject([{ versao: 3, senha: 10 }]);
  expect(fetcher.mock.calls[0][0]).toContain("/pedidos/fila?limite=50");
  expect(fetcher.mock.calls[1][0]).toContain("cursor=a%2Fb");
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
    Authorization: "Bearer secret",
  });
});
it("rejects cursor loops and malformed order snapshots", async () => {
  jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      reply({ pedidos: [], proximoCursor: "repeat" }) as Response,
    );
  await expect(createQueueApi("token").list()).rejects.toThrow("Paginação");
  expect(() =>
    parsePage({ pedidos: [{ ...pedido, itens: [{}] }], proximoCursor: null }),
  ).toThrow();
});
it("sends only implemented strict senha and status bodies with original key", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockResolvedValue(
    reply({
      resultadoOperacao: { tipo: "ATRIBUICAO_SENHA", repetida: true },
      pedido: { ...pedido, senha: 12, dataOperacional: "2026-11-01" },
    }) as Response,
  );
  const api = createQueueApi("token");
  await api.execute({
    kind: "senha",
    key: "uuid",
    orderId: pedido.id,
    attempts: 0,
    nextAttempt: 0,
  });
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    method: "POST",
    body: "{}",
    headers: { "Idempotency-Key": "uuid" },
  });
  fetcher.mockResolvedValue(
    reply({
      resultadoOperacao: { tipo: "TRANSICAO", repetida: false },
      pedido: { ...pedido, status: "ENTREGUE" },
    }) as Response,
  );
  await api.execute({
    kind: "status",
    target: "ENTREGUE",
    version: 3,
    key: "uuid2",
    orderId: pedido.id,
    attempts: 0,
    nextAttempt: 0,
  });
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
    status: "ENTREGUE",
    versaoEsperada: 3,
  });
});
it("supports Retry-After seconds and HTTP dates", () => {
  expect(parseRetryAfter("60")).toBe(60000);
  expect(
    parseRetryAfter(new Date(Date.now() + 60000).toUTCString()),
  ).toBeGreaterThan(58000);
  expect(parseRetryAfter("invalid")).toBeUndefined();
});
it("times out HTTP calls without exposing credentials", async () => {
  jest.useFakeTimers();
  const fetcher = jest.spyOn(globalThis, "fetch").mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("timeout")),
        );
      }),
  );
  const promise = createQueueApi("secret").list();
  const assertion = expect(promise).rejects.toThrow("timeout");
  await jest.advanceTimersByTimeAsync(15000);
  await assertion;
  expect(String(fetcher.mock.calls[0][0])).not.toContain("secret");
  jest.useRealTimers();
});
it("revalidates an inconsistent multi-page observation before accepting it", async () => {
  const fetcher = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      reply({ pedidos: [pedido], proximoCursor: "cursor" }) as Response,
    )
    .mockResolvedValueOnce(
      reply({
        pedidos: [{ ...pedido, versao: 3, senha: 10 }],
        proximoCursor: null,
      }) as Response,
    )
    .mockResolvedValueOnce(
      reply({
        pedidos: [{ ...pedido, versao: 3, senha: 10 }],
        proximoCursor: null,
      }) as Response,
    );
  expect(await createQueueApi("token").list()).toMatchObject([
    { versao: 3, senha: 10 },
  ]);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[2][0]).not.toContain("cursor=");
});
it("rejects persistently inconsistent pagination instead of presenting it as synchronized", async () => {
  jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      reply({ pedidos: [pedido], proximoCursor: "a" }) as Response,
    )
    .mockResolvedValueOnce(
      reply({
        pedidos: [{ ...pedido, versao: 3 }],
        proximoCursor: null,
      }) as Response,
    )
    .mockResolvedValueOnce(
      reply({ pedidos: [pedido], proximoCursor: "b" }) as Response,
    )
    .mockResolvedValueOnce(
      reply({
        pedidos: [{ ...pedido, versao: 4 }],
        proximoCursor: null,
      }) as Response,
    );
  await expect(createQueueApi("token").list()).rejects.toThrow("Fila mudou");
});
it("identifies journal corruption without suggesting that a network retry will repair it", () => {
  expect(safeQueueError(new QueueJournalError())).toContain("Diário inválido");
});
