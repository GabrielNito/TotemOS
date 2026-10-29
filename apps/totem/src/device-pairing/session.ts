import { activateDevice, getCurrentDevice, PairingApiError } from "./api";
import {
  deleteDeviceToken,
  getDeviceToken,
  setDeviceToken,
} from "../storage/device-token";
import type {
  DeviceActivationResponse,
  DeviceIdentity,
  DeviceMeResponse,
  DeviceType,
  NegocioIdentity,
} from "./types";

export interface PairingApi {
  activate(codigo: string): Promise<DeviceActivationResponse>;
  me(deviceToken: string): Promise<DeviceMeResponse>;
}

export interface DeviceTokenStorage {
  delete(): Promise<void>;
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
}

export interface SessionDependencies {
  api?: PairingApi;
  expectedDeviceType?: DeviceType;
  storage?: DeviceTokenStorage;
}

export type AuthenticatedSessionResult = {
  deviceToken: string;
  dispositivo: DeviceIdentity;
  kind: "authenticated";
  negocio?: NegocioIdentity;
};

export type RestoreDeviceSessionResult =
  | AuthenticatedSessionResult
  | { kind: "pairing"; reason: "invalid-token" | "missing-token" }
  | { kind: "error"; message: string };

export type PairDeviceResult =
  | AuthenticatedSessionResult
  | { kind: "error"; message: string }
  | { kind: "expired-or-used"; message: string };

const INVALID_PAIRING_CODE_MESSAGE =
  "Código inválido, expirado ou já utilizado.";
const INVALID_DEVICE_TYPE_MESSAGE =
  "Este código foi gerado para outro tipo de dispositivo.";
const INVALID_INPUT_MESSAGE = "Digite um código de 6 dígitos.";
const SESSION_ERROR_MESSAGE =
  "Não foi possível verificar a sessão. Tente novamente.";
const UNKNOWN_ERROR_MESSAGE =
  "Não foi possível concluir o pareamento. Verifique a rede e tente novamente.";

const defaultApi: PairingApi = {
  activate: activateDevice,
  me: getCurrentDevice,
};

const defaultStorage: DeviceTokenStorage = {
  delete: deleteDeviceToken,
  get: getDeviceToken,
  set: setDeviceToken,
};

function getStatusCode(error: unknown): number | undefined {
  if (error instanceof PairingApiError) return error.statusCode;
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = error.statusCode;
    return typeof statusCode === "number" ? statusCode : undefined;
  }
  return undefined;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof PairingApiError && error.statusCode === 429) {
    return error.message;
  }
  return UNKNOWN_ERROR_MESSAGE;
}

async function deleteTokenQuietly(storage: DeviceTokenStorage): Promise<void> {
  try {
    await storage.delete();
  } catch {
    // O token inválido não deve continuar sendo usado mesmo se a limpeza falhar.
  }
}

function hasExpectedDeviceType(
  dispositivo: DeviceIdentity,
  expectedDeviceType: DeviceType | undefined,
): boolean {
  return (
    expectedDeviceType === undefined || dispositivo.tipo === expectedDeviceType
  );
}

function authenticatedResult(
  deviceToken: string,
  response: DeviceMeResponse,
): AuthenticatedSessionResult | { kind: "error"; message: string } {
  const negocio = response.negocio;
  if (
    negocio &&
    (negocio.id !== response.dispositivo.negocioId ||
      typeof negocio.nome !== "string" ||
      !negocio.nome.trim() ||
      !["NOME", "CODIGO", "OPCIONAL"].includes(negocio.modoIdentificacao) ||
      (negocio.mensagemBoasVindas !== null &&
        typeof negocio.mensagemBoasVindas !== "string") ||
      typeof negocio.pagamentoPointConfigurado !== "boolean")
  )
    return { kind: "error", message: SESSION_ERROR_MESSAGE };
  return {
    deviceToken,
    dispositivo: response.dispositivo,
    kind: "authenticated",
    ...(negocio ? { negocio } : {}),
  };
}

export async function restoreDeviceSession({
  api = defaultApi,
  expectedDeviceType,
  storage = defaultStorage,
}: SessionDependencies = {}): Promise<RestoreDeviceSessionResult> {
  let deviceToken: string | null;
  try {
    deviceToken = await storage.get();
  } catch {
    return { kind: "error", message: SESSION_ERROR_MESSAGE };
  }

  if (!deviceToken) return { kind: "pairing", reason: "missing-token" };

  try {
    const response = await api.me(deviceToken);
    if (!hasExpectedDeviceType(response.dispositivo, expectedDeviceType)) {
      await deleteTokenQuietly(storage);
      return { kind: "error", message: INVALID_DEVICE_TYPE_MESSAGE };
    }

    return authenticatedResult(deviceToken, response);
  } catch (error) {
    if (getStatusCode(error) === 401) {
      await deleteTokenQuietly(storage);
      return { kind: "pairing", reason: "invalid-token" };
    }
    return { kind: "error", message: SESSION_ERROR_MESSAGE };
  }
}

export async function pairDevice(
  codigo: string,
  {
    api = defaultApi,
    expectedDeviceType,
    storage = defaultStorage,
  }: SessionDependencies = {},
): Promise<PairDeviceResult> {
  if (!/^\d{6}$/.test(codigo)) {
    return { kind: "error", message: INVALID_INPUT_MESSAGE };
  }

  let activation: DeviceActivationResponse;
  try {
    activation = await api.activate(codigo);
  } catch (error) {
    if (getStatusCode(error) === 401) {
      return {
        kind: "expired-or-used",
        message: INVALID_PAIRING_CODE_MESSAGE,
      };
    }
    return { kind: "error", message: getSafeErrorMessage(error) };
  }

  try {
    await storage.set(activation.deviceToken);
  } catch {
    return { kind: "error", message: UNKNOWN_ERROR_MESSAGE };
  }

  try {
    const response = await api.me(activation.deviceToken);
    if (!hasExpectedDeviceType(response.dispositivo, expectedDeviceType)) {
      await deleteTokenQuietly(storage);
      return { kind: "error", message: INVALID_DEVICE_TYPE_MESSAGE };
    }

    return authenticatedResult(activation.deviceToken, response);
  } catch (error) {
    if (getStatusCode(error) === 401) {
      await deleteTokenQuietly(storage);
      return { kind: "error", message: SESSION_ERROR_MESSAGE };
    }
    return { kind: "error", message: SESSION_ERROR_MESSAGE };
  }
}
