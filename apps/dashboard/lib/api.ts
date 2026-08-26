import { env } from "./env"
import { getAuthToken } from "./auth"
import type { AuthResponse, UserSession } from "./auth"
import type { LoginFormValues, RegistrarFormValues } from "./schemas/auth"

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errorDetails?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

interface FetchOptions extends RequestInit {
  token?: string
}

export async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, headers, ...restOptions } = options
  const resolvedToken = token || getAuthToken()

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  }

  if (resolvedToken) {
    requestHeaders["Authorization"] = `Bearer ${resolvedToken}`
  }

  const baseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
  const cleanEndpoint = endpoint.replace(/^\//, "")
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${baseUrl}/${cleanEndpoint}`

  const response = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
  })

  if (!response.ok) {
    let errorMessage = "Ocorreu um erro inesperado na requisição"
    let errorDetails: unknown = undefined

    try {
      const errorJson = await response.json()
      errorDetails = errorJson

      if (typeof errorJson.message === "string") {
        errorMessage = errorJson.message
      } else if (Array.isArray(errorJson.message)) {
        errorMessage = errorJson.message.join(", ")
      } else if (errorJson.error) {
        errorMessage = errorJson.error
      }
    } catch {
      errorMessage = `Erro ${response.status}: ${response.statusText}`
    }

    throw new ApiError(response.status, errorMessage, errorDetails)
  }

  return response.json() as Promise<T>
}

export async function loginApi(data: LoginFormValues): Promise<AuthResponse> {
  return fetchApi<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function registrarApi(
  data: RegistrarFormValues
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>("/auth/registrar", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getMeApi(token?: string): Promise<{ user: UserSession }> {
  return fetchApi<{ user: UserSession }>("/auth/me", {
    method: "GET",
    token,
  })
}

export async function validarPinApi(
  pin: string,
  negocioId: string
): Promise<{ valido: boolean }> {
  return fetchApi<{ valido: boolean }>("/auth/validar-pin", {
    method: "POST",
    body: JSON.stringify({ pin, negocioId }),
  })
}
