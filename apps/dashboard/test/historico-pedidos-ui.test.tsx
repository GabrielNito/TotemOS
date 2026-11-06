import * as React from "react"
import assert from "node:assert/strict"
import { test, before, after, afterEach } from "node:test"
import { Window } from "happy-dom"
import { act } from "react"
import type { Root } from "react-dom/client"
let HistoricoPedidosPage: typeof import("../app/admin/pedidos/page").HistoricoPedidosPage
const win = new Window({ url: "http://localhost:3000" })
let root: Root, container: HTMLDivElement
const originais = new Map<string, PropertyDescriptor | undefined>()
const fetchOriginal = globalThis.fetch
const usuario = { id: "dono", negocioId: "a", role: "DONO" }
before(async () => {
  for (const [k, value] of Object.entries({
    window: win,
    requestAnimationFrame: win.requestAnimationFrame.bind(win),
    cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
    getComputedStyle: win.getComputedStyle.bind(win),
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Element: win.Element,
    Node: win.Node,
    IntersectionObserver: win.IntersectionObserver,
    MutationObserver: win.MutationObserver,
    ResizeObserver: win.ResizeObserver,
    MouseEvent: win.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originais.set(k, Object.getOwnPropertyDescriptor(globalThis, k))
    Object.defineProperty(globalThis, k, {
      value,
      writable: true,
      configurable: true,
    })
  }
  HistoricoPedidosPage = (await import("../app/admin/pedidos/page"))
    .HistoricoPedidosPage
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  container?.remove()
  globalThis.fetch = fetchOriginal
})
after(() => {
  for (const [k, d] of originais) {
    if (d) Object.defineProperty(globalThis, k, d)
    else Reflect.deleteProperty(globalThis, k)
  }
  void win.happyDOM.close()
})
const p = (id = "p", extra = {}) => ({
  id,
  negocioId: "a",
  senha: null,
  dataSequencial: "2026-11-05",
  dataOperacional: null,
  status: "AGUARDANDO_PAGAMENTO",
  valorTotal: "12.35",
  origemOffline: false,
  demo: true,
  preparoZero: true,
  createdAt: "2026-11-05T02:00:00Z",
  updatedAt: "2026-11-05T02:00:00Z",
  itens: [
    {
      id: "item",
      pedidoId: id,
      nomeProduto: "Nome histórico",
      precoNoMomento: "12.35",
      quantidade: 1,
    },
  ],
  ...extra,
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
const texto = () => container.textContent ?? ""
async function render() {
  const { createRoot } = await import("react-dom/client")
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <HistoricoPedidosPage user={usuario} token="humano" logout={() => {}} />
    )
  )
}
const botao = (nome: string) =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(nome)
  )!
function fetchMock(
  fn: (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => Promise<Response>
) {
  globalThis.fetch = Object.assign(fn, fetchOriginal)
}
async function input(id: string, value: string) {
  const el = container.querySelector<HTMLInputElement>(id)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      win.HTMLInputElement.prototype,
      "value"
    )!.set!.call(el, value)
    el.dispatchEvent(
      new win.Event("input", { bubbles: true }) as unknown as Event
    )
    el.dispatchEvent(
      new win.Event("change", { bubbles: true }) as unknown as Event
    )
  })
}

test("lista real mantém senha null, DEMO, preparo zero, snapshot e falha parcial visível", async () => {
  fetchMock(async (url, init) => {
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer humano"
    )
    return String(url).includes("dispositivos") ? json({}, 503) : json([p()])
  })
  await render()
  assert.match(texto(), /Aguardando senha/)
  assert.match(texto(), /DEMO/)
  assert.ok(
    container.querySelector('[title="Todos os itens com Preparo Zero"]')
  )
  assert.match(texto(), /Nome histórico/)
  assert.match(texto(), /origem.*limitada/i)
  assert.doesNotMatch(
    texto(),
    /Snapshots confirmados pelo backend|Valor Servidor \(Comercial\)/
  )
  assert.equal(
    Array.from(container.querySelectorAll("button")).some((b) =>
      /cancelar pedido|estornar|liberar|atribuir senha/i.test(
        b.textContent ?? ""
      )
    ),
    false
  )
})
test("filtros enviam criação sem esconder pedido cuja senha é do dia seguinte; busca local não faz HTTP", async () => {
  const urls: string[] = []
  fetchMock(async (url) => {
    urls.push(String(url))
    return String(url).includes("dispositivos")
      ? json({ dispositivos: [] })
      : json([p()])
  })
  await render()
  await input("#filtro-data-inicio", "2026-11-04")
  await input("#filtro-data-fim", "2026-11-05")
  assert.ok(
    urls.some(
      (u) =>
        u.includes("criadoEmInicio=2026-11-04") &&
        u.includes("criadoEmFim=2026-11-05")
    )
  )
  assert.match(texto(), /Nome histórico/)
  const antes = urls.length
  await input("#filtro-busca", "inexistente")
  assert.match(texto(), /Nenhum pedido encontrado/)
  assert.equal(urls.length, antes)
})
test("falha de pedidos não exibe métricas zero, refetch recupera e vazio é explícito", async () => {
  let falhar = true
  fetchMock(async (url) =>
    String(url).includes("dispositivos")
      ? json({ dispositivos: [] })
      : falhar
        ? json({}, 503)
        : json([])
  )
  await render()
  assert.match(texto(), /503/)
  assert.match(texto(), /Indisponível/)
  assert.doesNotMatch(texto(), /0 registros/)
  falhar = false
  await act(async () => botao("Tentar novamente").click())
  assert.match(texto(), /Nenhum pedido registrado/)
})
test("detalhe carrega snapshot; fechar durante GET descarta resposta pendente", async () => {
  let resolver!: (r: Response) => void
  fetchMock(async (url) =>
    String(url).includes("dispositivos")
      ? json({ dispositivos: [] })
      : String(url).includes("/pedidos/p")
        ? new Promise((r) => (resolver = r))
        : json([p()])
  )
  await render()
  await act(async () => botao("Inspecionar").click())
  assert.ok(document.querySelector('[role="dialog"]'))
  const fechar = document.querySelector<HTMLButtonElement>(
    '[data-slot="dialog-close"]'
  )!
  await act(async () => fechar.click())
  await act(async () => resolver(json(p())))
  assert.equal(document.querySelector('[role="dialog"]'), null)
})

test("loading e troca de tenant desmontam pedido antigo ainda pendente", async () => {
  let resolver!: (r: Response) => void
  let signalAntigo: AbortSignal | undefined
  fetchMock(async (url, init) =>
    String(url).includes("dispositivos")
      ? json({ dispositivos: [] })
      : new Promise((r) => {
          resolver = r
          signalAntigo = init?.signal ?? undefined
        })
  )
  await render()
  assert.ok(container.querySelector('[data-slot="skeleton"]'))
  assert.doesNotMatch(texto(), /Nenhum pedido registrado/)
  fetchMock(async (url, init) => {
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer humano-b"
    )
    return String(url).includes("dispositivos")
      ? json({ dispositivos: [] })
      : json([p("b", { negocioId: "b", nomeCliente: "Cliente B" })])
  })
  await act(async () =>
    root.render(
      <HistoricoPedidosPage
        key="b:humano-b"
        user={{ ...usuario, negocioId: "b" }}
        token="humano-b"
        logout={() => {}}
      />
    )
  )
  assert.equal(signalAntigo?.aborted, true)
  await act(async () =>
    resolver(json([p("a", { nomeCliente: "Cliente A privado" })]))
  )
  assert.match(texto(), /Cliente B/)
  assert.doesNotMatch(texto(), /Cliente A privado/)
})
test("detalhe carregado preserva snapshots; 404 é erro e não detalhe vazio", async () => {
  let falhar = false
  fetchMock(async (url) =>
    String(url).includes("dispositivos")
      ? json({ dispositivos: [] })
      : String(url).includes("/pedidos/p")
        ? falhar
          ? json({}, 404)
          : json(p())
        : json([p()])
  )
  await render()
  await act(async () => botao("Inspecionar").click())
  assert.match(
    document.querySelector('[role="dialog"]')?.textContent ?? "",
    /Nome histórico/
  )
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!
      .click()
  )
  falhar = true
  await act(async () => botao("Inspecionar").click())
  assert.match(
    document.querySelector('[role="dialog"]')?.textContent ?? "",
    /404/
  )
})

test("busca aceita a senha formatada anunciada no campo", async () => {
  fetchMock(async (url) =>
    String(url).includes("dispositivos")
      ? json({ dispositivos: [] })
      : json([p("senha14", { senha: 14, nomeCliente: "Cliente catorze" })])
  )
  await render()
  await input("#filtro-busca", "#014")
  assert.match(texto(), /Cliente catorze/)
})
