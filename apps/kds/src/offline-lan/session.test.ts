import { createOfflineLanSession } from "./session";
import type { OfflineEnvelope } from "../offline-inbox/types";

const envelope: OfflineEnvelope = {
  negocioId: "tenant-a",
  dispositivoId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  recebidoEm: 100,
  pedido: {
    itens: [
      {
        produtoId: "22222222-2222-4222-8222-222222222222",
        quantidade: 1,
        adicionais: [],
      },
    ],
  },
};

function setup() {
  const sent: object[] = [];
  const close = jest.fn();
  const receive = jest.fn(async () => ({
    accepted: true as const,
    duplicate: false,
  }));
  const proof = jest.fn(async (context: string) => `proof:${context}`);
  const session = createOfflineLanSession({
    negocioId: "tenant-a",
    credential: "tenant-secret",
    nonce: () => "nonce-1",
    proof,
    receive,
    send: (value) => sent.push(JSON.parse(value)),
    close,
  });
  return { session, sent, close, receive, proof };
}

test("desafio, autenticação e ack acontecem na ordem segura", async () => {
  const f = setup();
  await f.session.message(
    JSON.stringify({
      type: "handshake",
      protocolVersion: 2,
      negocioId: "tenant-a",
      dispositivoId: envelope.dispositivoId,
    }),
  );
  expect(f.sent).toEqual([{ type: "challenge", nonce: "nonce-1" }]);

  await f.session.message(
    JSON.stringify({
      type: "authenticate",
      proof: `proof:nonce-1.auth.${envelope.dispositivoId}`,
    }),
  );
  expect(f.sent.at(-1)).toEqual({ type: "authenticated" });

  const payload = JSON.stringify(envelope);
  await f.session.message(
    JSON.stringify({
      type: "order",
      payload,
      proof: `proof:nonce-1.order.${payload}`,
    }),
  );

  expect(f.receive).toHaveBeenCalledWith(envelope);
  expect(f.sent.at(-1)).toEqual({
    type: "order_ack",
    idempotencyKey: envelope.idempotencyKey,
    duplicate: false,
  });
  expect(f.proof.mock.invocationCallOrder.at(-1)).toBeLessThan(
    f.receive.mock.invocationCallOrder[0],
  );
});

test("tenant ou prova inválidos encerram sem entregar pedido", async () => {
  const f = setup();
  await f.session.message(
    JSON.stringify({
      type: "handshake",
      protocolVersion: 2,
      negocioId: "tenant-b",
      dispositivoId: envelope.dispositivoId,
    }),
  );
  expect(f.close).toHaveBeenCalledWith(1008, "TENANT_MISMATCH");
  expect(f.receive).not.toHaveBeenCalled();

  const second = setup();
  await second.session.message(
    JSON.stringify({
      type: "handshake",
      protocolVersion: 2,
      negocioId: "tenant-a",
      dispositivoId: envelope.dispositivoId,
    }),
  );
  await second.session.message(
    JSON.stringify({ type: "authenticate", proof: "wrong" }),
  );
  expect(second.close).toHaveBeenCalledWith(1008, "INVALID_PROOF");
  expect(second.receive).not.toHaveBeenCalled();
});
