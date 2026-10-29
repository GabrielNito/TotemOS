import { normalizeCatalog, type CatalogCategory } from "./model";

interface ApiErrorPayload {
  message?: unknown;
  error?: unknown;
}

export class CatalogApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "CatalogApiError";
  }
}

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  return (configuredUrl || "http://localhost:3001").replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(payload: ApiErrorPayload, statusCode: number): string {
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.message)) {
    return payload.message
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }
  if (typeof payload.error === "string") return payload.error;
  return `Erro ${statusCode} ao carregar o catálogo.`;
}

export async function getCatalogoPublico(
  negocioId: string,
  signal?: AbortSignal,
): Promise<CatalogCategory[]> {
  if (negocioId.trim().length === 0) {
    throw new CatalogApiError(400, "Negócio não identificado.");
  }

  const response = await fetch(
    `${getApiBaseUrl()}/catalogo/publico/${encodeURIComponent(negocioId)}`,
    {
      headers: { Accept: "application/json" },
      method: "GET",
      signal,
    },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    throw new CatalogApiError(
      response.status,
      getErrorMessage(isRecord(payload) ? payload : {}, response.status),
    );
  }

  return normalizeCatalog(payload);
}
