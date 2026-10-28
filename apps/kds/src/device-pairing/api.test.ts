import { activateDevice, getCurrentDevice, PairingApiError } from "./api";

const fetchMock = jest.fn();

function createResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn(async () => body),
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
  } as unknown as Response;
}

describe("device pairing API", () => {
  const originalFetch = globalThis.fetch;
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = "http://api.test/";
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it("ativa o dispositivo sem enviar negocioId ou tipo do cliente", async () => {
    const response = {
      deviceToken: "token-sensivel",
      dispositivo: { tipo: "PAINEL", negocioId: "negocio-1" },
    };
    fetchMock.mockResolvedValue(createResponse(response, 201));

    await expect(activateDevice("012345")).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/dispositivos/parear/ativar",
      expect.objectContaining({
        body: JSON.stringify({ codigo: "012345" }),
        method: "POST",
      }),
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.headers).not.toHaveProperty("Authorization");
    expect(request.body).not.toContain("negocioId");
    expect(request.body).not.toContain("tipo");
  });

  it("consulta a identidade com o deviceToken em Authorization", async () => {
    const response = { dispositivo: { tipo: "PAINEL", negocioId: "negocio-1" } };
    fetchMock.mockResolvedValue(createResponse(response));

    await expect(getCurrentDevice("token-sensivel")).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/dispositivos/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-sensivel",
        }),
        method: "GET",
      }),
    );
  });

  it("preserva o código de erro do backend sem registrar o token", async () => {
    fetchMock.mockResolvedValue(
      createResponse(
        {
          code: "PAIRING_CODE_UNAVAILABLE",
          message: "Código inválido, expirado ou já utilizado.",
        },
        401,
      ),
    );

    await expect(activateDevice("012345")).rejects.toEqual(
      expect.objectContaining({
        code: "PAIRING_CODE_UNAVAILABLE",
        statusCode: 401,
      }),
    );
    await expect(activateDevice("012345")).rejects.toBeInstanceOf(
      PairingApiError,
    );
  });
});
