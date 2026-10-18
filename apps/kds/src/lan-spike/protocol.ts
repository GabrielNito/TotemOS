export const LAN_SPIKE_PROTOCOL = "totemos-lan-spike" as const;
export const LAN_SPIKE_PROTOCOL_VERSION = 1 as const;
export const LAN_SPIKE_HEALTH_PATH = "/_spike/health" as const;
export const LAN_SPIKE_WEBSOCKET_PATH = "/_spike/ws" as const;

export interface HandshakeMessage {
  type: "handshake";
  protocolVersion: number;
  negocioId: string;
}

export interface DiagnosticMessage {
  type: "diagnostic";
  id: string;
  payload?: string;
}

export type ClientMessage = HandshakeMessage | DiagnosticMessage;

export type HandshakeDecision =
  | { accepted: true; handshake: HandshakeMessage }
  | {
      accepted: false;
      code: "INVALID_MESSAGE" | "UNSUPPORTED_PROTOCOL" | "TENANT_MISMATCH";
    };

export function createHealthPayload() {
  return {
    protocol: LAN_SPIKE_PROTOCOL,
    version: LAN_SPIKE_PROTOCOL_VERSION,
    status: "ok" as const,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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

export function parseClientMessage(raw: unknown): ClientMessage | null {
  const record = asRecord(decodeMessage(raw));
  if (!record || typeof record.type !== "string") {
    return null;
  }

  if (
    record.type === "handshake" &&
    typeof record.protocolVersion === "number" &&
    Number.isInteger(record.protocolVersion) &&
    asNonEmptyString(record.negocioId)
  ) {
    return {
      type: "handshake",
      protocolVersion: record.protocolVersion,
      negocioId: record.negocioId as string,
    };
  }

  if (
    record.type === "diagnostic" &&
    asNonEmptyString(record.id) &&
    (record.payload === undefined || typeof record.payload === "string")
  ) {
    return {
      type: "diagnostic",
      id: record.id as string,
      ...(record.payload === undefined ? {} : { payload: record.payload }),
    };
  }

  return null;
}

export function evaluateHandshake(
  raw: unknown,
  expectedNegocioId: string,
): HandshakeDecision {
  const message = parseClientMessage(raw);
  if (!message || message.type !== "handshake") {
    return { accepted: false, code: "INVALID_MESSAGE" };
  }

  if (message.protocolVersion !== LAN_SPIKE_PROTOCOL_VERSION) {
    return { accepted: false, code: "UNSUPPORTED_PROTOCOL" };
  }

  if (message.negocioId !== expectedNegocioId) {
    return { accepted: false, code: "TENANT_MISMATCH" };
  }

  return { accepted: true, handshake: message };
}

export function serializeMessage(message: object): string {
  return JSON.stringify(message);
}
