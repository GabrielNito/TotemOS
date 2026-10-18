import {
  LAN_SPIKE_HEALTH_PATH,
  LAN_SPIKE_PROTOCOL,
  LAN_SPIKE_PROTOCOL_VERSION,
  LAN_SPIKE_WEBSOCKET_PATH,
  createHealthPayload,
  evaluateHandshake,
  parseClientMessage,
  serializeMessage,
  type DiagnosticMessage,
} from "./protocol";

export interface DiagnosticHttpRequest {
  method: string;
  path: string;
}

export interface DiagnosticHttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface DiagnosticWebSocket {
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onclose: (() => void) | null;
  send(data: string): unknown;
  close(code?: number, reason?: string): unknown;
}

export function handleDiagnosticHttpRequest(
  request: DiagnosticHttpRequest,
): DiagnosticHttpResponse {
  if (request.method === "GET" && request.path === LAN_SPIKE_HEALTH_PATH) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createHealthPayload()),
    };
  }

  return { statusCode: 404, body: "Not found" };
}

function asText(data: string | ArrayBuffer): string | null {
  return typeof data === "string" ? data : null;
}

export function createDiagnosticWebSocketHandler(
  socket: DiagnosticWebSocket,
  expectedNegocioId: string,
  onDiagnostic?: (id: string) => void,
  onClosed?: () => void,
): () => void {
  let authorized = false;
  let closed = false;

  socket.onmessage = event => {
    if (closed) {
      return;
    }

    const raw = asText(event.data);
    if (!authorized) {
      const decision = evaluateHandshake(raw, expectedNegocioId);
      if (!decision.accepted) {
        closed = true;
        socket.send(
          serializeMessage({ type: "handshake_rejected", code: decision.code }),
        );
        socket.close(1008, decision.code);
        return;
      }

      authorized = true;
      socket.send(
        serializeMessage({
          type: "handshake_ack",
          protocol: LAN_SPIKE_PROTOCOL,
          version: LAN_SPIKE_PROTOCOL_VERSION,
        }),
      );
      return;
    }

    const message = parseClientMessage(raw);
    if (!message || message.type !== "diagnostic") {
      socket.send(serializeMessage({ type: "error", code: "INVALID_MESSAGE" }));
      return;
    }

    acknowledgeDiagnostic(socket, message, onDiagnostic);
  };

  socket.onclose = () => {
    closed = true;
    authorized = false;
    onClosed?.();
  };

  return () => {
    closed = true;
    authorized = false;
    socket.onmessage = null;
    socket.onclose = null;
  };
}

function acknowledgeDiagnostic(
  socket: DiagnosticWebSocket,
  message: DiagnosticMessage,
  onDiagnostic?: (id: string) => void,
): void {
  onDiagnostic?.(message.id);
  socket.send(
    serializeMessage({ type: "diagnostic_ack", id: message.id, status: "ok" }),
  );
}

export { LAN_SPIKE_WEBSOCKET_PATH };
