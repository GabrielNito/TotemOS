import { beforeAll, afterAll, afterEach, expect, test } from "bun:test"
import React, { act } from "react"
import { Window } from "happy-dom"
import type { Root } from "react-dom/client"
import type { UserSession } from "../lib/auth"
let Assistente: typeof import("../app/admin/configuracao-inicial/page").AssistenteConfiguracao
const win = new Window({ url: "http://localhost:3000" })
const originais = new Map<string, PropertyDescriptor | undefined>()
const originalFetch = globalThis.fetch
let root: Root
let container: HTMLDivElement
const user: UserSession = {
  id: "u-a",
  negocioId: "a",
  negocioNome: "Loja A",
  nome: "Dona A",
  email: "a@example.test",
  role: "DONO",
}
beforeAll(async () => {
  for (const [key, value] of Object.entries({
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Element: win.Element,
    Node: win.Node,
    IntersectionObserver: win.IntersectionObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originais.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
  Assistente = (await import("../app/admin/configuracao-inicial/page"))
    .AssistenteConfiguracao
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  container?.remove()
  globalThis.fetch = originalFetch
  win.localStorage.clear()
})
afterAll(() => {
  for (const [key, desc] of originais) {
    if (desc) Object.defineProperty(globalThis, key, desc)
    else Reflect.deleteProperty(globalThis, key)
  }
  void win.happyDOM.close()
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
function mock(
  handler: (url: string, options?: RequestInit) => Promise<Response>
) {
  globalThis.fetch = Object.assign(
    (url: string | URL | Request, options?: RequestInit) =>
      handler(String(url), options),
    { preconnect: originalFetch.preconnect }
  ) as typeof fetch
}
async function render(usuario = user, token = "teste-a") {
  if (!container) {
    container = document.createElement("div")
    document.body.appendChild(container)
  } else if (!container.isConnected) document.body.appendChild(container)
  const { createRoot } = await import("react-dom/client")
  root = createRoot(container)
  await act(async () =>
    root.render(<Assistente user={usuario} token={token} />)
  )
}
const texto = () => container.textContent ?? ""
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text)
  )!
test("negócio novo: checklist real, navegação focável, status acessíveis e sem salvamento", async () => {
  const methods: string[] = []
  mock(async (url, options) => {
    methods.push(options?.method ?? "GET")
    return json(
      url.endsWith("catalogo/admin")
        ? { categorias: [], produtos: [] }
        : { dispositivos: [] }
    )
  })
  await render()
  expect(texto()).toContain("Loja A")
  expect(texto()).toContain("1 etapa pronta")
  expect(texto()).toContain("2 pendentes")
  const etapas = container.querySelectorAll<HTMLButtonElement>(
    "button[aria-controls='conteudo-etapa']"
  )
  expect(etapas).toHaveLength(4)
  etapas[2].focus()
  expect(document.activeElement).toBe(etapas[2])
  await act(async () => etapas[2].click())
  expect(etapas[2].getAttribute("aria-pressed")).toBe("true")
  expect(texto()).toContain("Configurações operacionais aguardando integração")
  expect(container.querySelector("a[href='/admin/configuracoes']")).toBeNull()
  expect(container.querySelector("[role='status']")).not.toBeNull()
  expect(container.querySelector("form")).toBeNull()
  expect(win.localStorage.length).toBe(0)
  expect(methods.every((m) => m === "GET")).toBe(true)
})
test("erro parcial oferece refetch; cadastro não afirma conectividade", async () => {
  let falhar = true
  mock(async (url) =>
    url.endsWith("catalogo/admin")
      ? json({ categorias: [], produtos: [] })
      : falhar
        ? json({ message: "segredo" }, 503)
        : json({ dispositivos: [] })
  )
  await render()
  expect(texto()).toContain("Erro")
  await act(async () => button("Equipamentos").click())
  expect(container.querySelector("[role='alert']")?.textContent).toContain(
    "503"
  )
  falhar = false
  await act(async () => button("Tentar novamente").click())
  expect(texto()).toContain("Falta cadastrar um Totem e um Painel KDS")
  expect(texto()).toContain("Conectividade não informada")
  expect(texto()).not.toMatch(/online|sincronizadas|100%/i)
  expect(
    container.querySelector("a[href='/admin/dispositivos']")
  ).not.toBeNull()
})
test("troca de sessão remove dados do tenant anterior antes da resposta nova", async () => {
  mock(async (url) =>
    json(
      url.endsWith("catalogo/admin")
        ? { categorias: [], produtos: [] }
        : { dispositivos: [] }
    )
  )
  await render()
  mock(() => new Promise(() => {}))
  await act(async () =>
    root.render(
      <Assistente
        user={{ ...user, negocioId: "b", id: "u-b", negocioNome: "Loja B" }}
        token="teste-b"
      />
    )
  )
  expect(texto()).not.toContain("Loja A")
  expect(texto()).toContain("Loja B")
  expect(texto()).toContain("Carregando")
})
test("401 invalida estabelecimento e fontes sem mostrar conteúdo anterior", async () => {
  mock(async () => json({ message: "segredo" }, 401))
  await render()
  expect(texto()).not.toContain("Loja A")
  expect(texto()).toContain("Entre novamente")
  expect(container.querySelector("a[href='/login']")).not.toBeNull()
})

test("403 permite encerrar a sessão antes de trocar de conta", async () => {
  let encerrada = false
  mock(async () => json({ message: "negado" }, 403))
  await render()
  await act(async () =>
    root.render(
      <Assistente
        user={user}
        token="sessao-403"
        onSessaoExpirada={() => {
          encerrada = true
        }}
      />
    )
  )
  const trocar = button("Trocar conta")
  expect(trocar).toBeDefined()
  await act(async () => trocar.click())
  expect(encerrada).toBe(true)
})
