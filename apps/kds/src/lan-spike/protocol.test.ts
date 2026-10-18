import {
  LAN_SPIKE_PROTOCOL,
  LAN_SPIKE_PROTOCOL_VERSION,
  createHealthPayload,
  evaluateHandshake,
  parseClientMessage,
} from "./protocol";

describe("protocolo LAN experimental do KDS", () => {
  it("expõe uma resposta de health estável e sem dados do negócio", () => {
    expect(createHealthPayload()).toEqual({
      protocol: LAN_SPIKE_PROTOCOL,
      version: LAN_SPIKE_PROTOCOL_VERSION,
      status: "ok",
    });
  });

  it("aceita o handshake do mesmo tenant fictício", () => {
    expect(
      evaluateHandshake(
        JSON.stringify({
          type: "handshake",
          protocolVersion: 1,
          negocioId: "tenant-a",
        }),
        "tenant-a",
      ),
    ).toEqual({
      accepted: true,
      handshake: {
        type: "handshake",
        protocolVersion: 1,
        negocioId: "tenant-a",
      },
    });
  });

  it("rejeita handshake de tenant diferente antes de mensagens de aplicação", () => {
    expect(
      evaluateHandshake(
        {
          type: "handshake",
          protocolVersion: 1,
          negocioId: "tenant-a",
        },
        "tenant-b",
      ),
    ).toEqual({ accepted: false, code: "TENANT_MISMATCH" });
  });

  it("rejeita versão de protocolo desconhecida", () => {
    expect(
      evaluateHandshake(
        {
          type: "handshake",
          protocolVersion: 2,
          negocioId: "tenant-a",
        },
        "tenant-a",
      ),
    ).toEqual({ accepted: false, code: "UNSUPPORTED_PROTOCOL" });
  });

  it("identifica JSON inválido e mensagens incompletas", () => {
    expect(parseClientMessage("não é json")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "handshake" }))).toBeNull();
    expect(evaluateHandshake("não é json", "tenant-a")).toEqual({
      accepted: false,
      code: "INVALID_MESSAGE",
    });
  });
});
