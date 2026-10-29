import { getCatalogoPublico } from "./api";

describe("API pública do catálogo", () => {
  const fetchOriginal = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  test("consulta somente o catálogo do negocioId da sessão", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "categoria-1",
          nome: "Lanches",
          produtos: [
            {
              id: "produto-1",
              nome: "X-Burguer",
              precoBase: "25.90",
              adicionais: [],
              variacoes: [],
            },
          ],
        },
      ],
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const catalogo = await getCatalogoPublico("negocio-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/catalogo/publico/negocio-123",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
      }),
    );
    expect(catalogo[0]?.produtos[0]?.precoBase).toBe(25.9);
  });

  test("expõe uma falha HTTP para a tela mostrar retry", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: "Serviço indisponível" }),
    }) as unknown as typeof fetch;

    await expect(getCatalogoPublico("negocio-123")).rejects.toEqual(
      expect.objectContaining({
        statusCode: 503,
        message: "Serviço indisponível",
      }),
    );
  });
});
