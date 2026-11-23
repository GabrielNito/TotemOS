import { deliverOfflineOrder } from "./client";

test("descobre KDS, autentica e só conclui com ack da mesma chave", async () => {
  const sent: Record<string, unknown>[] = [];
  const socket = {
    onopen: null as null | (() => void),
    onmessage: null as null | ((event: { data: string | ArrayBuffer }) => void),
    onerror: null as null | (() => void),
    onclose: null as null | (() => void),
    send: jest.fn((raw: string) => sent.push(JSON.parse(raw))),
    close: jest.fn(),
  };
  const proof = jest.fn(async (context: string) => `proof:${context}`);
  const pending = deliverOfflineOrder({
    negocioId: "tenant-a",
    dispositivoId: "11111111-1111-4111-8111-111111111111",
    credential: "secret",
    idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    pedido: {
      itens: [
        {
          produtoId: "22222222-2222-4222-8222-222222222222",
          quantidade: 1,
          adicionais: [],
        },
      ],
    },
    valorEstimado: 10,
    discover: jest.fn(async () => "ws://kds.local/v1/offline-orders"),
    socket: () => socket,
    proof,
    now: () => 100,
    timeoutMs: 1000,
  });

  await Promise.resolve();
  await Promise.resolve();
  socket.onopen?.();
  expect(sent[0]).toMatchObject({ type: "handshake", protocolVersion: 2 });
  await socket.onmessage?.({
    data: JSON.stringify({ type: "challenge", nonce: "nonce-1" }),
  });
  expect(sent[1]).toEqual({
    type: "authenticate",
    proof: "proof:nonce-1.auth.11111111-1111-4111-8111-111111111111",
  });
  await socket.onmessage?.({ data: JSON.stringify({ type: "authenticated" }) });
  expect(sent[2]).toMatchObject({ type: "order" });
  await socket.onmessage?.({
    data: JSON.stringify({
      type: "order_ack",
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      duplicate: false,
    }),
  });

  await expect(pending).resolves.toBeUndefined();
  expect(socket.close).toHaveBeenCalled();
});
