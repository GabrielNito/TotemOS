import {
  LAN_SPIKE_PROTOCOL,
  LAN_SPIKE_PROTOCOL_VERSION,
  createHandshakeMessage,
  parseServerMessage,
} from "./protocol";

describe("protocolo LAN experimental do Totem", () => {
  it("cria handshake com apenas versão e tenant fictício", () => {
    expect(createHandshakeMessage("tenant-a")).toEqual({
      type: "handshake",
      protocolVersion: LAN_SPIKE_PROTOCOL_VERSION,
      negocioId: "tenant-a",
    });
  });

  it("parseia confirmação de handshake e diagnóstico", () => {
    expect(
      parseServerMessage(
        JSON.stringify({
          type: "handshake_ack",
          protocol: LAN_SPIKE_PROTOCOL,
          version: 1,
        }),
      ),
    ).toEqual({
      type: "handshake_ack",
      protocol: LAN_SPIKE_PROTOCOL,
      version: 1,
    });

    expect(
      parseServerMessage(
        JSON.stringify({ type: "diagnostic_ack", id: "diag-1", status: "ok" }),
      ),
    ).toEqual({ type: "diagnostic_ack", id: "diag-1", status: "ok" });
  });

  it("não aceita respostas inválidas como confirmação", () => {
    expect(parseServerMessage("não é json")).toBeNull();
    expect(
      parseServerMessage(JSON.stringify({ type: "handshake_ack", version: 2 })),
    ).toBeNull();
  });
});
