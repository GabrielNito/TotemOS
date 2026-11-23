import { OfflineInboxController } from "./controller";
import type { OfflineEnvelope } from "./types";

const envelope: OfflineEnvelope = {
  negocioId: "tenant-a",
  dispositivoId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  recebidoEm: 100,
  pedido: {
    nomeCliente: "Ana",
    itens: [
      {
        produtoId: "22222222-2222-4222-8222-222222222222",
        quantidade: 1,
        adicionais: [],
      },
    ],
  },
};

function setup(initial: OfflineEnvelope[] = []) {
  let saved = initial;
  const storage = {
    load: jest.fn(async () => saved),
    save: jest.fn(async (next: OfflineEnvelope[]) => {
      saved = next;
    }),
  };
  const api = { reconcile: jest.fn() };
  return {
    controller: new OfflineInboxController("tenant-a", storage, api),
    storage,
    api,
    saved: () => saved,
  };
}

test("persiste envelope do mesmo tenant antes de confirmar recebimento", async () => {
  const f = setup();
  await expect(f.controller.receive(envelope)).resolves.toEqual({
    accepted: true,
    duplicate: false,
  });
  expect(f.saved()).toEqual([envelope]);
  expect(f.storage.save).toHaveBeenCalledTimes(1);
});

test("deduplica pela chave e rejeita outro tenant sem gravar", async () => {
  const f = setup([envelope]);
  await expect(f.controller.receive(envelope)).resolves.toEqual({
    accepted: true,
    duplicate: true,
  });
  await expect(
    f.controller.receive({ ...envelope, negocioId: "tenant-b" }),
  ).rejects.toThrow("tenant");
  expect(f.storage.save).not.toHaveBeenCalled();
});

test("reconcilia o lote e só remove confirmações correspondentes", async () => {
  const second = {
    ...envelope,
    idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  };
  const f = setup([envelope, second]);
  f.api.reconcile.mockResolvedValue({
    pedidos: [
      {
        id: "pedido-1",
        idempotencyKey: envelope.idempotencyKey,
        status: "AGUARDANDO_PAGAMENTO",
      },
    ],
  });

  await expect(f.controller.reconcile()).resolves.toEqual({
    reconciled: 1,
    pending: 1,
  });
  expect(f.api.reconcile).toHaveBeenCalledWith({
    pedidos: [envelope, second].map(
      ({ dispositivoId, idempotencyKey, pedido }) => ({
        dispositivoId,
        idempotencyKey,
        pedido,
      }),
    ),
  });
  expect(f.saved()).toEqual([second]);
});

test("falha de rede preserva integralmente a caixa de entrada", async () => {
  const f = setup([envelope]);
  f.api.reconcile.mockRejectedValue(new Error("offline"));
  await expect(f.controller.reconcile()).rejects.toThrow("offline");
  expect(f.saved()).toEqual([envelope]);
  expect(f.storage.save).not.toHaveBeenCalled();
});
