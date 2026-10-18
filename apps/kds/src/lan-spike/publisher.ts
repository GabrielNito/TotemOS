export const LAN_SPIKE_SERVICE_TYPE = "totemos-kds" as const;
export const LAN_SPIKE_SERVICE_PROTOCOL = "tcp" as const;
export const LAN_SPIKE_SERVICE_DOMAIN = "local." as const;
export const LAN_SPIKE_SERVICE_NAME = "TotemOS KDS Spike" as const;

export interface KdsServicePublishOptions {
  type: typeof LAN_SPIKE_SERVICE_TYPE;
  protocol: typeof LAN_SPIKE_SERVICE_PROTOCOL;
  domain: typeof LAN_SPIKE_SERVICE_DOMAIN;
  name: typeof LAN_SPIKE_SERVICE_NAME;
  port: number;
  txt: { protocol: "totemos-lan-spike"; version: "1" };
}

export interface KdsServicePublisherBackend {
  publishService(options: KdsServicePublishOptions): Promise<unknown>;
  unpublishService(name: string): Promise<unknown>;
  removeDeviceListeners(): void;
}

export interface KdsServicePublisher {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
}

export function createKdsServicePublisher(
  backend: KdsServicePublisherBackend,
): KdsServicePublisher {
  let published = false;
  let stopped = false;
  let publishedName: string = LAN_SPIKE_SERVICE_NAME;

  return {
    async start(port) {
      if (stopped) {
        throw new Error("Publicador mDNS já foi encerrado");
      }
      if (published) {
        return;
      }

      const result = await backend.publishService({
        type: LAN_SPIKE_SERVICE_TYPE,
        protocol: LAN_SPIKE_SERVICE_PROTOCOL,
        domain: LAN_SPIKE_SERVICE_DOMAIN,
        name: LAN_SPIKE_SERVICE_NAME,
        port,
        txt: { protocol: "totemos-lan-spike", version: "1" },
      });
      if (
        typeof result === "object" &&
        result !== null &&
        "name" in result &&
        typeof result.name === "string" &&
        result.name.length > 0
      ) {
        publishedName = result.name;
      }
      published = true;
    },

    async stop() {
      if (stopped) {
        return;
      }
      stopped = true;

      try {
        if (published) {
          await backend.unpublishService(publishedName);
          published = false;
        }
      } finally {
        backend.removeDeviceListeners();
      }
    },
  };
}
