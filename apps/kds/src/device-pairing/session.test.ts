import {
  pairDevice,
  restoreDeviceSession,
  type DeviceTokenStorage,
  type PairingApi,
} from "./session";
import type { DeviceIdentity } from "./types";

const device: DeviceIdentity = {
  id: "device-1",
  negocioId: "negocio-1",
  nome: "Painel cozinha",
  tipo: "PAINEL",
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
  it("fica aguardando pareamento quando não existe token", async () => {
    const api = createApi();
    const storage = createStorage(null);

    await expect(
      restoreDeviceSession({ api, expectedDeviceType: "PAINEL", storage }),
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
      restoreDeviceSession({ api, expectedDeviceType: "PAINEL", storage }),
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
      restoreDeviceSession({ api, expectedDeviceType: "PAINEL", storage }),
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
      restoreDeviceSession({ api, expectedDeviceType: "PAINEL", storage }),
    ).resolves.toEqual({
      kind: "error",
      message: "Não foi possível verificar a sessão. Tente novamente.",
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("rejeita código que não tenha seis dígitos sem chamar a API", async () => {
    const api = createApi();
    const storage = createStorage(null);

    await expect(
      pairDevice("123", { api, expectedDeviceType: "PAINEL", storage }),
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
      pairDevice("012345", { api, expectedDeviceType: "PAINEL", storage }),
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
      pairDevice("012345", { api, expectedDeviceType: "PAINEL", storage }),
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
      dispositivo: { ...device, tipo: "TOTEM" },
    });

    await expect(
      pairDevice("012345", { api, expectedDeviceType: "PAINEL", storage }),
    ).resolves.toEqual({
      kind: "error",
      message: "Este código foi gerado para outro tipo de dispositivo.",
    });
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });
});
