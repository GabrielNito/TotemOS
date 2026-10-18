export type ConnectionState =
  | "procurando_servidor"
  | "servidor_encontrado"
  | "conectando"
  | "conectado"
  | "desconectado"
  | "erro";

export type ConnectionEvent =
  | { type: "SEARCH_STARTED" }
  | { type: "SERVER_FOUND" }
  | { type: "CONNECT_REQUESTED" }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "ERROR"; message: string }
  | { type: "RETRY_REQUESTED" };

export function connectionStateReducer(
  _state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState {
  switch (event.type) {
    case "SEARCH_STARTED":
    case "RETRY_REQUESTED":
      return "procurando_servidor";
    case "SERVER_FOUND":
      return "servidor_encontrado";
    case "CONNECT_REQUESTED":
      return "conectando";
    case "CONNECTED":
      return "conectado";
    case "DISCONNECTED":
      return "desconectado";
    case "ERROR":
      return "erro";
  }
}

export function getRetryDelayMs(
  attempt: number,
  baseDelayMs = 500,
  maxDelayMs = 5_000,
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(maxDelayMs, baseDelayMs * 2 ** safeAttempt);
}
