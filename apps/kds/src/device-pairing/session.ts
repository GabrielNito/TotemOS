import { activateDevice, getCurrentDevice, PairingApiError } from "./api";
import {
  deleteDeviceToken,
  deleteDeviceSession,
  getDeviceToken,
  getDeviceSession,
  setDeviceToken,
  setDeviceSession,
} from "../storage/device-token";
import type {
  DeviceActivationResponse,
  DeviceIdentity,
  DeviceMeResponse,
  DeviceType,
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

export interface DeviceSessionCache {
  delete(): Promise<void>;
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
}

export interface SessionDependencies {
  api?: PairingApi;
  cache?: DeviceSessionCache;
  expectedDeviceType?: DeviceType;
  storage?: DeviceTokenStorage;
}

export type AuthenticatedSessionResult = {
  deviceToken: string;
  dispositivo: DeviceIdentity;
  kind: "authenticated";
  cached?: true;
  negocio?: DeviceMeResponse["negocio"];
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

const defaultCache: DeviceSessionCache = {
  delete: deleteDeviceSession,
  get: getDeviceSession,
  set: setDeviceSession,
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

async function deleteSessionQuietly(
  storage: DeviceTokenStorage,
  cache: DeviceSessionCache,
): Promise<void> {
  await Promise.allSettled([storage.delete(), cache.delete()]);
}

function hasExpectedDeviceType(
  dispositivo: DeviceIdentity,
  expectedDeviceType: DeviceType | undefined,
): boolean {
  return (
    expectedDeviceType === undefined || dispositivo.tipo === expectedDeviceType
  );
}

function validCachedDevice(response: DeviceMeResponse): boolean {
  const device = response?.dispositivo;
  return (
    !!device &&
    typeof device.id === "string" &&
    !!device.id &&
    typeof device.negocioId === "string" &&
    !!device.negocioId &&
    typeof device.nome === "string" &&
    !!device.nome.trim() &&
    ["TOTEM", "PAINEL"].includes(device.tipo) &&
    device.ativo === true &&
    device.revogadoEm === null
  );
}

async function saveSessionQuietly(
  cache: DeviceSessionCache,
  response: DeviceMeResponse,
) {
  try {
    await cache.set(JSON.stringify(response));
  } catch {
    // A sessão online continua válida; apenas a recuperação offline fica indisponível.
  }
}

async function cachedSession(
  cache: DeviceSessionCache,
  deviceToken: string,
  expectedDeviceType?: DeviceType,
): Promise<AuthenticatedSessionResult | undefined> {
  try {
    const raw = await cache.get();
    if (!raw) return undefined;
    const response = JSON.parse(raw) as DeviceMeResponse;
    if (
      !validCachedDevice(response) ||
      !hasExpectedDeviceType(response.dispositivo, expectedDeviceType)
    )
      return undefined;
    return {
      cached: true,
      deviceToken,
      dispositivo: response.dispositivo,
      kind: "authenticated",
      ...(response.negocio && { negocio: response.negocio }),
    };
  } catch {
    return undefined;
  }
}

export async function restoreDeviceSession({
  api = defaultApi,
  cache = defaultCache,
  expectedDeviceType,
  storage = defaultStorage,
}: SessionDependencies = {}): Promise<RestoreDeviceSessionResult> {
  let deviceToken: string | null;
  try {
    deviceToken = await storage.get();
  } catch {
    return { kind: "error", message: SESSION_ERROR_MESSAGE };
  }

  if (!deviceToken) {
    await cache.delete().catch(() => undefined);
    return { kind: "pairing", reason: "missing-token" };
  }

  try {
    const response = await api.me(deviceToken);
    if (!hasExpectedDeviceType(response.dispositivo, expectedDeviceType)) {
      await deleteSessionQuietly(storage, cache);
      return { kind: "error", message: INVALID_DEVICE_TYPE_MESSAGE };
    }

    const result: AuthenticatedSessionResult = {
      deviceToken,
      dispositivo: response.dispositivo,
      kind: "authenticated",
      ...(response.negocio && { negocio: response.negocio }),
    };
    await saveSessionQuietly(cache, response);
    return result;
  } catch (error) {
    if (getStatusCode(error) === 401) {
      await deleteSessionQuietly(storage, cache);
      return { kind: "pairing", reason: "invalid-token" };
    }
    return (
      (await cachedSession(cache, deviceToken, expectedDeviceType)) ?? {
        kind: "error",
        message: SESSION_ERROR_MESSAGE,
      }
    );
  }
}

export async function pairDevice(
  codigo: string,
  {
    api = defaultApi,
    cache = defaultCache,
    expectedDeviceType,
    storage = defaultStorage,
  }: SessionDependencies = {},
): Promise<PairDeviceResult> {
  if (!/^\d{6}$/.test(codigo)) {
    return { kind: "error", message: INVALID_INPUT_MESSAGE };
  }

  const existingSession = await restoreDeviceSession({
    api,
    expectedDeviceType,
    storage,
  });
  if (existingSession.kind !== "pairing") return existingSession;

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
      await deleteSessionQuietly(storage, cache);
      return { kind: "error", message: INVALID_DEVICE_TYPE_MESSAGE };
    }

    const result: AuthenticatedSessionResult = {
      deviceToken: activation.deviceToken,
      dispositivo: response.dispositivo,
      kind: "authenticated",
      ...(response.negocio && { negocio: response.negocio }),
    };
    await saveSessionQuietly(cache, response);
    return result;
  } catch (error) {
    if (getStatusCode(error) === 401) {
      await deleteSessionQuietly(storage, cache);
      return { kind: "error", message: SESSION_ERROR_MESSAGE };
    }
    return { kind: "error", message: SESSION_ERROR_MESSAGE };
  }
}
