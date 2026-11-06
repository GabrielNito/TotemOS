import { expect, test } from "bun:test"
import {
  ApiError,
  getCatalogoAdministrativo,
  getDispositivos,
} from "../lib/api"
import {
  diagnosticarCatalogo,
  diagnosticarEquipamentos,
  configuracaoOperacional,
} from "../lib/configuracao-inicial"
import { ConsultaConfiguracao } from "../lib/configuracao-inicial-consulta"
import type { Categoria, Produto, Dispositivo } from "../lib/types/models"

const categoria: Categoria = {
  id: "c",
  negocioId: "a",
  nome: "Bebidas",
  ordem: 0,
  ativo: true,
}
const produto: Produto = {
  id: "p",
  negocioId: "a",
  categoriaId: "c",
  nome: "Água",
  precoBase: 5,
  tempoEstimadoPreparo: 0,
  ativo: true,
  esgotado: false,
}
const dispositivo = (tipo: "TOTEM" | "PAINEL", extra = {}): Dispositivo => ({
  id: tipo,
  negocioId: "a",
  nome: tipo,
  tipo,
  ativo: true,
  revogadoEm: null,
  pareadoEm: null,
  createdAt: "2026-11-06",
  ...extra,
})
const vazio = { categorias: [], produtos: [] }
const pronto = { categorias: [categoria], produtos: [produto] }

for (const [nome, categorias, produtos, status, motivo] of [
  ["negócio novo e catálogo vazio", [], [], "pendente", "Crie uma categoria"],
  ["categoria vazia", [categoria], [], "pendente", "Cadastre um produto"],
  [
    "categoria inativa",
    [{ ...categoria, ativo: false }],
    [produto],
    "pendente",
    "Ative uma categoria",
  ],
  [
    "produto inativo",
    [categoria],
    [{ ...produto, ativo: false }],
    "pendente",
    "Ative um produto",
  ],
  [
    "produto esgotado",
    [categoria],
    [{ ...produto, esgotado: true }],
    "pendente",
    "disponível",
  ],
  [
    "produto oculto por categoria ausente",
    [],
    [produto],
    "pendente",
    "categoria",
  ],
  [
    "produto disponível em categoria ativa",
    [categoria],
    [produto],
    "concluido",
    "1 produto",
  ],
] as const) {
  test(nome, () => {
    const d = diagnosticarCatalogo({
      categorias: [...categorias],
      produtos: [...produtos],
    })
    expect(d.status).toBe(status)
    expect(d.descricao).toContain(motivo)
  })
}
for (const [nome, dispositivos, status, totens, paineis] of [
  ["sem equipamentos", [], "pendente", 0, 0],
  ["somente Totem", [dispositivo("TOTEM")], "pendente", 1, 0],
  ["somente KDS", [dispositivo("PAINEL")], "pendente", 0, 1],
  [
    "Totem e KDS",
    [dispositivo("TOTEM"), dispositivo("PAINEL")],
    "concluido",
    1,
    1,
  ],
  [
    "inativo",
    [dispositivo("TOTEM", { ativo: false }), dispositivo("PAINEL")],
    "pendente",
    0,
    1,
  ],
  [
    "revogado mesmo com ativo inconsistente",
    [dispositivo("TOTEM", { revogadoEm: "2026-11-06" })],
    "pendente",
    0,
    0,
  ],
] as const) {
  test(nome, () => {
    expect(diagnosticarEquipamentos([...dispositivos])).toMatchObject({
      status,
      totens,
      paineis,
    })
  })
}
test("configuração sem API não aceita defaults nem conclusão local", () => {
  expect(configuracaoOperacional.status).toBe("indisponivel")
  expect(configuracaoOperacional.descricao).toContain("#36 e #37")
})
test("falha parcial mantém catálogo válido e erro específico de equipamentos", async () => {
  const c = new ConsultaConfiguracao(
    "a",
    async () => pronto,
    async () => {
      throw new Error("segredo")
    }
  )
  await c.atualizar()
  expect(c.snapshot().catalogo.dados).toEqual(pronto)
  expect(c.snapshot().dispositivos.status).toBe("erro")
  expect(c.snapshot().dispositivos.erro).not.toContain("segredo")
})
test("falha no catálogo não impede equipamentos e refetch reconhece revogação/esgotamento", async () => {
  let rodada = 0
  const c = new ConsultaConfiguracao(
    "a",
    async () => {
      if (!rodada) throw new Error()
      return { ...pronto, produtos: [{ ...produto, esgotado: true }] }
    },
    async () => ({
      dispositivos: rodada ? [] : [dispositivo("TOTEM"), dispositivo("PAINEL")],
    })
  )
  await c.atualizar()
  expect(c.snapshot().catalogo.status).toBe("erro")
  expect(c.snapshot().dispositivos.status).toBe("sucesso")
  rodada++
  await c.atualizar()
  expect(diagnosticarCatalogo(c.snapshot().catalogo.dados!).status).toBe(
    "pendente"
  )
  expect(c.snapshot().dispositivos.dados).toEqual({ dispositivos: [] })
})
for (const status of [401, 403, 404, 429, 503]) {
  test(`HTTP ${status} seguro, sem transformar erro em pendência`, async () => {
    let expirou = false
    const c = new ConsultaConfiguracao(
      "a",
      async () => {
        throw new ApiError(status, "token-segredo")
      },
      async () => ({ dispositivos: [] }),
      () => {
        expirou = true
      }
    )
    await c.atualizar()
    expect(c.snapshot().catalogo.status).toBe("erro")
    expect(c.snapshot().catalogo.erro).not.toContain("token-segredo")
    expect(expirou).toBe(status === 401)
    if ([401, 403].includes(status))
      expect(c.snapshot().dispositivos.dados).toBeNull()
  })
}
test("401 limpa inclusive fonte já concluída e aborta fonte lenta", async () => {
  let falhar!: (e: unknown) => void
  const c = new ConsultaConfiguracao(
    "a",
    () =>
      new Promise((_, reject) => {
        falhar = reject
      }),
    async () => ({ dispositivos: [dispositivo("TOTEM")] })
  )
  const consulta = c.atualizar()
  await new Promise((r) => setTimeout(r, 0))
  expect(c.snapshot().dispositivos.status).toBe("sucesso")
  falhar(new ApiError(401, "segredo"))
  await consulta
  expect(c.snapshot().dispositivos.dados).toBeNull()
})
test("resposta obsoleta e cancelamento não publicam dados", async () => {
  let resolver!: (v: typeof pronto) => void
  let chamadas = 0
  const c = new ConsultaConfiguracao(
    "a",
    () =>
      ++chamadas === 1
        ? new Promise((r) => {
            resolver = r
          })
        : Promise.resolve(vazio),
    async () => ({ dispositivos: [] })
  )
  const antiga = c.atualizar()
  await c.atualizar()
  const snapshot = c.snapshot()
  resolver(pronto)
  await antiga
  expect(c.snapshot()).toBe(snapshot)
  const pendente = c.atualizar()
  c.cancelar()
  const cancelado = c.snapshot()
  await pendente
  expect(c.snapshot()).toBe(cancelado)
})
test("timeout termina mesmo se transporte ignora abort; fonte rápida permanece", async () => {
  const c = new ConsultaConfiguracao(
    "a",
    () => new Promise(() => {}),
    async () => ({ dispositivos: [] }),
    undefined,
    5
  )
  await c.atualizar()
  expect(c.snapshot().catalogo.erro).toContain("Tempo")
  expect(c.snapshot().dispositivos.status).toBe("sucesso")
})
test("dois tenants e retomada usam instâncias vazias; dados cruzados são rejeitados", async () => {
  const a = new ConsultaConfiguracao(
    "a",
    async () => pronto,
    async () => ({ dispositivos: [] })
  )
  await a.atualizar()
  const b = new ConsultaConfiguracao(
    "b",
    async () => pronto,
    async () => ({ dispositivos: [] })
  )
  expect(b.snapshot().catalogo.dados).toBeNull()
  await b.atualizar()
  expect(b.snapshot().catalogo.status).toBe("erro")
  expect(b.snapshot().catalogo.dados).toBeNull()
  const retorno = new ConsultaConfiguracao(
    "a",
    async () => vazio,
    async () => ({ dispositivos: [] })
  )
  await retorno.atualizar()
  expect(retorno.snapshot().catalogo.dados).toEqual(vazio)
})
test("HTTP existente recebe JWT explícito e signal no catálogo e dispositivos", async () => {
  const original = globalThis.fetch
  const urls: string[] = []
  const signal = new AbortController().signal
  globalThis.fetch = Object.assign(
    async (url: string | URL | Request, options?: RequestInit) => {
      urls.push(String(url))
      expect(options?.signal).toBe(signal)
      expect(options?.cache).toBe("no-store")
      expect((options?.headers as Record<string, string>).Authorization).toBe(
        "Bearer teste"
      )
      return new Response(
        JSON.stringify(
          String(url).endsWith("catalogo/admin") ? vazio : { dispositivos: [] }
        )
      )
    },
    { preconnect: original.preconnect }
  ) as typeof fetch
  try {
    await getCatalogoAdministrativo("teste", signal)
    await getDispositivos("teste", signal)
    expect(urls.every((u) => !u.includes("negocioId"))).toBe(true)
  } finally {
    globalThis.fetch = original
  }
})

test("troca de token durante HTTP descarta resposta e não expira a sessão nova", async () => {
  let atual = true
  let expirada = false
  let rejeitar!: (e: unknown) => void
  const c = new ConsultaConfiguracao(
    "a",
    () =>
      new Promise((_, reject) => {
        rejeitar = reject
      }),
    async () => ({ dispositivos: [] }),
    () => {
      expirada = true
    },
    20000,
    () => atual
  )
  const requisicao = c.atualizar()
  atual = false
  rejeitar(new ApiError(401, "sessão anterior"))
  await requisicao
  expect(expirada).toBe(false)
  expect(c.snapshot().catalogo.dados).toBeNull()
})

test("dispositivo de outro tenant invalida fontes sem exibir cadastro alheio", async () => {
  const c = new ConsultaConfiguracao(
    "a",
    async () => pronto,
    async () => ({ dispositivos: [dispositivo("TOTEM", { negocioId: "b" })] })
  )
  await c.atualizar()
  expect(c.snapshot().acessoNegado).toBe(true)
  expect(c.snapshot().catalogo.dados).toBeNull()
  expect(c.snapshot().dispositivos.dados).toBeNull()
})

test("falha após sucesso remove conclusão anterior e recuperação reavalia dados atuais", async () => {
  let falhar = false
  const c = new ConsultaConfiguracao(
    "a",
    async () => {
      if (falhar) throw new Error("rede")
      return pronto
    },
    async () => ({ dispositivos: [] })
  )
  await c.atualizar()
  falhar = true
  await c.atualizar()
  expect(c.snapshot().catalogo.status).toBe("erro")
  expect(c.snapshot().catalogo.dados).toBeNull()
  falhar = false
  await c.atualizar()
  expect(c.snapshot().catalogo.status).toBe("sucesso")
})
