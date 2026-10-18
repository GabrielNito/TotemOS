import {
  LAN_SPIKE_PROTOCOL,
  LAN_SPIKE_PROTOCOL_VERSION,
  LAN_SPIKE_WEBSOCKET_PATH,
} from "./protocol";

export { LAN_SPIKE_PROTOCOL, LAN_SPIKE_PROTOCOL_VERSION } from "./protocol";

export const LAN_SPIKE_SERVICE_TYPE = "totemos-kds" as const;
export const LAN_SPIKE_SERVICE_PROTOCOL = "tcp" as const;
export const LAN_SPIKE_SERVICE_DOMAIN = "local." as const;

export interface DiscoveredKdsService {
  name: string;
  host: string;
  port: number;
  txt?: Record<string, string>;
  ipv4?: string[];
  addresses?: string[];
}

export function isDiscoveredKdsService(
  value: unknown,
): value is DiscoveredKdsService {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.name !== "string" ||
    typeof record.host !== "string" ||
    typeof record.port !== "number"
  ) {
    return false;
  }

  if (record.txt !== undefined) {
    if (
      typeof record.txt !== "object" ||
      record.txt === null ||
      Array.isArray(record.txt) ||
      Object.values(record.txt).some(value => typeof value !== "string")
    ) {
      return false;
    }
  }

  return true;
}

export function createDiscoveryOptions() {
  return {
    type: LAN_SPIKE_SERVICE_TYPE,
    protocol: LAN_SPIKE_SERVICE_PROTOCOL,
    domain: LAN_SPIKE_SERVICE_DOMAIN,
    resolveTimeout: 3,
  } as const;
}

function resolvedHost(service: DiscoveredKdsService): string | null {
  const candidate =
    service.ipv4?.find(Boolean) ??
    service.addresses?.find(address => address.includes(".")) ??
    service.host;

  if (!candidate || candidate.trim().length === 0) {
    return null;
  }

  return candidate.replace(/\.$/, "");
}

function isCompatible(service: DiscoveredKdsService): boolean {
  return (
    service.txt?.protocol === LAN_SPIKE_PROTOCOL &&
    service.txt.version === String(LAN_SPIKE_PROTOCOL_VERSION) &&
    Number.isInteger(service.port) &&
    service.port > 0 &&
    resolvedHost(service) !== null
  );
}

export function selectKdsService(
  services: DiscoveredKdsService[],
): DiscoveredKdsService | null {
  return services.find(isCompatible) ?? null;
}

export function serviceEndpoint(service: DiscoveredKdsService) {
  const host = resolvedHost(service);
  if (!host) {
    throw new Error("Serviço KDS sem endereço resolvido");
  }

  const formattedHost = host.includes(":") ? `[${host}]` : host;
  const base = `http://${formattedHost}:${service.port}`;
  return {
    httpUrl: base,
    websocketUrl: `ws://${formattedHost}:${service.port}${LAN_SPIKE_WEBSOCKET_PATH}`,
  };
}
