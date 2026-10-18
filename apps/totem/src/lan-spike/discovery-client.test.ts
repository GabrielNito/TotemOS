import {
  createDiscoverySession,
  type DiscoveryBackend,
} from "./discovery-client";

describe("sessão de descoberta mDNS do Totem", () => {
  it("registra listeners antes de iniciar scan e entrega apenas KDS compatível", () => {
    const callbacks = new Map<string, (value: unknown) => void>();
    const backend: DiscoveryBackend = {
      subscribe: jest.fn((event, callback) => {
        callbacks.set(event, callback);
        return jest.fn();
      }),
      scan: jest.fn(),
      stop: jest.fn(),
      removeDeviceListeners: jest.fn(),
    };
    const onService = jest.fn();
    const session = createDiscoverySession(backend, onService);

    expect(backend.scan).toHaveBeenCalledWith({
      type: "totemos-kds",
      protocol: "tcp",
      domain: "local.",
      resolveTimeout: 3,
    });

    callbacks.get("resolved")?.({
      name: "Outro",
      host: "other.local.",
      port: 80,
      txt: { protocol: "outro", version: "1" },
    });
    expect(onService).not.toHaveBeenCalled();

    callbacks.get("resolved")?.({
      name: "TotemOS KDS Spike",
      host: "kds.local.",
      ipv4: ["192.168.0.20"],
      port: 43210,
      txt: { protocol: "totemos-lan-spike", version: "1" },
    });
    expect(onService).toHaveBeenCalledWith(
      expect.objectContaining({ name: "TotemOS KDS Spike" }),
    );

    session();
    session();
    expect(backend.stop).toHaveBeenCalledTimes(1);
    expect(backend.removeDeviceListeners).toHaveBeenCalledTimes(1);
  });

  it("limpa listeners quando o backend falha ao iniciar o scan", () => {
    const backend: DiscoveryBackend = {
      subscribe: jest.fn(() => jest.fn()),
      scan: jest.fn(() => {
        throw new Error("scan indisponível");
      }),
      stop: jest.fn(),
      removeDeviceListeners: jest.fn(),
    };

    expect(() => createDiscoverySession(backend, jest.fn())).toThrow(
      "scan indisponível",
    );
    expect(backend.stop).toHaveBeenCalledTimes(1);
    expect(backend.removeDeviceListeners).toHaveBeenCalledTimes(1);
  });
});
