import {
  LAN_SPIKE_PROTOCOL,
  LAN_SPIKE_PROTOCOL_VERSION,
} from "./protocol";
import {
  createTotemLanSpikeClient,
  type LanSpikeFetch,
  type LanSpikeWebSocket,
} from "./client";
import type { DiscoveryBackend } from "./discovery-client";

function createService() {
  return {
    name: "TotemOS KDS Spike",
    host: "kds.local.",
    port: 43_210,
    ipv4: ["192.168.1.20"],
    txt: { protocol: LAN_SPIKE_PROTOCOL, version: "1" },
  };
}

class FakeWebSocket implements LanSpikeWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onerror: ((event: { message?: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.onopen?.();
  }

  message(data: object): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  closeFromServer(): void {
    this.closed = true;
    this.onclose?.();
  }
}

function createDiscoveryBackend() {
  const listeners = {
    resolved: new Set<(value: unknown) => void>(),
    error: new Set<(value: unknown) => void>(),
  };
  const backend: DiscoveryBackend = {
    subscribe(event, callback) {
      listeners[event].add(callback);
      return () => listeners[event].delete(callback);
    },
    scan: jest.fn(),
    stop: jest.fn(),
    removeDeviceListeners: jest.fn(),
  };

  return {
    backend,
    resolve(value: unknown) {
      listeners.resolved.forEach(listener => listener(value));
    },
  };
}

function createHealthFetch(): LanSpikeFetch {
  return jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      protocol: LAN_SPIKE_PROTOCOL,
      version: LAN_SPIKE_PROTOCOL_VERSION,
      status: "ok",
    }),
  }));
}

async function flushAsyncWork(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

describe("cliente LAN experimental do Totem", () => {
  it("descobre, valida HTTP, abre WebSocket e envia diagnóstico", async () => {
    const discovery = createDiscoveryBackend();
    const socket = new FakeWebSocket();
    const fetchImpl = createHealthFetch();
    const webSocketFactory = jest.fn(() => socket);
    const client = createTotemLanSpikeClient({
      negocioId: "tenant-a",
      createDiscoveryBackend: () => discovery.backend,
      fetchImpl,
      webSocketFactory,
    });

    client.start();
    discovery.resolve(createService());
    discovery.resolve(createService());
    await flushAsyncWork();

    expect(client.getSnapshot().state).toBe("conectando");
    expect(webSocketFactory).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://192.168.1.20:43210/_spike/health",
      expect.any(Object),
    );

    socket.open();
    expect(socket.sent[0]).toContain('"type":"handshake"');

    socket.message({
      type: "handshake_ack",
      protocol: LAN_SPIKE_PROTOCOL,
      version: LAN_SPIKE_PROTOCOL_VERSION,
    });

    expect(client.getSnapshot().state).toBe("conectado");
    expect(socket.sent[1]).toContain('"type":"diagnostic"');
    discovery.resolve(createService());
    await flushAsyncWork();
    expect(webSocketFactory).toHaveBeenCalledTimes(1);
    client.stop();
  });

  it("encerra o fluxo de aplicação quando o KDS rejeita o tenant", async () => {
    const discovery = createDiscoveryBackend();
    const socket = new FakeWebSocket();
    const client = createTotemLanSpikeClient({
      negocioId: "tenant-a",
      createDiscoveryBackend: () => discovery.backend,
      fetchImpl: createHealthFetch(),
      webSocketFactory: () => socket,
    });

    client.start();
    discovery.resolve(createService());
    await flushAsyncWork();
    socket.open();
    socket.message({
      type: "handshake_rejected",
      code: "TENANT_MISMATCH",
    });

    expect(client.getSnapshot().state).toBe("erro");
    expect(client.getSnapshot().lastError).toContain("TENANT_MISMATCH");
    expect(socket.sent).toHaveLength(1);
    expect(socket.closed).toBe(true);
    client.stop();
  });

  it("limpa descoberta, WebSocket e retry ao parar", async () => {
    jest.useFakeTimers();
    const discovery = createDiscoveryBackend();
    const socket = new FakeWebSocket();
    const client = createTotemLanSpikeClient({
      negocioId: "tenant-a",
      createDiscoveryBackend: () => discovery.backend,
      fetchImpl: createHealthFetch(),
      webSocketFactory: () => socket,
    });

    client.start();
    discovery.resolve(createService());
    await flushAsyncWork();
    socket.open();
    socket.closeFromServer();
    client.stop();
    jest.advanceTimersByTime(5_000);

    expect(discovery.backend.stop).toHaveBeenCalledTimes(1);
    expect(discovery.backend.removeDeviceListeners).toHaveBeenCalledTimes(1);
    expect(socket.closed).toBe(true);
    jest.useRealTimers();
  });

  it("redescobre depois da queda do WebSocket", async () => {
    jest.useFakeTimers();
    const firstDiscovery = createDiscoveryBackend();
    const secondDiscovery = createDiscoveryBackend();
    const socket = new FakeWebSocket();
    let discoveryCalls = 0;
    const client = createTotemLanSpikeClient({
      negocioId: "tenant-a",
      createDiscoveryBackend: () => {
        discoveryCalls += 1;
        return discoveryCalls === 1
          ? firstDiscovery.backend
          : secondDiscovery.backend;
      },
      fetchImpl: createHealthFetch(),
      webSocketFactory: () => socket,
    });

    client.start();
    firstDiscovery.resolve(createService());
    await flushAsyncWork();
    socket.open();
    socket.closeFromServer();

    expect(client.getSnapshot().state).toBe("desconectado");
    jest.advanceTimersByTime(500);

    expect(client.getSnapshot().state).toBe("procurando_servidor");
    expect(discoveryCalls).toBe(2);
    expect(secondDiscovery.backend.scan).toHaveBeenCalledTimes(1);
    client.stop();
    jest.useRealTimers();
  });

  it("transforma timeout HTTP em erro controlado", async () => {
    jest.useFakeTimers();
    const discovery = createDiscoveryBackend();
    const client = createTotemLanSpikeClient({
      negocioId: "tenant-a",
      createDiscoveryBackend: () => discovery.backend,
      fetchImpl: jest.fn(() => new Promise<never>(() => undefined)),
      healthTimeoutMs: 10,
    });

    client.start();
    discovery.resolve(createService());
    await flushAsyncWork();
    jest.advanceTimersByTime(10);
    await flushAsyncWork();

    expect(client.getSnapshot().state).toBe("erro");
    expect(client.getSnapshot().lastError).toContain("Timeout");
    client.stop();
    jest.useRealTimers();
  });
});
