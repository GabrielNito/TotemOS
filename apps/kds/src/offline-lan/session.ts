import type { OfflineEnvelope } from "../offline-inbox/types";

export const OFFLINE_LAN_PROTOCOL_VERSION = 2;

type Dependencies = {
  negocioId: string;
  credential: string;
  nonce(): string;
  proof(context: string, credential: string): Promise<string>;
  receive(envelope: OfflineEnvelope): Promise<{
    accepted: true;
    duplicate: boolean;
  }>;
  send(value: string): void;
  close(code: number, reason: string): void;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parse(raw: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(raw));
  } catch {
    return null;
  }
}

function sameProof(left: unknown, right: string): boolean {
  if (typeof left !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < right.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function createOfflineLanSession(dependencies: Dependencies) {
  let state: "handshake" | "authenticate" | "ready" | "closed" = "handshake";
  let nonce = "";
  let dispositivoId = "";

  const reject = (reason: string) => {
    state = "closed";
    dependencies.close(1008, reason);
  };
  const send = (value: object) => dependencies.send(JSON.stringify(value));

  return {
    async message(raw: string) {
      if (state === "closed") return;
      const message = parse(raw);
      if (!message || typeof message.type !== "string") {
        reject("INVALID_MESSAGE");
        return;
      }

      if (state === "handshake") {
        if (
          message.type !== "handshake" ||
          message.protocolVersion !== OFFLINE_LAN_PROTOCOL_VERSION ||
          typeof message.negocioId !== "string" ||
          typeof message.dispositivoId !== "string"
        ) {
          reject("INVALID_HANDSHAKE");
          return;
        }
        if (message.negocioId !== dependencies.negocioId) {
          reject("TENANT_MISMATCH");
          return;
        }
        dispositivoId = message.dispositivoId;
        nonce = dependencies.nonce();
        state = "authenticate";
        send({ type: "challenge", nonce });
        return;
      }

      if (state === "authenticate") {
        const expected = await dependencies.proof(
          `${nonce}.auth.${dispositivoId}`,
          dependencies.credential,
        );
        if (message.type !== "authenticate" || !sameProof(message.proof, expected)) {
          reject("INVALID_PROOF");
          return;
        }
        state = "ready";
        send({ type: "authenticated" });
        return;
      }

      if (
        message.type !== "order" ||
        typeof message.payload !== "string" ||
        typeof message.proof !== "string"
      ) {
        reject("INVALID_MESSAGE");
        return;
      }
      const expected = await dependencies.proof(
        `${nonce}.order.${message.payload}`,
        dependencies.credential,
      );
      if (!sameProof(message.proof, expected)) {
        reject("INVALID_PROOF");
        return;
      }
      const envelope = parse(message.payload) as OfflineEnvelope | null;
      if (!envelope || envelope.dispositivoId !== dispositivoId) {
        reject("DEVICE_MISMATCH");
        return;
      }
      const result = await dependencies.receive(envelope);
      send({
        type: "order_ack",
        idempotencyKey: envelope.idempotencyKey,
        duplicate: result.duplicate,
      });
    },
  };
}
