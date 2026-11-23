import {
  ConfigServer,
  type ServerConfig,
} from "react-native-nitro-http-server";
import Zeroconf from "react-native-zeroconf";
import { randomUUID } from "expo-crypto";
import type { OfflineInboxController } from "../offline-inbox/controller";
import { createLanProof } from "./proof";
import { createOfflineLanSession } from "./session";

export const OFFLINE_LAN_PORT = 43_211;
export const OFFLINE_LAN_WS_PATH = "/v1/offline-orders";

type NativeSocket = {
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onclose: (() => void) | null;
  send(data: string): unknown;
  close(code?: number, reason?: string): unknown;
};

export function createOfflineLanServer(options: {
  negocioId: string;
  credential: string;
  inbox: OfflineInboxController;
  onInboxChanged?: () => void;
}) {
  let server: ConfigServer | null = null;
  let zeroconf: Zeroconf | null = null;
  let running = false;

  return {
    async start() {
      if (running) return;
      const nextServer = new ConfigServer();
      const nextZeroconf = new Zeroconf();
      nextServer.onWebSocket(OFFLINE_LAN_WS_PATH, (native) => {
        const socket = native as unknown as NativeSocket;
        const session = createOfflineLanSession({
          negocioId: options.negocioId,
          credential: options.credential,
          nonce: randomUUID,
          proof: createLanProof,
          receive: async (envelope) => {
            const result = await options.inbox.receive(envelope);
            options.onInboxChanged?.();
            return result;
          },
          send: (value) => socket.send(value),
          close: (code, reason) => socket.close(code, reason),
        });
        socket.onmessage = (event) => {
          if (typeof event.data !== "string") {
            socket.close(1003, "TEXT_REQUIRED");
            return;
          }
          void session.message(event.data).catch(() => {
            socket.close(1011, "PERSISTENCE_FAILURE");
          });
        };
      });
      await nextServer.start(
        OFFLINE_LAN_PORT,
        (request) =>
          request.method === "GET" && request.path === "/v1/health"
            ? {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  protocol: "totemos-offline",
                  version: 2,
                }),
              }
            : { statusCode: 404, body: "Not found" },
        {
          mounts: [{ type: "websocket", path: OFFLINE_LAN_WS_PATH }],
          request_timeout_secs: 10,
          max_body_size: 65_536,
        } as ServerConfig,
        { host: "0.0.0.0" },
      );
      try {
        await nextZeroconf.publishService({
          type: "totemos-kds-offline",
          protocol: "tcp",
          domain: "local.",
          name: "TotemOS KDS",
          port: OFFLINE_LAN_PORT,
          txt: { protocol: "totemos-offline", version: "2" },
        });
      } catch (error) {
        await nextServer.stop();
        nextZeroconf.removeDeviceListeners();
        throw error;
      }
      server = nextServer;
      zeroconf = nextZeroconf;
      running = true;
    },
    async stop() {
      const activeServer = server;
      const activeZeroconf = zeroconf;
      server = null;
      zeroconf = null;
      running = false;
      try {
        if (activeServer) await activeServer.stop();
      } finally {
        if (activeZeroconf) {
          await activeZeroconf
            .unpublishService("TotemOS KDS")
            .catch(() => undefined);
          activeZeroconf.removeDeviceListeners();
        }
      }
    },
    isRunning: () => running,
  };
}
