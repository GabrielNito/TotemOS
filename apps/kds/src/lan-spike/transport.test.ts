import {
  createDiagnosticWebSocketHandler,
  handleDiagnosticHttpRequest,
} from "./transport";

interface FakeSocket {
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onclose: (() => void) | null;
  send: jest.Mock;
  close: jest.Mock;
}

function createFakeSocket(): FakeSocket {
  return {
    onmessage: null,
    onclose: null,
    send: jest.fn(),
    close: jest.fn(),
  };
}

describe("transporte diagnóstico do KDS", () => {
  it("responde health somente no endpoint experimental", () => {
    expect(
      handleDiagnosticHttpRequest({ method: "GET", path: "/_spike/health" }),
    ).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protocol: "totemos-lan-spike",
        version: 1,
        status: "ok",
      }),
    });
    expect(handleDiagnosticHttpRequest({ method: "GET", path: "/pedidos" }).statusCode).toBe(
      404,
    );
  });

  it("confirma handshake e mensagem de diagnóstico do mesmo tenant", () => {
    const socket = createFakeSocket();
    const diagnostics: string[] = [];
    const detach = createDiagnosticWebSocketHandler(socket, "tenant-a", id => {
      diagnostics.push(id);
    });

    socket.onmessage?.({
      data: JSON.stringify({
        type: "handshake",
        protocolVersion: 1,
        negocioId: "tenant-a",
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({ type: "diagnostic", id: "diag-1" }),
    });

    expect(socket.send.mock.calls.map(([message]) => JSON.parse(message))).toEqual([
      { type: "handshake_ack", protocol: "totemos-lan-spike", version: 1 },
      { type: "diagnostic_ack", id: "diag-1", status: "ok" },
    ]);
    expect(diagnostics).toEqual(["diag-1"]);
    detach();
    expect(socket.onmessage).toBeNull();
  });

  it("rejeita tenant diferente e não processa diagnóstico depois", () => {
    const socket = createFakeSocket();
    const diagnostics: string[] = [];
    createDiagnosticWebSocketHandler(socket, "tenant-b", id => {
      diagnostics.push(id);
    });

    socket.onmessage?.({
      data: JSON.stringify({
        type: "handshake",
        protocolVersion: 1,
        negocioId: "tenant-a",
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({ type: "diagnostic", id: "não-deve-processar" }),
    });

    expect(socket.send.mock.calls.map(([message]) => JSON.parse(message))).toEqual([
      { type: "handshake_rejected", code: "TENANT_MISMATCH" },
    ]);
    expect(socket.close).toHaveBeenCalledWith(1008, "TENANT_MISMATCH");
    expect(diagnostics).toEqual([]);
  });
});
