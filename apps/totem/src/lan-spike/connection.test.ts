import {
  connectionStateReducer,
  getRetryDelayMs,
  type ConnectionState,
} from "./connection";

describe("estado da conexão LAN do Totem", () => {
  it("percorre descoberta, conexão e encerramento", () => {
    let state: ConnectionState = "procurando_servidor";

    state = connectionStateReducer(state, { type: "SERVER_FOUND" });
    expect(state).toBe("servidor_encontrado");

    state = connectionStateReducer(state, { type: "CONNECT_REQUESTED" });
    expect(state).toBe("conectando");

    state = connectionStateReducer(state, { type: "CONNECTED" });
    expect(state).toBe("conectado");

    state = connectionStateReducer(state, { type: "DISCONNECTED" });
    expect(state).toBe("desconectado");
  });

  it("volta a procurar depois de erro ou retry", () => {
    expect(
      connectionStateReducer("conectando", {
        type: "ERROR",
        message: "timeout",
      }),
    ).toBe("erro");
    expect(
      connectionStateReducer("erro", { type: "RETRY_REQUESTED" }),
    ).toBe("procurando_servidor");
  });

  it("aplica retry progressivo limitado", () => {
    expect(getRetryDelayMs(0)).toBe(500);
    expect(getRetryDelayMs(1)).toBe(1000);
    expect(getRetryDelayMs(10)).toBe(5000);
  });
});
