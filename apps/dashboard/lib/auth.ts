import Cookies from "js-cookie"

export const AUTH_TOKEN_COOKIE = "totemos_token"
export const USER_CACHE_KEY = "totemos_user"

export interface UserSession {
  id?: string
  sub?: string
  nome?: string
  email?: string
  role?: "DONO" | "GERENTE" | string
  negocioId?: string
  negocioNome?: string
}

export interface AuthResponse {
  accessToken: string
  usuario: UserSession
}

export function getAuthToken(): string | undefined {
  return Cookies.get(AUTH_TOKEN_COOKIE)
}

export function setAuthToken(token: string): void {
  Cookies.set(AUTH_TOKEN_COOKIE, token, {
    expires: 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
}

export function removeAuthToken(): void {
  Cookies.remove(AUTH_TOKEN_COOKIE, { path: "/" })
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(USER_CACHE_KEY)
    } catch {
      // Ignora erro de localStorage
    }
  }
}

export function setCachedUser(user: UserSession): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
    } catch {
      // Ignora erro de localStorage
    }
  }
}

export function getCachedUser(): UserSession | null {
  if (typeof window === "undefined") return null
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken())
}
