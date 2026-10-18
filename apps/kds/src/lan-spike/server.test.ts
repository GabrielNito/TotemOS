import { createKdsLanServer, type KdsHttpServer } from "./server";

describe("servidor local diagnóstico do KDS", () => {
  it("inicia em host local, configura WebSocket e publica a porta real", async () => {
    const websocketHandlers: ((socket: never) => void)[] = [];
    const httpServer = {
      onWebSocket: jest.fn((_, handler: (socket: never) => void) => {
        websocketHandlers.push(handler);
        return undefined;
      }),
      start: jest.fn(async () => 43211),
      stop: jest.fn(async () => undefined),
    };
    const typedHttpServer = httpServer as unknown as KdsHttpServer;
    const publisher = {
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
    };
    const server = createKdsLanServer({
      negocioId: "tenant-a",
      port: 43210,
      createHttpServer: () => typedHttpServer,
      publisher,
    });

    await expect(server.start()).resolves.toEqual({ port: 43211 });

    expect(httpServer.onWebSocket).toHaveBeenCalledWith(
      "/_spike/ws",
      expect.any(Function),
    );
    expect(httpServer.start).toHaveBeenCalledWith(
      43210,
      expect.any(Function),
      {
        mounts: [{ type: "websocket", path: "/_spike/ws" }],
        request_timeout_secs: 10,
        max_body_size: 65536,
      },
      { host: "0.0.0.0" },
    );
    expect(publisher.start).toHaveBeenCalledWith(43211);
    expect(websocketHandlers).toHaveLength(1);
  });

  it("para servidor e publicação de forma idempotente", async () => {
    const httpServer = {
      onWebSocket: jest.fn(() => undefined),
      start: jest.fn(async () => 43210),
      stop: jest.fn(async () => undefined),
    };
    const typedHttpServer = httpServer as unknown as KdsHttpServer;
    const publisher = {
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
    };
    const server = createKdsLanServer({
      negocioId: "tenant-a",
      createHttpServer: () => typedHttpServer,
      publisher,
    });

    await server.start();
    await server.stop();
    await server.stop();

    expect(httpServer.stop).toHaveBeenCalledTimes(1);
    expect(publisher.stop).toHaveBeenCalledTimes(1);
  });

  it("não publica se a porta não puder ser aberta", async () => {
    const httpServer = {
      onWebSocket: jest.fn(() => undefined),
      start: jest.fn(async () => 0),
      stop: jest.fn(async () => undefined),
    };
    const typedHttpServer = httpServer as unknown as KdsHttpServer;
    const publisher = {
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
    };
    const server = createKdsLanServer({
      negocioId: "tenant-a",
      createHttpServer: () => typedHttpServer,
      publisher,
    });

    await expect(server.start()).rejects.toThrow("porta");
    expect(publisher.start).not.toHaveBeenCalled();
  });
});
