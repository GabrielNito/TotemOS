import { expect, test } from "bun:test"
import {
  ConsultaIndicadores,
  mensagemErroIndicadores,
} from "../lib/indicadores-consulta"
import { ApiError } from "../lib/api"

test("erro de dispositivos preserva pedidos sem inventar cadastro vazio", async () => {
  const c = new ConsultaIndicadores(
    async () => [],
    async () => {
      throw new Error("rede")
    }
  )
  await c.atualizar()
  expect(c.snapshot().pedidos.dados).toEqual([])
  expect(c.snapshot().dispositivos.dados).toBeNull()
  expect(c.snapshot().dispositivos.erro).toContain("comunicação")
})
test("erro de pedidos não vira zero; refetch preserva snapshot sinalizado", async () => {
  let falhar = false
  const c = new ConsultaIndicadores(
    async () => {
      if (falhar) throw new Error()
      return []
    },
    async () => []
  )
  await c.atualizar()
  const sucesso = c.snapshot().pedidos.atualizadoEm
  falhar = true
  await c.atualizar()
  expect(c.snapshot().pedidos.atualizadoEm).toBe(sucesso)
  expect(c.snapshot().pedidos.erro).toBeTruthy()
  const novo = new ConsultaIndicadores(
    async () => {
      throw new Error()
    },
    async () => []
  )
  await novo.atualizar()
  expect(novo.snapshot().pedidos.dados).toBeNull()
})
test("resposta antiga não sobrescreve nova; dispose descarta sessão anterior", async () => {
  let resolver!: (value: never[]) => void
  let n = 0
  const c = new ConsultaIndicadores(
    () =>
      ++n === 1
        ? new Promise((r) => {
            resolver = r
          })
        : Promise.resolve([]),
    async () => []
  )
  const antigo = c.atualizar()
  await c.atualizar()
  const novo = c.snapshot()
  resolver([])
  await antigo
  expect(c.snapshot()).toBe(novo)
  const pendente = c.atualizar()
  c.cancelar()
  const cancelado = c.snapshot()
  await pendente
  expect(c.snapshot()).toBe(cancelado)
  const outraSessao = new ConsultaIndicadores(
    async () => [],
    async () => []
  )
  expect(outraSessao.snapshot().pedidos.dados).toBeNull()
})
for (const [codigo, texto] of [
  [401, "Sessão"],
  [403, "autorização"],
  [429, "requisições"],
  [503, "indisponível"],
] as const) {
  test(`HTTP ${codigo} possui mensagem segura e não mostra payload do servidor`, async () => {
    expect(mensagemErroIndicadores(new ApiError(codigo, "segredo"))).toContain(
      texto
    )
    const c = new ConsultaIndicadores(
      async () => {
        throw new ApiError(codigo, "segredo")
      },
      async () => []
    )
    await c.atualizar()
    expect(c.snapshot().pedidos.dados).toBeNull()
    expect(c.snapshot().pedidos.erro).not.toContain("segredo")
    if (codigo === 401 || codigo === 403)
      expect(c.snapshot().dispositivos.dados).toBeNull()
  })
}
test("carregamento é observável e timestamps são por fonte", async () => {
  const c = new ConsultaIndicadores(
    async () => [],
    async () => []
  )
  let notificacoes = 0
  const remover = c.assinar(() => notificacoes++)
  const carregamento = c.atualizar()
  expect(c.snapshot().carregando).toBe(true)
  await carregamento
  expect(c.snapshot().carregando).toBe(false)
  expect(c.snapshot().pedidos.atualizadoEm).not.toBeNull()
  expect(notificacoes).toBe(2)
  remover()
})

test("timeout aborta transporte e mantém fontes indisponíveis, sem zeros", async () => {
  const c = new ConsultaIndicadores(
    (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("timeout")))
      ),
    async () => [],
    1
  )
  await c.atualizar()
  expect(c.snapshot().pedidos.dados).toBeNull()
  expect(c.snapshot().pedidos.erro).toContain("comunicação")
  expect(c.snapshot().dispositivos.dados).toEqual([])
})
