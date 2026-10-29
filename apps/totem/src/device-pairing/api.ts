import type { DeviceActivationResponse, DeviceMeResponse } from "./types";

interface ApiErrorPayload {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}

export class PairingApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "PairingApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  return (configuredUrl || "http://localhost:3001").replace(/\/+$/, "");
}

function getErrorPayload(value: unknown): ApiErrorPayload {
  return isRecord(value) ? value : {};
}

function getErrorMessage(payload: ApiErrorPayload, statusCode: number): string {
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.message)) {
    return payload.message
      .filter((item) => typeof item === "string")
      .join(", ");
  }
  if (typeof payload.error === "string") return payload.error;
  return `Erro ${statusCode} ao comunicar com o servidor.`;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { headers, ...requestOptions } = options;
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(options.body !== undefined
      ? { "Content-Type": "application/json" }
      : {}),
    ...(headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...requestOptions,
    headers: requestHeaders,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const errorPayload = getErrorPayload(payload);
    const code =
      typeof errorPayload.code === "string" ? errorPayload.code : undefined;
    throw new PairingApiError(
      response.status,
      code,
      getErrorMessage(errorPayload, response.status),
    );
  }

  return payload as T;
}

export function activateDevice(
  codigo: string,
): Promise<DeviceActivationResponse> {
  return request<DeviceActivationResponse>("/dispositivos/parear/ativar", {
    body: JSON.stringify({ codigo }),
    method: "POST",
  });
}

export function getCurrentDevice(
  deviceToken: string,
): Promise<DeviceMeResponse> {
  return request<DeviceMeResponse>("/dispositivos/me", {
    headers: { Authorization: `Bearer ${deviceToken}` },
    method: "GET",
  });
}
