"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"
import { useRouter } from "next/navigation"
import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getCachedUser,
  setCachedUser,
  type UserSession,
} from "@/lib/auth"
import { loginApi, registrarApi, getMeApi } from "@/lib/api"
import type { LoginFormValues, RegistrarFormValues } from "@/lib/schemas/auth"

interface AuthContextType {
  user: UserSession | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: LoginFormValues) => Promise<void>
  registrar: (data: RegistrarFormValues) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const logout = useCallback(() => {
    removeAuthToken()
    setUser(null)
    router.replace("/login")
  }, [router])

  const refreshUser = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      removeAuthToken()
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const response = await getMeApi(token)
      setUser((prev) => {
        const mergedUser = {
          ...prev,
          ...response.user,
          nome: response.user.nome || prev?.nome,
          negocioNome: response.user.negocioNome || prev?.negocioNome,
        }
        setCachedUser(mergedUser)
        return mergedUser
      })
    } catch {
      removeAuthToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function initUser() {
      const token = getAuthToken()
      if (!token) {
        if (isMounted) {
          removeAuthToken()
          setUser(null)
          setIsLoading(false)
        }
        return
      }

      // Hidrata primeiro com o cache local para resposta visual instantânea após mount
      const cached = getCachedUser()
      if (cached && isMounted) {
        setUser(cached)
      }

      try {
        const response = await getMeApi(token)
        if (isMounted) {
          setUser((prev) => {
            const mergedUser = {
              ...prev,
              ...response.user,
              nome: response.user.nome || prev?.nome,
              negocioNome: response.user.negocioNome || prev?.negocioNome,
            }
            setCachedUser(mergedUser)
            return mergedUser
          })
        }
      } catch {
        if (isMounted) {
          removeAuthToken()
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void initUser()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (data: LoginFormValues) => {
    setIsLoading(true)
    try {
      const response = await loginApi(data)
      setAuthToken(response.accessToken)
      setCachedUser(response.usuario)
      setUser(response.usuario)
      router.replace("/admin")
    } finally {
      setIsLoading(false)
    }
  }

  const registrar = async (data: RegistrarFormValues) => {
    setIsLoading(true)
    try {
      const response = await registrarApi(data)
      setAuthToken(response.accessToken)
      setCachedUser(response.usuario)
      setUser(response.usuario)
      router.replace("/admin")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        registrar,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider")
  }
  return context
}
