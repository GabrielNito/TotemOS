export const LAN_SPIKE_PROTOCOL = "totemos-lan-spike" as const;
export const LAN_SPIKE_PROTOCOL_VERSION = 1 as const;
export const LAN_SPIKE_HEALTH_PATH = "/_spike/health" as const;
export const LAN_SPIKE_WEBSOCKET_PATH = "/_spike/ws" as const;

export interface HandshakeMessage {
  type: "handshake";
  protocolVersion: number;
  negocioId: string;
}

export interface HandshakeAckMessage {
  type: "handshake_ack";
  protocol: typeof LAN_SPIKE_PROTOCOL;
  version: typeof LAN_SPIKE_PROTOCOL_VERSION;
}

export interface DiagnosticAckMessage {
  type: "diagnostic_ack";
  id: string;
  status: "ok";
}

export interface HandshakeRejectedMessage {
  type: "handshake_rejected";
  code: "INVALID_MESSAGE" | "UNSUPPORTED_PROTOCOL" | "TENANT_MISMATCH";
}

export type ServerMessage =
  | HandshakeAckMessage
  | DiagnosticAckMessage
  | HandshakeRejectedMessage;

export function createHandshakeMessage(negocioId: string): HandshakeMessage {
  return {
    type: "handshake",
    protocolVersion: LAN_SPIKE_PROTOCOL_VERSION,
    negocioId,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function decodeMessage(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  const record = asRecord(decodeMessage(raw));
  if (!record || typeof record.type !== "string") {
    return null;
  }

  if (
    record.type === "handshake_ack" &&
    record.protocol === LAN_SPIKE_PROTOCOL &&
    record.version === LAN_SPIKE_PROTOCOL_VERSION
  ) {
    return {
      type: "handshake_ack",
      protocol: LAN_SPIKE_PROTOCOL,
      version: LAN_SPIKE_PROTOCOL_VERSION,
    };
  }

  if (
    record.type === "diagnostic_ack" &&
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    record.status === "ok"
  ) {
    return { type: "diagnostic_ack", id: record.id, status: "ok" };
  }

  if (
    record.type === "handshake_rejected" &&
    (record.code === "INVALID_MESSAGE" ||
      record.code === "UNSUPPORTED_PROTOCOL" ||
      record.code === "TENANT_MISMATCH")
  ) {
    return { type: "handshake_rejected", code: record.code };
  }

  return null;
}

export function serializeMessage(message: object): string {
  return JSON.stringify(message);
}
