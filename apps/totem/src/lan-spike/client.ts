import {
  createDiscoverySession,
  type DiscoveryBackend,
} from "./discovery-client";
import {
  LAN_SPIKE_HEALTH_PATH,
  LAN_SPIKE_PROTOCOL,
  LAN_SPIKE_PROTOCOL_VERSION,
  createHandshakeMessage,
  parseServerMessage,
  serializeMessage,
} from "./protocol";
import {
  connectionStateReducer,
  getRetryDelayMs,
  type ConnectionState,
} from "./connection";
import {
  serviceEndpoint,
  type DiscoveredKdsService,
} from "./discovery";

export interface LanSpikeHealthPayload {
  protocol: typeof LAN_SPIKE_PROTOCOL;
  version: typeof LAN_SPIKE_PROTOCOL_VERSION;
  status: "ok";
}

export interface LanSpikeHttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type LanSpikeFetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<LanSpikeHttpResponse>;

export interface LanSpikeWebSocket {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
  onclose: (() => void) | null;
  send(data: string): unknown;
  close(code?: number, reason?: string): unknown;
}

export type LanSpikeWebSocketFactory = (url: string) => LanSpikeWebSocket;

export interface TotemLanSpikeClientOptions {
  negocioId: string;
  createDiscoveryBackend: () => DiscoveryBackend;
  fetchImpl?: LanSpikeFetch;
  webSocketFactory?: LanSpikeWebSocketFactory;
  healthTimeoutMs?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
}

export interface TotemLanSpikeSnapshot {
  state: ConnectionState;
  service: DiscoveredKdsService | null;
  health: LanSpikeHealthPayload | null;
  lastError: string | null;
  lastEvent: string | null;
  retryAttempt: number;
}

type SnapshotListener = (snapshot: TotemLanSpikeSnapshot) => void;

type FailureDisposition = "transient" | "terminal_handshake_rejection";
type SocketCloseIntent =
  | "unexpected"
  | "transient_failure"
  | "terminal_handshake_rejection"
  | "client_requested";

const DEFAULT_HEALTH_TIMEOUT_MS = 3_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_RETRY_MAX_DELAY_MS = 5_000;

function nativeFetch(url: string, init?: { signal?: AbortSignal }) {
  return fetch(url, init);
}

function nativeWebSocketFactory(url: string): LanSpikeWebSocket {
  return new WebSocket(url) as unknown as LanSpikeWebSocket;
}

function isHealthPayload(value: unknown): value is LanSpikeHealthPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.protocol === LAN_SPIKE_PROTOCOL &&
    record.version === LAN_SPIKE_PROTOCOL_VERSION &&
    record.status === "ok"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isSameService(
  left: DiscoveredKdsService | null,
  right: DiscoveredKdsService,
): boolean {
  return Boolean(
    left &&
      left.name === right.name &&
      left.host === right.host &&
      left.port === right.port,
  );
}

async function fetchHealth(
  fetchImpl: LanSpikeFetch,
  url: string,
  timeoutMs: number,
): Promise<LanSpikeHealthPayload> {
  const controller =
    typeof AbortController === "undefined" ? null : new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const request = fetchImpl(url, { signal: controller?.signal });
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error("Timeout ao consultar health do KDS"));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([request, timeout]);
    if (!response.ok || response.status !== 200) {
      throw new Error(`Health do KDS respondeu HTTP ${response.status}`);
    }

    const body = await response.json();
    if (!isHealthPayload(body)) {
      throw new Error("Resposta health incompatível com o protocolo experimental");
    }

    return body;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export interface TotemLanSpikeClient {
  start(): void;
  stop(): void;
  sendDiagnostic(id?: string): boolean;
  subscribe(listener: SnapshotListener): () => void;
  getSnapshot(): TotemLanSpikeSnapshot;
}

export function createTotemLanSpikeClient(
  options: TotemLanSpikeClientOptions,
): TotemLanSpikeClient {
  const fetchImpl = options.fetchImpl ?? nativeFetch;
  const webSocketFactory = options.webSocketFactory ?? nativeWebSocketFactory;
  const healthTimeoutMs = options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  const retryBaseDelayMs =
    options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const retryMaxDelayMs =
    options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
  const listeners = new Set<SnapshotListener>();

  let active = false;
  let snapshot: TotemLanSpikeSnapshot = {
    state: "desconectado",
    service: null,
    health: null,
    lastError: null,
    lastEvent: null,
    retryAttempt: 0,
  };
  let discoveryCleanup: (() => void) | null = null;
  let socket: LanSpikeWebSocket | null = null;
  const socketCloseIntents = new WeakMap<
    LanSpikeWebSocket,
    SocketCloseIntent
  >();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let connectionGeneration = 0;
  let terminalHandshakeRejectedGeneration: number | null = null;
  let diagnosticSequence = 0;

  const notify = () => {
    const current = { ...snapshot };
    listeners.forEach(listener => listener(current));
  };

  const setState = (
    event: Parameters<typeof connectionStateReducer>[1],
  ) => {
    snapshot = {
      ...snapshot,
      state: connectionStateReducer(snapshot.state, event),
    };
    notify();
  };

  const clearRetry = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const cleanupDiscovery = () => {
    discoveryCleanup?.();
    discoveryCleanup = null;
  };

  const scheduleRetry = () => {
    if (!active || retryTimer !== null) {
      return;
    }

    const delay = getRetryDelayMs(
      snapshot.retryAttempt,
      retryBaseDelayMs,
      retryMaxDelayMs,
    );
    snapshot = { ...snapshot, retryAttempt: snapshot.retryAttempt + 1 };
    notify();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!active) {
        return;
      }

      setState({ type: "RETRY_REQUESTED" });
      beginDiscovery();
    }, delay);
  };

  const fail = (
    error: unknown,
    disposition: FailureDisposition = "transient",
  ) => {
    const message = errorMessage(error);
    snapshot = { ...snapshot, lastError: message };
    setState({ type: "ERROR", message });
    if (socket) {
      const currentSocket = socket;
      socket = null;
      socketCloseIntents.set(
        currentSocket,
        disposition === "terminal_handshake_rejection"
          ? "terminal_handshake_rejection"
          : "transient_failure",
      );
      currentSocket.close(1011, "diagnostic error");
    }
    if (disposition === "transient") {
      scheduleRetry();
    }
  };

  const sendDiagnosticMessage = (id?: string): boolean => {
    if (!socket || snapshot.state !== "conectado") {
      return false;
    }

    const diagnosticId = id ?? `totem-diagnostic-${++diagnosticSequence}`;
    socket.send(
      serializeMessage({ type: "diagnostic", id: diagnosticId }),
    );
    snapshot = { ...snapshot, lastEvent: `diagnostic_sent:${diagnosticId}` };
    notify();
    return true;
  };

  const attachSocket = (
    candidate: LanSpikeWebSocket,
    generation: number,
  ) => {
    candidate.onopen = () => {
      if (!active || generation !== connectionGeneration) {
        return;
      }

      candidate.send(
        serializeMessage(createHandshakeMessage(options.negocioId)),
      );
    };

    candidate.onmessage = event => {
      if (
        !active ||
        generation !== connectionGeneration ||
        terminalHandshakeRejectedGeneration === generation
      ) {
        return;
      }

      const message = parseServerMessage(event.data);
      if (!message) {
        fail(new Error("Mensagem inválida recebida do KDS"));
        return;
      }

      if (message.type === "handshake_ack") {
        snapshot = {
          ...snapshot,
          lastError: null,
          lastEvent: "handshake_ack",
          retryAttempt: 0,
        };
        setState({ type: "CONNECTED" });
        sendDiagnosticMessage();
        return;
      }

      if (message.type === "handshake_rejected") {
        terminalHandshakeRejectedGeneration = generation;
        fail(
          new Error(`Handshake rejeitado: ${message.code}`),
          "terminal_handshake_rejection",
        );
        return;
      }

      snapshot = {
        ...snapshot,
        lastError: null,
        lastEvent: `diagnostic_ack:${message.id}`,
      };
      notify();
    };

    candidate.onerror = event => {
      if (active && generation === connectionGeneration) {
        const closeIntent = socketCloseIntents.get(candidate) ?? "unexpected";
        switch (closeIntent) {
          case "terminal_handshake_rejection":
          case "client_requested":
            return;
          case "unexpected":
          case "transient_failure":
            fail(new Error(event.message ?? "Erro no WebSocket do KDS"));
            return;
        }
      }
    };

    candidate.onclose = () => {
      if (generation !== connectionGeneration) {
        return;
      }
      socket = null;
      if (active) {
        const closeIntent = socketCloseIntents.get(candidate) ?? "unexpected";
        switch (closeIntent) {
          case "terminal_handshake_rejection":
          case "client_requested":
            return;
          case "unexpected":
          case "transient_failure":
            setState({ type: "DISCONNECTED" });
            scheduleRetry();
            return;
        }
      }
    };
  };

  const connectToService = async (service: DiscoveredKdsService) => {
    const generation = ++connectionGeneration;
    setState({ type: "CONNECT_REQUESTED" });
    const endpoint = serviceEndpoint(service);

    try {
      const health = await fetchHealth(
        fetchImpl,
        `${endpoint.httpUrl}${LAN_SPIKE_HEALTH_PATH}`,
        healthTimeoutMs,
      );
      if (!active || generation !== connectionGeneration) {
        return;
      }

      snapshot = { ...snapshot, health, lastError: null };
      const nextSocket = webSocketFactory(endpoint.websocketUrl);
      socket = nextSocket;
      attachSocket(nextSocket, generation);
      notify();
    } catch (error) {
      if (active && generation === connectionGeneration) {
        fail(error);
      }
    }
  };

  function beginDiscovery() {
    if (!active) {
      return;
    }

    cleanupDiscovery();
    try {
      const backend = options.createDiscoveryBackend();
      discoveryCleanup = createDiscoverySession(
        backend,
        service => {
          if (
            !active ||
            terminalHandshakeRejectedGeneration !== null
          ) {
            return;
          }

          if (
            isSameService(snapshot.service, service) &&
            (snapshot.state === "servidor_encontrado" ||
              snapshot.state === "conectando" ||
              snapshot.state === "conectado")
          ) {
            return;
          }

          if (socket) {
            const currentSocket = socket;
            socket = null;
            socketCloseIntents.set(currentSocket, "client_requested");
            currentSocket.close(1000, "novo serviço descoberto");
          }
          snapshot = { ...snapshot, service, lastError: null };
          setState({ type: "SERVER_FOUND" });
          void connectToService(service);
        },
        error => {
          if (active && terminalHandshakeRejectedGeneration === null) {
            fail(error);
          }
        },
      );
    } catch (error) {
      fail(error);
    }
  }

  return {
    start() {
      if (active) {
        return;
      }
      active = true;
      clearRetry();
      terminalHandshakeRejectedGeneration = null;
      snapshot = {
        ...snapshot,
        service: null,
        health: null,
        lastError: null,
        lastEvent: null,
        retryAttempt: 0,
      };
      setState({ type: "SEARCH_STARTED" });
      beginDiscovery();
    },

    stop() {
      if (!active && discoveryCleanup === null && socket === null) {
        return;
      }
      active = false;
      connectionGeneration += 1;
      clearRetry();
      cleanupDiscovery();
      if (socket) {
        const currentSocket = socket;
        socket = null;
        socketCloseIntents.set(currentSocket, "client_requested");
        currentSocket.close(1000, "diagnostic stop");
      }
      setState({ type: "DISCONNECTED" });
    },

    sendDiagnostic(id) {
      return sendDiagnosticMessage(id);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return { ...snapshot };
    },
  };
}
