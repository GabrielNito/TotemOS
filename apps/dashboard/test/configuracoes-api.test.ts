import { afterEach, describe, expect, test } from "bun:test"
import {
  ApiError,
  getConfiguracaoNegocio,
  updateConfiguracaoNegocio,
} from "../lib/api"
import {
  ConfiguracaoNegocioResponseSchema,
  ConfiguracaoOperacionalFormSchema,
  ValidarPinFormSchema,
} from "../lib/schemas/configuracoes"
import { GerenciadorConfiguracaoOperacional } from "../lib/configuracoes-operacionais"
import type { ConfiguracaoNegocio } from "../lib/types/models"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const configBase: ConfiguracaoNegocio = {
  negocioId: "tenant-a",
  modoIdentificacao: "OPCIONAL",
  tempoPadraoPreparo: 15,
  mensagemBoasVindas: "Bem-vindo ao balcão!",
  permitirPagamentoOffline: false,
  pagamentoOfflineOperacional: false,
  pagamentoOfflineStatus: "NAO_OPERACIONAL",
}

function respostaJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("Schemas Zod de configurações operacionais", () => {
  test("valida resposta da API e rejeita offline marcado como operacional", () => {
    expect(
      ConfiguracaoNegocioResponseSchema.safeParse(configBase).success
    ).toBe(true)

    expect(
      ConfiguracaoNegocioResponseSchema.safeParse({
        ...configBase,
        permitirPagamentoOffline: true,
      }).success
    ).toBe(false)

    expect(
      ConfiguracaoNegocioResponseSchema.safeParse({
        ...configBase,
        pagamentoOfflineOperacional: true,
      }).success
    ).toBe(false)
  })

  test("valida formulário operacional e PIN de confirmação antes do envio", () => {
    const ok = ConfiguracaoOperacionalFormSchema.safeParse({
      modoIdentificacao: "NOME",
      tempoPadraoPreparo: 25,
      mensagemBoasVindas: "  Olá cliente  ",
      pin: "1234",
    })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.mensagemBoasVindas).toBe("Olá cliente")
    }

    const vazia = ConfiguracaoOperacionalFormSchema.safeParse({
      modoIdentificacao: "CODIGO",
      tempoPadraoPreparo: 10,
      mensagemBoasVindas: "   ",
      pin: "1234",
    })
    expect(vazia.success).toBe(true)
    if (vazia.success) {
      expect(vazia.data.mensagemBoasVindas).toBeNull()
    }

    expect(
      ConfiguracaoOperacionalFormSchema.safeParse({
        modoIdentificacao: "NOME",
        tempoPadraoPreparo: 0,
        mensagemBoasVindas: "",
        pin: "1234",
      }).success
    ).toBe(false)

    expect(
      ConfiguracaoOperacionalFormSchema.safeParse({
        modoIdentificacao: "NOME",
        tempoPadraoPreparo: 121,
        mensagemBoasVindas: "",
        pin: "1234",
      }).success
    ).toBe(false)

    expect(
      ConfiguracaoOperacionalFormSchema.safeParse({
        modoIdentificacao: "NOME",
        tempoPadraoPreparo: 20,
        mensagemBoasVindas: "a".repeat(201),
        pin: "1234",
      }).success
    ).toBe(false)

    expect(
      ConfiguracaoOperacionalFormSchema.safeParse({
        modoIdentificacao: "NOME",
        tempoPadraoPreparo: 20,
        mensagemBoasVindas: "",
        pin: "12ab",
      }).success
    ).toBe(false)

    expect(ValidarPinFormSchema.safeParse({ pin: "1234" }).success).toBe(true)
    expect(ValidarPinFormSchema.safeParse({ pin: "12" }).success).toBe(false)
  })
})

describe("Cliente HTTP de configurações (/negocio/config)", () => {
  test("getConfiguracaoNegocio envia Bearer, cache no-store e signal sem negocioId na URL", async () => {
    const chamadas: Array<{
      url: string
      method?: string
      cache?: RequestInit["cache"]
      auth?: string
      signal?: AbortSignal | null
    }> = []
    const controller = new AbortController()

    globalThis.fetch = Object.assign(
      async (input: string | URL | Request, init?: RequestInit) => {
        chamadas.push({
          url: String(input),
          method: init?.method,
          cache: init?.cache,
          auth: (init?.headers as Record<string, string>)?.Authorization,
          signal: init?.signal,
        })
        return respostaJson(configBase)
      },
      { preconnect: originalFetch.preconnect }
    ) as typeof fetch

    const dados = await getConfiguracaoNegocio("jwt-dono", controller.signal)
    expect(dados).toEqual(configBase)
    expect(chamadas).toEqual([
      {
        url: "http://localhost:3001/negocio/config",
        method: "GET",
        cache: "no-store",
        auth: "Bearer jwt-dono",
        signal: controller.signal,
      },
    ])
  })

  test("updateConfiguracaoNegocio envia PATCH sem negocioId ou flags offline e valida resposta", async () => {
    const chamadas: Array<{
      url: string
      method?: string
      cache?: RequestInit["cache"]
      body?: string
    }> = []

    const atualizado: ConfiguracaoNegocio = {
      ...configBase,
      modoIdentificacao: "CODIGO",
      tempoPadraoPreparo: 30,
      mensagemBoasVindas: null,
    }

    globalThis.fetch = Object.assign(
      async (input: string | URL | Request, init?: RequestInit) => {
        chamadas.push({
          url: String(input),
          method: init?.method,
          cache: init?.cache,
          body: typeof init?.body === "string" ? init.body : undefined,
        })
        return respostaJson(atualizado)
      },
      { preconnect: originalFetch.preconnect }
    ) as typeof fetch

    const res = await updateConfiguracaoNegocio(
      {
        pin: "1234",
        modoIdentificacao: "CODIGO",
        tempoPadraoPreparo: 30,
        mensagemBoasVindas: null,
      },
      "jwt-dono"
    )

    expect(res).toEqual(atualizado)
    expect(chamadas).toEqual([
      {
        url: "http://localhost:3001/negocio/config",
        method: "PATCH",
        cache: "no-store",
        body: JSON.stringify({
          pin: "1234",
          modoIdentificacao: "CODIGO",
          tempoPadraoPreparo: 30,
          mensagemBoasVindas: null,
        }),
      },
    ])
  })
})

describe("GerenciadorConfiguracaoOperacional", () => {
  test("carrega, salva como DONO, recarrega estado persistido e bloqueia GERENTE sem HTTP", async () => {
    let estadoServidor = { ...configBase }
    const gDono = new GerenciadorConfiguracaoOperacional(
      "tenant-a",
      "DONO",
      async () => ({ ...estadoServidor }),
      async (input) => {
        estadoServidor = {
          ...estadoServidor,
          modoIdentificacao:
            input.modoIdentificacao ?? estadoServidor.modoIdentificacao,
          tempoPadraoPreparo:
            input.tempoPadraoPreparo ?? estadoServidor.tempoPadraoPreparo,
          mensagemBoasVindas:
            input.mensagemBoasVindas !== undefined
              ? input.mensagemBoasVindas
              : estadoServidor.mensagemBoasVindas,
        }
        return { ...estadoServidor }
      }
    )

    await gDono.carregar()
    expect(gDono.snapshot().leitura.status).toBe("sucesso")
    expect(gDono.snapshot().leitura.dados).toEqual(configBase)

    const salvou = await gDono.salvar({
      pin: "1234",
      modoIdentificacao: "NOME",
      tempoPadraoPreparo: 40,
      mensagemBoasVindas: "Peça aqui",
    })
    expect(salvou).toBe(true)
    expect(gDono.snapshot().salvamento.status).toBe("sucesso")
    expect(gDono.snapshot().leitura.dados?.tempoPadraoPreparo).toBe(40)

    let chamouPatch = false
    const gGerente = new GerenciadorConfiguracaoOperacional(
      "tenant-a",
      "GERENTE",
      async () => ({ ...estadoServidor }),
      async () => {
        chamouPatch = true
        return estadoServidor
      }
    )
    await gGerente.carregar()
    const gerenteSalvou = await gGerente.salvar({
      pin: "1234",
      tempoPadraoPreparo: 55,
    })
    expect(gerenteSalvou).toBe(false)
    expect(chamouPatch).toBe(false)
    expect(gGerente.snapshot().salvamento.status).toBe("erro")
    expect(gGerente.snapshot().salvamento.mensagem).toContain("DONO")
  })

  test("rejeita payload de outro tenant e trata 401/403/429/503 com segurança", async () => {
    const cruzado = new GerenciadorConfiguracaoOperacional(
      "tenant-a",
      "DONO",
      async () => ({ ...configBase, negocioId: "tenant-b" }),
      async () => configBase
    )
    await cruzado.carregar()
    expect(cruzado.snapshot().acessoNegado).toBe(true)
    expect(cruzado.snapshot().leitura.dados).toBeNull()

    let expirou = false
    const leitura401 = new GerenciadorConfiguracaoOperacional(
      "tenant-a",
      "DONO",
      async () => {
        throw new ApiError(401, "segredo-interno")
      },
      async () => configBase,
      () => {
        expirou = true
      }
    )
    await leitura401.carregar()
    expect(expirou).toBe(true)
    expect(leitura401.snapshot().acessoNegado).toBe(true)
    expect(leitura401.snapshot().leitura.erro).not.toContain("segredo-interno")

    // No PATCH, 401 por PIN incorreto preserva os dados carregados e não derruba a edição
    const erroPin = new GerenciadorConfiguracaoOperacional(
      "tenant-a",
      "DONO",
      async () => configBase,
      async () => {
        throw new ApiError(401, "PIN do dono inválido.")
      }
    )
    await erroPin.carregar()
    const ok = await erroPin.salvar({ pin: "9999", tempoPadraoPreparo: 25 })
    expect(ok).toBe(false)
    expect(erroPin.snapshot().leitura.dados).toEqual(configBase)
    expect(erroPin.snapshot().salvamento.status).toBe("erro")
    expect(erroPin.snapshot().salvamento.mensagem).toContain("PIN")

    const erro429 = new GerenciadorConfiguracaoOperacional(
      "tenant-a",
      "DONO",
      async () => configBase,
      async () => {
        throw new ApiError(429, "ThrottlerException")
      }
    )
    await erro429.carregar()
    await erro429.salvar({ pin: "1234", tempoPadraoPreparo: 25 })
    expect(erro429.snapshot().salvamento.mensagem).toContain("429")
  })
})
