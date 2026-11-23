import Zeroconf from "react-native-zeroconf";
import { deliverOfflineOrder, type OfflineLanSocket } from "./client";
import { createLanProof } from "./proof";
import type { OrderRequest } from "../catalogo/order-submission";

type Service = {
  host?: unknown;
  port?: unknown;
  ipv4?: unknown;
  addresses?: unknown;
  txt?: unknown;
};

function endpoint(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const service = value as Service;
  const txt = service.txt as Record<string, unknown> | undefined;
  if (
    txt?.protocol !== "totemos-offline" ||
    txt.version !== "2" ||
    !Number.isInteger(service.port)
  )
    return null;
  const ipv4 = Array.isArray(service.ipv4)
    ? service.ipv4.find((item) => typeof item === "string")
    : undefined;
  const address = Array.isArray(service.addresses)
    ? service.addresses.find(
        (item) => typeof item === "string" && item.includes("."),
      )
    : undefined;
  const host =
    ipv4 ?? address ?? (typeof service.host === "string" ? service.host : "");
  if (!host) return null;
  return `ws://${host.replace(/\.$/, "")}:${service.port}/v1/offline-orders`;
}

export function discoverOfflineKds(timeoutMs = 6000): Promise<string> {
  return new Promise((resolve, reject) => {
    const zeroconf = new Zeroconf();
    let settled = false;
    const cleanup = () => {
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
    };
    const finish = (value?: string, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup();
      if (value) resolve(value);
      else reject(error ?? new Error("KDS não encontrado na rede local."));
    };
    zeroconf.subscribe("resolved", (value) => {
      const url = endpoint(value);
      if (url) finish(url);
    });
    zeroconf.subscribe("error", () =>
      finish(undefined, new Error("Falha ao procurar o KDS na rede local.")),
    );
    const timeout = setTimeout(() => finish(), timeoutMs);
    zeroconf.scan({
      type: "totemos-kds-offline",
      protocol: "tcp",
      domain: "local.",
      resolveTimeout: 3,
    });
  });
}

export function sendOrderToOfflineKds(options: {
  negocioId: string;
  dispositivoId: string;
  credential: string;
  idempotencyKey: string;
  pedido: OrderRequest;
  valorEstimado: number;
}) {
  return deliverOfflineOrder({
    ...options,
    discover: discoverOfflineKds,
    socket: (url) => new WebSocket(url) as unknown as OfflineLanSocket,
    proof: createLanProof,
    now: Date.now,
  });
}
