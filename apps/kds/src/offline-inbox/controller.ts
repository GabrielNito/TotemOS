import type {
  OfflineEnvelope,
  OfflineInboxStorage,
  OfflineReconciliationApi,
} from "./types";

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function validateOfflineEnvelope(
  value: unknown,
): asserts value is OfflineEnvelope {
  const candidate = value as OfflineEnvelope | null;
  if (
    !candidate ||
    typeof candidate.negocioId !== "string" ||
    !validUuid(candidate.dispositivoId) ||
    !validUuid(candidate.idempotencyKey) ||
    !Number.isFinite(candidate.recebidoEm) ||
    !candidate.pedido ||
    !Array.isArray(candidate.pedido.itens) ||
    candidate.pedido.itens.length === 0
  ) {
    throw new Error("Pedido LAN inválido.");
  }
}

export class OfflineInboxController {
  constructor(
    private readonly negocioId: string,
    private readonly storage: OfflineInboxStorage,
    private readonly api: OfflineReconciliationApi,
  ) {}

  async receive(envelope: OfflineEnvelope) {
    validateOfflineEnvelope(envelope);
    if (envelope.negocioId !== this.negocioId) {
      throw new Error("Pedido LAN pertence a outro tenant.");
    }
    const current = await this.storage.load();
    if (
      current.some((item) => item.idempotencyKey === envelope.idempotencyKey)
    ) {
      return { accepted: true as const, duplicate: true as const };
    }
    await this.storage.save([...current, envelope]);
    return { accepted: true as const, duplicate: false as const };
  }

  async pendingCount() {
    return (await this.storage.load()).length;
  }

  async reconcile() {
    const current = await this.storage.load();
    if (current.length === 0) return { reconciled: 0, pending: 0 };
    const result = await this.api.reconcile({
      pedidos: current.map(({ dispositivoId, idempotencyKey, pedido }) => ({
        dispositivoId,
        idempotencyKey,
        pedido,
      })),
    });
    const confirmed = new Set(
      result.pedidos.map((item) => item.idempotencyKey.toLowerCase()),
    );
    const pending = current.filter(
      (item) => !confirmed.has(item.idempotencyKey.toLowerCase()),
    );
    await this.storage.save(pending);
    return {
      reconciled: current.length - pending.length,
      pending: pending.length,
    };
  }
}
