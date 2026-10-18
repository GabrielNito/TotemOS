import {
  createDiscoveryOptions,
  isDiscoveredKdsService,
  selectKdsService,
  type DiscoveredKdsService,
} from "./discovery";

export type DiscoveryEvent = "resolved" | "error";

export interface DiscoveryBackend {
  subscribe(event: DiscoveryEvent, callback: (value: unknown) => void): () => void;
  scan(options: ReturnType<typeof createDiscoveryOptions>): void;
  stop(): void;
  removeDeviceListeners(): void;
}

export function createDiscoverySession(
  backend: DiscoveryBackend,
  onService: (service: DiscoveredKdsService) => void,
  onError?: (error: unknown) => void,
): () => void {
  let stopped = false;
  const unsubscribeResolved = backend.subscribe("resolved", value => {
    if (stopped || !isDiscoveredKdsService(value)) {
      return;
    }

    const service = selectKdsService([value]);
    if (service) {
      onService(service);
    }
  });
  const unsubscribeError = backend.subscribe("error", error => {
    if (!stopped) {
      onError?.(error);
    }
  });

  const cleanup = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    unsubscribeResolved();
    unsubscribeError();
    backend.stop();
    backend.removeDeviceListeners();
  };

  try {
    backend.scan(createDiscoveryOptions());
  } catch (error) {
    cleanup();
    throw error;
  }

  return cleanup;
}
