import {
  pairDevice,
  restoreDeviceSession,
  type DeviceTokenStorage,
  type DeviceSessionCache,
  type PairingApi,
} from "./session";
import type { DeviceIdentity } from "./types";

const device: DeviceIdentity = {
  id: "device-1",
  negocioId: "negocio-1",
  nome: "Totem entrada",
  tipo: "TOTEM",
  pareadoEm: "2026-10-28T12:00:00.000Z",
  ativo: true,
  revogadoEm: null,
  createdAt: "2026-10-28T12:00:00.000Z",
};

function createStorage(token: string | null): DeviceTokenStorage {
  return {
    delete: jest.fn(async () => undefined),
    get: jest.fn(async () => token),
    set: jest.fn(async () => undefined),
  };
}

function createCache(value: string | null = null): DeviceSessionCache {
  return {
    delete: jest.fn(async () => undefined),
    get: jest.fn(async () => value),
    set: jest.fn(async () => undefined),
  };
}

function createApi(): PairingApi {
  return {
    activate: jest.fn(async () => ({
      deviceToken: "token-sensivel",
      dispositivo: device,
    })),
    me: jest.fn(async () => ({ dispositivo: device })),
  };
}

describe("device session state", () => {
  it("retoma a verificação depois de consumir o código, sem ativar de novo", async () => {
    const api = createApi();
    let token: string | null = null;
    const storage = createStorage(null);
    jest.spyOn(storage, "get").mockImplementation(async () => token);
    jest.spyOn(storage, "set").mockImplementation(async (value) => {
      token = value;
    });
    jest.spyOn(api, "me").mockRejectedValueOnce({ statusCode: 503 });

    const dependencies = { api, expectedDeviceType: "TOTEM" as const, storage };
    await expect(pairDevice("012345", dependencies)).resolves.toMatchObject({
      kind: "error",
    });
    await expect(pairDevice("012345", dependencies)).resolves.toMatchObject({
      kind: "authenticated",
      dispositivo: device,
    });
    expect(api.activate).toHaveBeenCalledTimes(1);
    expect(api.me).toHaveBeenCalledTimes(2);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("não consome código enquanto a sessão persistida está indisponível", async () => {
    const api = createApi();
    const storage = createStorage("token-preservado");
    jest.spyOn(api, "me").mockRejectedValue({ statusCode: 503 });

    await expect(
      pairDevice("012345", { api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toMatchObject({ kind: "error" });
    expect(api.activate).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("restaura a identidade visual do mesmo negócio autenticado", async () => {
    const api = createApi();
    const negocio = {
      id: device.negocioId,
      nome: "Cafeteria da Praça",
      modoIdentificacao: "NOME" as const,
      mensagemBoasVindas: "Escolha seu café.",
      pagamentoPointConfigurado: false,
    };
    jest.spyOn(api, "me").mockResolvedValue({ dispositivo: device, negocio });
    const result = await restoreDeviceSession({
      api,
      expectedDeviceType: "TOTEM",
      storage: createStorage("token-de-teste"),
    });
    expect(result).toMatchObject({ kind: "authenticated", negocio });
  });

  it("recusa metadados de outro negócio sem apagar a credencial válida", async () => {
    const api = createApi();
    const storage = createStorage("token-de-teste");
    jest.spyOn(api, "me").mockResolvedValue({
      dispositivo: device,
      negocio: {
        id: "other-tenant",
        nome: "Outro",
        modoIdentificacao: "OPCIONAL",
        mensagemBoasVindas: null,
        pagamentoPointConfigurado: false,
      },
    });
    const result = await restoreDeviceSession({
      api,
      expectedDeviceType: "TOTEM",
      storage,
    });
    expect(result.kind).toBe("error");
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it("fica aguardando pareamento quando não existe token", async () => {
    const api = createApi();
    const storage = createStorage(null);

    await expect(
      restoreDeviceSession({ api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      kind: "pairing",
      reason: "missing-token",
    });
    expect(api.me).not.toHaveBeenCalled();
  });

  it("restaura uma sessão válida e confirma o tipo retornado pelo backend", async () => {
    const api = createApi();
    const storage = createStorage("token-sensivel");

    await expect(
      restoreDeviceSession({ api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      deviceToken: "token-sensivel",
      dispositivo: device,
      kind: "authenticated",
    });
    expect(api.me).toHaveBeenCalledWith("token-sensivel");
  });

  it("remove token revogado e volta ao pareamento", async () => {
    const api = createApi();
    const storage = createStorage("token-revogado");
    (api.me as jest.Mock).mockRejectedValue({ statusCode: 401 });

    await expect(
      restoreDeviceSession({ api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      kind: "pairing",
      reason: "invalid-token",
    });
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it("mantém o token quando a restauração falha por rede", async () => {
    const api = createApi();
    const storage = createStorage("token-preservado");
    (api.me as jest.Mock).mockRejectedValue(new Error("network"));

    await expect(
      restoreDeviceSession({ api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      kind: "error",
      message: "Não foi possível verificar a sessão. Tente novamente.",
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("restaura a identidade salva quando a validação online falha por rede", async () => {
    const api = createApi();
    const storage = createStorage("token-preservado");
    const cache = createCache(
      JSON.stringify({
        dispositivo: device,
        negocio: {
          id: device.negocioId,
          nome: "Cafeteria da Praça",
          modoIdentificacao: "NOME",
          mensagemBoasVindas: null,
          pagamentoPointConfigurado: false,
        },
      }),
    );
    (api.me as jest.Mock).mockRejectedValue(new Error("network"));

    await expect(
      restoreDeviceSession({
        api,
        cache,
        expectedDeviceType: "TOTEM",
        storage,
      }),
    ).resolves.toMatchObject({
      cached: true,
      deviceToken: "token-preservado",
      dispositivo: device,
      kind: "authenticated",
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("apaga identidade salva quando o backend revoga o token", async () => {
    const api = createApi();
    const storage = createStorage("token-revogado");
    const cache = createCache(JSON.stringify({ dispositivo: device }));
    (api.me as jest.Mock).mockRejectedValue({ statusCode: 401 });

    await restoreDeviceSession({
      api,
      cache,
      expectedDeviceType: "TOTEM",
      storage,
    });
    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it("rejeita código que não tenha seis dígitos sem chamar a API", async () => {
    const api = createApi();
    const storage = createStorage(null);

    await expect(
      pairDevice("123", { api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      kind: "error",
      message: "Digite um código de 6 dígitos.",
    });
    expect(api.activate).not.toHaveBeenCalled();
  });

  it("persiste o token e confirma a sessão após um código válido", async () => {
    const api = createApi();
    const storage = createStorage(null);

    await expect(
      pairDevice("012345", { api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      deviceToken: "token-sensivel",
      dispositivo: device,
      kind: "authenticated",
    });
    expect(storage.set).toHaveBeenCalledWith("token-sensivel");
    expect(api.me).toHaveBeenCalledWith("token-sensivel");
  });

  it("mostra código expirado ou usado sem enumerar o motivo", async () => {
    const api = createApi();
    const storage = createStorage(null);
    (api.activate as jest.Mock).mockRejectedValue({ statusCode: 401 });

    await expect(
      pairDevice("012345", { api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      kind: "expired-or-used",
      message: "Código inválido, expirado ou já utilizado.",
    });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it("não mantém no app um token emitido para o outro tipo de dispositivo", async () => {
    const api = createApi();
    const storage = createStorage(null);
    (api.me as jest.Mock).mockResolvedValue({
      dispositivo: { ...device, tipo: "PAINEL" },
    });

    await expect(
      pairDevice("012345", { api, expectedDeviceType: "TOTEM", storage }),
    ).resolves.toEqual({
      kind: "error",
      message: "Este código foi gerado para outro tipo de dispositivo.",
    });
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });
});
