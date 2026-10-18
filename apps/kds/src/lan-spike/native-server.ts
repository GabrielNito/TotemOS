import {
  ConfigServer,
  type ServerConfig,
} from "react-native-nitro-http-server";

import { createNativeKdsServicePublisher } from "./native-publisher";
import {
  LAN_SPIKE_PORT,
  createKdsLanServer,
  type KdsHttpServer,
  type KdsLanServer,
} from "./server";
import type { DiagnosticWebSocket } from "./transport";

export function createNativeKdsLanServer(
  negocioId: string,
  port = LAN_SPIKE_PORT,
): KdsLanServer {
  const nativeServer = new ConfigServer();
  const adapter: KdsHttpServer = {
    onWebSocket(_path, handler) {
      nativeServer.onWebSocket(_path, socket => {
        handler(socket as unknown as DiagnosticWebSocket);
      });
      return adapter;
    },
    start(startPort, handler, config, options) {
      return nativeServer.start(
        startPort,
        request => handler(request),
        config as ServerConfig,
        options,
      );
    },
    stop() {
      return nativeServer.stop();
    },
  };

  return createKdsLanServer({
    negocioId,
    port,
    createHttpServer: () => adapter,
    publisher: createNativeKdsServicePublisher(),
  });
}
