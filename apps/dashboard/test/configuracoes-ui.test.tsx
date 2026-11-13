import { afterAll, afterEach, beforeAll, expect, test } from "bun:test"
import React, { act } from "react"
import { Window } from "happy-dom"
import type { Root } from "react-dom/client"
import type { UserSession } from "../lib/auth"
import type { ConfiguracaoNegocio } from "../lib/types/models"

let PainelConfiguracoes: typeof import("../app/admin/configuracoes/page").PainelConfiguracoes

const win = new Window({ url: "http://localhost:3000" })
const originais = new Map<string, PropertyDescriptor | undefined>()
const originalFetch = globalThis.fetch
let root: Root
let container: HTMLDivElement

const donoUser: UserSession = {
  id: "u-dono",
  negocioId: "tenant-a",
  negocioNome: "Cafeteria Alpha",
  nome: "Caio Dono",
  email: "dono@alpha.test",
  role: "DONO",
}

const gerenteUser: UserSession = {
  id: "u-gerente",
  negocioId: "tenant-a",
  negocioNome: "Cafeteria Alpha",
  nome: "Ana Gerente",
  email: "gerente@alpha.test",
  role: "GERENTE",
}

const configInicial: ConfiguracaoNegocio = {
  negocioId: "tenant-a",
  modoIdentificacao: "NOME",
  tempoPadraoPreparo: 22,
  mensagemBoasVindas: "Olá da Cafeteria Alpha",
  permitirPagamentoOffline: false,
  pagamentoOfflineOperacional: false,
  pagamentoOfflineStatus: "NAO_OPERACIONAL",
}

beforeAll(async () => {
  for (const [key, value] of Object.entries({
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Element: win.Element,
    Node: win.Node,
    HTMLInputElement: win.HTMLInputElement,
    Event: win.Event,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    MutationObserver: win.MutationObserver,
    ResizeObserver: win.ResizeObserver,
    IntersectionObserver: win.IntersectionObserver,
    getComputedStyle: win.getComputedStyle.bind(win),
    requestAnimationFrame: win.requestAnimationFrame.bind(win),
    cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originais.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }
  PainelConfiguracoes = (await import("../app/admin/configuracoes/page"))
    .PainelConfiguracoes
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
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

function mockFetch(
  handler: (url: string, options?: RequestInit) => Promise<Response>
) {
  globalThis.fetch = Object.assign(
    (url: string | URL | Request, options?: RequestInit) =>
      handler(String(url), options),
    { preconnect: originalFetch.preconnect }
  ) as typeof fetch
}

async function render(
  usuario: UserSession = donoUser,
  token = "jwt-dono",
  onSessaoExpirada?: () => void
) {
  if (!container) {
    container = document.createElement("div")
    document.body.appendChild(container)
  } else if (!container.isConnected) {
    document.body.appendChild(container)
  }
  const { createRoot } = await import("react-dom/client")
  root = createRoot(container)
  await act(async () =>
    root.render(
      <PainelConfiguracoes
        user={usuario}
        token={token}
        onSessaoExpirada={onSessaoExpirada}
        sessaoAtual={() => true}
      />
    )
  )
}

const texto = () => container.textContent ?? ""
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text)
  )!

async function setInputValue(selector: string, value: string) {
  const el = container.querySelector<HTMLInputElement>(selector)!
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

async function submitForm(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(
      new win.Event("submit", {
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    )
  })
}

test("carrega valores reais do backend, mostra offline não operacional e salva alterações com PIN do dono", async () => {
  let estadoServidor = { ...configInicial }
  const calls: Array<{ method: string; url: string; body?: string }> = []

  mockFetch(async (url, options) => {
    const method = options?.method ?? "GET"
    calls.push({
      method,
      url,
      body: typeof options?.body === "string" ? options.body : undefined,
    })

    if (url.endsWith("/negocio/config") && method === "GET") {
      return json(estadoServidor)
    }

    if (url.endsWith("/negocio/config") && method === "PATCH") {
      const payload = JSON.parse(String(options?.body)) as {
        pin: string
        modoIdentificacao: ConfiguracaoNegocio["modoIdentificacao"]
        tempoPadraoPreparo: number
        mensagemBoasVindas: string | null
      }
      estadoServidor = {
        ...estadoServidor,
        modoIdentificacao: payload.modoIdentificacao,
        tempoPadraoPreparo: payload.tempoPadraoPreparo,
        mensagemBoasVindas: payload.mensagemBoasVindas,
      }
      return json(estadoServidor)
    }

    return json({ message: "Not found" }, 404)
  })

  await render()

  expect(
    calls.some((c) => c.method === "GET" && c.url.endsWith("/negocio/config"))
  ).toBe(true)
  expect(texto()).toContain("Não operacional no P0")
  // Offline não deve ter switch interativo editável
  expect(container.querySelector("[role='switch']")).toBeNull()

  const inputTempo = container.querySelector<HTMLInputElement>(
    "#tempoPadraoPreparo"
  )!
  const inputBoasVindas = container.querySelector<HTMLInputElement>(
    "#mensagemBoasVindas"
  )!
  expect(inputTempo.value).toBe("22")
  expect(inputBoasVindas.value).toBe("Olá da Cafeteria Alpha")

  const radioCodigo = container.querySelector<HTMLInputElement>(
    "input[type='radio'][value='CODIGO']"
  )!
  await act(async () => {
    radioCodigo.click()
  })
  await setInputValue("#tempoPadraoPreparo", "35")
  await setInputValue("#mensagemBoasVindas", "Retire pelo código")
  await setInputValue("#pinConfirmacaoConfig", "1234")

  const form = container.querySelector<HTMLFormElement>(
    "form[data-testid='form-config-operacao']"
  )!
  await submitForm(form)

  const patch = calls.find((c) => c.method === "PATCH")
  expect(patch).toBeDefined()
  expect(JSON.parse(patch!.body!)).toEqual({
    pin: "1234",
    modoIdentificacao: "CODIGO",
    tempoPadraoPreparo: 35,
    mensagemBoasVindas: "Retire pelo código",
  })

  // Campo de PIN deve ser limpo após o envio e mensagem de sucesso exibida
  const pinInput = container.querySelector<HTMLInputElement>(
    "#pinConfirmacaoConfig"
  )!
  expect(pinInput.value).toBe("")
  expect(texto()).toContain("Configurações salvas no servidor.")

  // Recarregar confirma estado persistido no backend
  await setInputValue("#tempoPadraoPreparo", "99")
  await act(async () => {
    button("Recarregar configurações").click()
  })
  expect(
    container.querySelector<HTMLInputElement>("#tempoPadraoPreparo")!.value
  ).toBe("35")
})

test("GERENTE vê configurações em modo somente leitura e não dispara PATCH", async () => {
  let patchChamado = false
  mockFetch(async (_url, options) => {
    if (options?.method === "PATCH") {
      patchChamado = true
      return json({ message: "Forbidden" }, 403)
    }
    return json(configInicial)
  })

  await render(gerenteUser, "jwt-gerente")

  expect(texto()).toContain("somente leitura")
  expect(
    container.querySelector<HTMLInputElement>("#tempoPadraoPreparo")!.disabled
  ).toBe(true)
  expect(
    container.querySelector<HTMLInputElement>("#mensagemBoasVindas")!.disabled
  ).toBe(true)
  expect(container.querySelector("#pinConfirmacaoConfig")).toBeNull()
  expect(patchChamado).toBe(false)
})

test("rejeita formulário inválido sem chamar API e preserva edição quando PATCH retorna 401", async () => {
  let patchCount = 0
  mockFetch(async (url, options) => {
    if (
      url.endsWith("/negocio/config") &&
      (options?.method ?? "GET") === "GET"
    ) {
      return json(configInicial)
    }
    if (url.endsWith("/negocio/config") && options?.method === "PATCH") {
      patchCount++
      return json({ message: "PIN do dono inválido." }, 401)
    }
    return json({}, 404)
  })

  await render()
  await setInputValue("#tempoPadraoPreparo", "150")
  await setInputValue("#pinConfirmacaoConfig", "12")

  const form = container.querySelector<HTMLFormElement>(
    "form[data-testid='form-config-operacao']"
  )!
  await submitForm(form)

  expect(patchCount).toBe(0)
  expect(container.querySelector("[role='alert']")).not.toBeNull()

  // Com dados válidos no form e PIN rejeitado pelo backend (401), mantém o tempo editado
  await setInputValue("#tempoPadraoPreparo", "45")
  await setInputValue("#pinConfirmacaoConfig", "9999")
  await submitForm(form)

  expect(patchCount).toBe(1)
  expect(
    container.querySelector<HTMLInputElement>("#tempoPadraoPreparo")!.value
  ).toBe("45")
  expect(container.querySelector("[role='alert']")?.textContent).toContain(
    "PIN"
  )
})

test("abas Equipe e Segurança não simulam criação de usuários nem alteração falsa de PIN e integram /auth/validar-pin", async () => {
  let pinValidadoChamado = false
  mockFetch(async (url, options) => {
    if (url.endsWith("/negocio/config")) {
      return json(configInicial)
    }
    if (url.endsWith("/auth/validar-pin") && options?.method === "POST") {
      pinValidadoChamado = true
      return json({ valido: true })
    }
    return json({}, 404)
  })

  await render()

  await act(async () => {
    button("Equipe").click()
  })
  expect(texto()).toContain("Caio Dono")
  expect(texto()).toContain("dono@alpha.test")
  expect(texto()).toContain("Indisponível no P0")
  expect(texto()).not.toContain("Adicionar Usuário")

  await act(async () => {
    button("PIN & Segurança").click()
  })
  expect(texto()).toContain("Alteração indisponível no P0")
  expect(texto()).not.toContain("Atualizar PIN do Dono")

  await setInputValue("#pinValidacaoAtual", "1234")
  const formPin = container.querySelector<HTMLFormElement>(
    "form[data-testid='form-validar-pin']"
  )!
  await submitForm(formPin)

  expect(pinValidadoChamado).toBe(true)
  expect(texto()).toContain("PIN válido")
  expect(
    container.querySelector<HTMLInputElement>("#pinValidacaoAtual")!.value
  ).toBe("")
})

test("401 na leitura e troca de tenant removem dados anteriores", async () => {
  let expirou = false
  mockFetch(async () => json(configInicial))
  await render(donoUser, "token-a", () => {
    expirou = true
  })
  expect(
    container.querySelector<HTMLInputElement>("#mensagemBoasVindas")!.value
  ).toBe("Olá da Cafeteria Alpha")

  mockFetch(async () => json({ message: "Token expirado" }, 401))
  await act(async () =>
    root.render(
      <PainelConfiguracoes
        user={{
          ...donoUser,
          id: "u-b",
          negocioId: "tenant-b",
          negocioNome: "Loja B",
        }}
        token="token-b"
        onSessaoExpirada={() => {
          expirou = true
        }}
        sessaoAtual={() => true}
      />
    )
  )

  expect(expirou).toBe(true)
  expect(container.querySelector("#mensagemBoasVindas")).toBeNull()
  expect(texto()).toContain("Não foi possível validar o acesso")
})
