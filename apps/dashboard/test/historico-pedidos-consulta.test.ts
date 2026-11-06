import assert from "node:assert/strict"
import { test } from "node:test"
import { HistoricoPedidosConsulta } from "../lib/historico-pedidos-consulta"
import { ApiError } from "../lib/api"
import type { Pedido } from "../lib/types/models"

const p = (id: string, negocioId = "a"): Pedido => ({
  id,
  negocioId,
  senha: null,
  dataSequencial: "2026-11-05",
  status: "AGUARDANDO_PAGAMENTO",
  valorTotal: 10,
  origemOffline: false,
  demo: false,
  createdAt: "2026-11-05T02:00:00Z",
  updatedAt: "2026-11-05T02:00:00Z",
  itens: [],
})
function pendente<T>() {
  let resolver!: (valor: T) => void
  const promessa = new Promise<T>((r) => (resolver = r))
  return { promessa, resolver }
}
const deps = {
  listar: async () => [p("padrao")],
  dispositivos: async () => [],
  detalhe: async (id: string) => p(id),
}

test("filtro A lento não substitui B rápido, status ou estado de loading", async () => {
  const a = pendente<Pedido[]>()
  let signalA!: AbortSignal
  const c = new HistoricoPedidosConsulta("a", {
    ...deps,
    listar: async (f, s) => {
      if (f.status === "PENDENTE") {
        signalA = s
        return a.promessa
      }
      return [p("novo")]
    },
  })
  const antiga = c.carregar({ status: "PENDENTE" })
  await c.carregar({ status: "PRONTO" })
  assert.equal(signalA.aborted, true)
  a.resolver([p("antigo")])
  await antiga
  assert.equal(c.snapshot().pedidos.dados?.[0].id, "novo")
  assert.equal(c.snapshot().pedidos.carregando, false)
})
test("atualizações manuais concorrentes preservam a mais recente", async () => {
  const a = pendente<Pedido[]>()
  let n = 0
  const c = new HistoricoPedidosConsulta("a", {
    ...deps,
    listar: async () => (++n === 2 ? a.promessa : [p(String(n))]),
  })
  await c.carregar({})
  const lenta = c.carregar({}, true)
  await c.carregar({}, true)
  a.resolver([p("antiga")])
  await lenta
  assert.equal(c.snapshot().pedidos.dados?.[0].id, "3")
})
test("pedido A lento não troca B; fechar invalida respostas pendentes", async () => {
  const a = pendente<Pedido>()
  const c = new HistoricoPedidosConsulta("a", {
    ...deps,
    detalhe: async (id) => (id === "a" ? a.promessa : p(id)),
  })
  const antiga = c.abrirDetalhe("a")
  await c.abrirDetalhe("b")
  a.resolver(p("a"))
  await antiga
  assert.equal(c.snapshot().detalhe.dados?.id, "b")
  const b = pendente<Pedido>()
  const outra = new HistoricoPedidosConsulta("a", {
    ...deps,
    detalhe: async () => b.promessa,
  })
  const lendo = outra.abrirDetalhe("a")
  outra.fecharDetalhe()
  b.resolver(p("a"))
  await lendo
  assert.equal(outra.snapshot().selecionadoId, null)
  assert.equal(outra.snapshot().detalhe.dados, null)
})
test("falha secundária não impede pedidos nem vira lista vazia de dispositivos", async () => {
  const c = new HistoricoPedidosConsulta("a", {
    ...deps,
    dispositivos: async () => {
      throw new ApiError(503, "interno")
    },
  })
  await c.carregar({})
  assert.equal(c.snapshot().pedidos.dados?.length, 1)
  assert.equal(c.snapshot().dispositivos.dados, null)
  assert.equal(c.snapshot().dispositivos.erro?.codigo, 503)
})
test("falha principal preserva snapshot manual sinalizado, nunca inventa vazio", async () => {
  let falhar = false
  const c = new HistoricoPedidosConsulta("a", {
    ...deps,
    listar: async () => {
      if (falhar) throw new ApiError(429, "interno")
      return [p("um")]
    },
  })
  await c.carregar({})
  falhar = true
  await c.carregar({}, true)
  assert.equal(c.snapshot().pedidos.dados?.[0].id, "um")
  assert.equal(c.snapshot().pedidos.erro?.codigo, 429)
})
for (const codigo of [401, 403])
  test(`${codigo} invalida todas as fontes imediatamente`, async () => {
    const lenta = pendente<Pedido[]>()
    let negar = false
    const c = new HistoricoPedidosConsulta("a", {
      ...deps,
      listar: async () => (negar ? lenta.promessa : [p("um")]),
      dispositivos: async () => {
        if (negar) throw new ApiError(codigo, "privado")
        return []
      },
    })
    await c.carregar({})
    negar = true
    const atualizando = c.carregar({}, true)
    await new Promise((r) => setTimeout(r, 0))
    const estado = c.snapshot()
    lenta.resolver([p("antigo")])
    await atualizando
    assert.equal(estado.pedidos.dados, null)
    assert.equal(c.snapshot().pedidos.dados, null)
    assert.equal(c.snapshot().pedidos.erro?.codigo, codigo)
  })
test("cancelar por logout/unmount impede publicação e outra sessão começa vazia", async () => {
  const lenta = pendente<Pedido[]>()
  const c = new HistoricoPedidosConsulta("a", {
    ...deps,
    listar: async () => lenta.promessa,
  })
  const lendo = c.carregar({})
  c.cancelar()
  const estado = c.snapshot()
  lenta.resolver([p("um")])
  await lendo
  assert.equal(c.snapshot(), estado)
  const outra = new HistoricoPedidosConsulta("b", deps)
  assert.equal(outra.snapshot().pedidos.dados, null)
})
test("resposta de outro tenant é rejeitada", async () => {
  const c = new HistoricoPedidosConsulta("a", {
    ...deps,
    listar: async () => [p("outro", "b")],
  })
  await c.carregar({})
  assert.equal(c.snapshot().pedidos.dados, null)
  assert.ok(c.snapshot().pedidos.erro)
})

test("timeout aborta consulta principal e mantém fonte indisponível", async () => {
  // A fonte usa o AbortSignal real recebido no segundo argumento.
  const outra = new HistoricoPedidosConsulta(
    "a",
    {
      ...deps,
      listar: (_f, signal) =>
        new Promise((_r, reject) =>
          signal.addEventListener("abort", () => reject(new Error("timeout")))
        ),
    },
    1
  )
  await outra.carregar({})
  assert.equal(outra.snapshot().pedidos.dados, null)
  assert.ok(outra.snapshot().pedidos.erro)
})
