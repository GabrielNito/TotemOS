import {
  LAN_SPIKE_WEBSOCKET_PATH,
} from "./protocol";
import {
  createDiagnosticWebSocketHandler,
  handleDiagnosticHttpRequest,
  type DiagnosticHttpResponse,
  type DiagnosticWebSocket,
} from "./transport";
import type { KdsServicePublisher } from "./publisher";

export const LAN_SPIKE_PORT = 43_210;

export interface KdsHttpServerConfig {
  mounts: [{ type: "websocket"; path: typeof LAN_SPIKE_WEBSOCKET_PATH }];
  request_timeout_secs: 10;
  max_body_size: 65_536;
}

export interface KdsHttpServer {
  onWebSocket(
    path: typeof LAN_SPIKE_WEBSOCKET_PATH,
    handler: (socket: DiagnosticWebSocket) => void,
  ): KdsHttpServer;
  start(
    port: number,
    handler: (request: { method: string; path: string }) => DiagnosticHttpResponse,
    config: KdsHttpServerConfig,
    options: { host: "0.0.0.0" },
  ): Promise<number>;
  stop(): Promise<void>;
}

export interface KdsLanServerDependencies {
  negocioId: string;
  port?: number;
  createHttpServer: () => KdsHttpServer;
  publisher: KdsServicePublisher;
}

export interface KdsLanServer {
  start(): Promise<{ port: number }>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export function createKdsLanServer(
  dependencies: KdsLanServerDependencies,
): KdsLanServer {
  let httpServer: KdsHttpServer | null = null;
  let actualPort = 0;
  let running = false;
  let startPromise: Promise<{ port: number }> | null = null;
  let publisherStopped = false;
  const websocketCleanups = new Set<() => void>();

  const startInternal = async (): Promise<{ port: number }> => {
    const server = dependencies.createHttpServer();
    httpServer = server;
    server.onWebSocket(LAN_SPIKE_WEBSOCKET_PATH, socket => {
      let cleanup: () => void = () => undefined;
      const onClosed = () => {
        cleanup();
        websocketCleanups.delete(cleanup);
      };
      cleanup = createDiagnosticWebSocketHandler(
        socket,
        dependencies.negocioId,
        () => undefined,
        onClosed,
      );
      websocketCleanups.add(cleanup);
    });

    const port = await server.start(
      dependencies.port ?? LAN_SPIKE_PORT,
      request => handleDiagnosticHttpRequest(request),
      {
        mounts: [{ type: "websocket", path: LAN_SPIKE_WEBSOCKET_PATH }],
        request_timeout_secs: 10,
        max_body_size: 65_536,
      },
      { host: "0.0.0.0" },
    );

    if (port <= 0) {
      await server.stop();
      httpServer = null;
      throw new Error("Não foi possível abrir a porta do servidor LAN");
    }

    try {
      await dependencies.publisher.start(port);
      publisherStopped = false;
    } catch (error) {
      await server.stop();
      httpServer = null;
      throw error;
    }

    actualPort = port;
    running = true;
    return { port };
  };

  return {
    start() {
      if (running) {
        return Promise.resolve({ port: actualPort });
      }
      if (!startPromise) {
        startPromise = startInternal().finally(() => {
          startPromise = null;
        });
      }
      return startPromise;
    },

    async stop() {
      if (startPromise) {
        await startPromise.catch(() => undefined);
      }

      websocketCleanups.forEach(cleanup => cleanup());
      websocketCleanups.clear();

      const server = httpServer;
      httpServer = null;
      running = false;
      actualPort = 0;

      try {
        if (server) {
          await server.stop();
        }
      } finally {
        if (!publisherStopped) {
          await dependencies.publisher.stop();
          publisherStopped = true;
        }
      }
    },

    isRunning() {
      return running;
    },
  };
}
