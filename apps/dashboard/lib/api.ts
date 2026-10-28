import { env } from "./env"
import { getAuthToken } from "./auth"
import type { AuthResponse, UserSession } from "./auth"
import type { LoginFormValues, RegistrarFormValues } from "./schemas/auth"
import type {
  Categoria,
  Dispositivo,
  Produto,
  TipoDispositivo,
} from "./types/models"

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
    ...(restOptions.body !== undefined && restOptions.body !== null
      ? { "Content-Type": "application/json" }
      : {}),
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

  if (response.status === 204) {
    return undefined as T
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

export interface DispositivosResponse {
  dispositivos: Dispositivo[]
}

export interface GerarCodigoPareamentoInput {
  nome: string
  tipo: TipoDispositivo
}

export interface GerarCodigoPareamentoResponse {
  codigo: string
  expiraEm: string
}

export function getDispositivos(): Promise<DispositivosResponse> {
  return fetchApi<DispositivosResponse>("/dispositivos", {
    method: "GET",
    cache: "no-store",
  })
}

export function gerarCodigoPareamento(
  data: GerarCodigoPareamentoInput
): Promise<GerarCodigoPareamentoResponse> {
  return fetchApi<GerarCodigoPareamentoResponse>(
    "/dispositivos/parear/codigo",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  )
}

export function revogarDispositivo(id: string): Promise<void> {
  return fetchApi<void>(`/dispositivos/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

type PrecoSerializado = number | string

type CategoriaApi = Omit<Categoria, "produtos">

interface AdicionalApi {
  id: string
  produtoId: string
  nome: string
  preco: PrecoSerializado
  maximo: number
  esgotado: boolean
}

interface ProdutoApi extends Omit<Produto, "precoBase" | "adicionais"> {
  precoBase: PrecoSerializado
  adicionais: AdicionalApi[]
}

interface CatalogoAdministrativoApi {
  categorias: CategoriaApi[]
  produtos: ProdutoApi[]
}

export interface CatalogoAdministrativo {
  categorias: Categoria[]
  produtos: Produto[]
}

export interface CategoriaInput {
  nome?: string
  ordem?: number
  ativo?: boolean
}

export interface AdicionalInput {
  id?: string
  nome: string
  preco: number
  maximo: number
  esgotado?: boolean
}

export interface ProdutoInput {
  categoriaId?: string
  nome?: string
  descricao?: string | null
  precoBase?: number
  imagemUrl?: string | null
  tempoEstimadoPreparo?: number
  esgotado?: boolean
  ativo?: boolean
  adicionais?: AdicionalInput[]
}

export interface CriarProdutoInput {
  categoriaId: string
  nome: string
  descricao?: string | null
  precoBase: number
  imagemUrl?: string | null
  tempoEstimadoPreparo: number
  esgotado?: boolean
  ativo: boolean
  adicionais: Array<Omit<AdicionalInput, "id">>
}

function normalizarPreco(preco: PrecoSerializado): number {
  const valor = typeof preco === "string" ? Number(preco) : preco

  if (!Number.isFinite(valor)) {
    throw new Error("A API retornou um preço inválido")
  }

  return valor
}

function normalizarProduto(produto: ProdutoApi): Produto {
  return {
    ...produto,
    precoBase: normalizarPreco(produto.precoBase),
    adicionais: produto.adicionais.map((adicional) => ({
      ...adicional,
      preco: normalizarPreco(adicional.preco),
    })),
  }
}

export async function getCatalogoAdministrativo(): Promise<CatalogoAdministrativo> {
  const catalogo = await fetchApi<CatalogoAdministrativoApi>(
    "/catalogo/admin",
    {
      method: "GET",
      cache: "no-store",
    }
  )

  return {
    categorias: catalogo.categorias,
    produtos: catalogo.produtos.map(normalizarProduto),
  }
}

export function createCategoria(
  data: Required<Pick<CategoriaInput, "nome" | "ordem">>
) {
  return fetchApi<Categoria>("/catalogo/categorias", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export function updateCategoria(id: string, data: CategoriaInput) {
  return fetchApi<Categoria>(`/catalogo/categorias/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export function createProduto(data: CriarProdutoInput) {
  return fetchApi<ProdutoApi>("/catalogo/produtos", {
    method: "POST",
    body: JSON.stringify(data),
  }).then(normalizarProduto)
}

export function updateProduto(id: string, data: ProdutoInput) {
  return fetchApi<ProdutoApi>(`/catalogo/produtos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then(normalizarProduto)
}

export function deactivateProduto(id: string) {
  return fetchApi<Pick<Produto, "id" | "nome" | "ativo">>(
    `/catalogo/produtos/${id}`,
    { method: "DELETE" }
  )
}
