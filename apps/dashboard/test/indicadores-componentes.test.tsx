import * as React from "react"
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test"
import { Window } from "happy-dom"
import { act } from "react"
import type { Root } from "react-dom/client"
import { ChartSplineMetric } from "../components/dashboard/chart-spline-metric"
import { ChartPillBars } from "../components/dashboard/chart-pill-bars"
let VisaoGeral: typeof import("../app/admin/page").VisaoGeral

let root: Root
let container: HTMLDivElement
const win = new Window({ url: "http://localhost:3000" })
const originais = new Map<string, PropertyDescriptor | undefined>()
const fetchOriginal = globalThis.fetch
beforeAll(async () => {
  const globals = {
    window: win,
    IntersectionObserver: win.IntersectionObserver,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Element: win.Element,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    originais.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
  VisaoGeral = (await import("../app/admin/page")).VisaoGeral
})
afterEach(async () => {
  if (root)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
      root.unmount()
    })
  container?.remove()
  globalThis.fetch = fetchOriginal
})
afterAll(() => {
  for (const [key, descriptor] of originais) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
  void win.happyDOM.close()
})
async function render(element: React.ReactNode) {
  const { createRoot } = await import("react-dom/client")
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(element))
}
const texto = () => container.textContent ?? ""
const botao = (label: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === label
  )!
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
const p = (negocioId = "a", overrides = {}) => ({
  id: "p",
  negocioId,
  senha: null,
  dataSequencial: "1999-01-01",
  status: "PENDENTE",
  valorTotal: "12.35",
  origemOffline: false,
  demo: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  itens: [],
  ...overrides,
})

test("spline vazio e indisponível não gera SVG nem moeda fictícia", async () => {
  await render(<ChartSplineMetric data={[]} />)
  expect(texto()).toContain("Nenhum pedido registrado")
  expect(container.querySelector("svg")).toBeNull()
  await act(async () => root.render(<ChartSplineMetric />))
  expect(texto()).toContain("Indisponível".toLowerCase())
  expect(texto()).not.toMatch(/R\$|0%|Meta/)
})
test("spline um ponto, seleção, hover, refetch e série menor permanecem finitos", async () => {
  await render(<ChartSplineMetric data={[{ label: "00h", value: 1 }]} />)
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  await act(async () =>
    root.render(
      <ChartSplineMetric
        data={[
          { label: "00h", value: 1 },
          { label: "01h", value: 7 },
        ]}
      />
    )
  )
  const segundo = container.querySelector<HTMLButtonElement>(
    '[aria-label="01h: 7 pedidos"]'
  )!
  await act(async () => segundo.click())
  expect(segundo.getAttribute("aria-pressed")).toBe("true")
  expect(container.querySelector("[aria-live]")?.textContent).toContain(
    "7 pedidos"
  )
  const svg = container.querySelector("svg")!
  svg.getBoundingClientRect = () => ({ left: 0, width: 460 }) as DOMRect
  await act(async () =>
    svg.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 25 })
    )
  )
  expect(container.querySelector("[aria-live]")?.textContent).toContain(
    "1 pedidos"
  )
  await act(async () =>
    root.render(<ChartSplineMetric data={[{ label: "novo", value: 9 }]} />)
  )
  expect(container.querySelector("[aria-live]")?.textContent).toContain(
    "9 pedidos"
  )
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
})
test("barras vazias sem atividade; dados possuem foco e contagens acessíveis", async () => {
  await render(<ChartPillBars data={[]} descricao="Sem DEMO" />)
  expect(texto()).toContain("Nenhum pedido registrado")
  expect(container.querySelector('[tabindex="0"]')).toBeNull()
  await act(async () =>
    root.render(
      <ChartPillBars
        data={[{ time: "10h", orders: 3, percentage: 100 }]}
        descricao="Sem DEMO"
      />
    )
  )
  const hora = container.querySelector<HTMLElement>('[tabindex="0"]')!
  hora.focus()
  expect(document.activeElement).toBe(hora)
  expect(hora.getAttribute("aria-label")).toBe("10h: 3 pedidos")
})
test("visão geral troca período e DEMO, mantém valor nominal, e falha parcial não vira zero dispositivos", async () => {
  const chamadas: string[] = []
  globalThis.fetch = Object.assign(
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      chamadas.push(String(input))
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer humano-a"
      )
      return String(input).includes("dispositivos")
        ? json({}, 503)
        : json([p(), p("a", { id: "demo", demo: true, valorTotal: "999.99" })])
    },
    { preconnect: fetchOriginal.preconnect }
  )
  await render(<VisaoGeral negocioId="a" token="humano-a" nome="Loja A" />)
  expect(texto()).toContain("Serviço indisponível (503)")
  expect(texto()).toContain("Cadastro indisponível")
  expect(texto()).toContain("12,35")
  expect(texto()).toContain("999,99")
  expect(texto()).not.toMatch(
    /Operação Conectada|vs ontem|0%|0s|Tempo médio: 0/
  )
  expect(
    chamadas.every(
      (url) => !url.includes("negocioId") && !url.includes("dataSequencial")
    )
  ).toBe(true)
  await act(async () => botao("Semana").click())
  expect(botao("Semana").getAttribute("aria-pressed")).toBe("true")
  const checkbox = container.querySelector<HTMLInputElement>(
    'input[type="checkbox"]'
  )!
  await act(async () => checkbox.click())
  expect(texto()).toContain("Comerciais e DEMO")
  expect(texto()).toContain("Inclui DEMO identificados")
})
test("troca de identidade desmonta snapshot anterior e não consulta outro tenant via parâmetro", async () => {
  globalThis.fetch = Object.assign(
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) =>
      String(input).includes("dispositivos")
        ? json({ dispositivos: [] })
        : json([
            p(
              (init?.headers as Record<string, string>).Authorization.endsWith(
                "b"
              )
                ? "b"
                : "a"
            ),
          ]),
    { preconnect: fetchOriginal.preconnect }
  )
  await render(<VisaoGeral key="a" negocioId="a" token="a" nome="Loja A" />)
  expect(texto()).toContain("12,35")
  let responder!: (value: Response) => void
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0]) =>
      String(input).includes("dispositivos")
        ? json({ dispositivos: [] })
        : new Promise<Response>((r) => {
            responder = r
          }),
    { preconnect: fetchOriginal.preconnect }
  )
  await act(async () =>
    root.render(<VisaoGeral key="b" negocioId="b" token="b" nome="Loja B" />)
  )
  expect(texto()).not.toContain("12,35")
  expect(texto()).not.toContain("Loja A")
  await act(async () => responder(json([])))
  expect(texto()).toContain("Loja B")
})
test("refetch com erro preserva último snapshot marcado e não mostra números zerados", async () => {
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0]) =>
      String(input).includes("dispositivos")
        ? json({ dispositivos: [] })
        : json([p()]),
    { preconnect: fetchOriginal.preconnect }
  )
  await render(<VisaoGeral negocioId="a" token="a" nome="A" />)
  globalThis.fetch = Object.assign(async () => json({}, 429), {
    preconnect: fetchOriginal.preconnect,
  })
  await act(async () => botao("Atualizar").click())
  expect(texto()).toContain("12,35")
  expect(texto()).toContain("Dados desatualizados")
  expect(texto()).toContain("Limite de requisições (429)")
})

test("401 no refetch remove ambos os snapshots e oferece encerramento seguro da sessão", async () => {
  let encerramentos = 0
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0]) =>
      String(input).includes("dispositivos")
        ? json({ dispositivos: [] })
        : json([p()]),
    { preconnect: fetchOriginal.preconnect }
  )
  await render(
    <VisaoGeral
      negocioId="a"
      token="a"
      nome="A"
      onReautenticar={() => encerramentos++}
    />
  )
  expect(texto()).toContain("12,35")
  globalThis.fetch = Object.assign(
    async () => json({ message: "payload privado" }, 401),
    { preconnect: fetchOriginal.preconnect }
  )
  await act(async () => botao("Atualizar").click())
  expect(texto()).not.toContain("12,35")
  expect(texto()).not.toContain("payload privado")
  await act(async () => botao("Entrar novamente").click())
  expect(encerramentos).toBe(1)
})
test("loading não é erro nem uma métrica zero", async () => {
  let responder!: (r: Response) => void
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0]) =>
      String(input).includes("dispositivos")
        ? json({ dispositivos: [] })
        : new Promise<Response>((r) => {
            responder = r
          }),
    { preconnect: fetchOriginal.preconnect }
  )
  await render(<VisaoGeral negocioId="a" token="a" nome="A" />)
  expect(
    container.querySelector('[aria-label="Carregando indicadores"]')
  ).not.toBeNull()
  expect(texto()).not.toContain("Indicador indisponível")
  await act(async () => responder(json([])))
  expect(texto()).toContain("Nenhum pedido registrado no período")
})
