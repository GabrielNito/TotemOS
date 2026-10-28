import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"

import {
  ApiError,
  gerarCodigoPareamento,
  getDispositivos,
  revogarDispositivo,
} from "../lib/api"

const fetchOriginal = globalThis.fetch

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

function respostaJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("integração de dispositivos no Dashboard", () => {
  test("lista dispositivos do negócio sem enviar negocioId pelo cliente", async () => {
    const chamadas: Array<{
      url: string
      method?: string
      cache?: RequestInit["cache"]
    }> = []

    globalThis.fetch = async (input, init) => {
      chamadas.push({
        url: String(input),
        method: init?.method,
        cache: init?.cache,
      })

      return respostaJson({
        dispositivos: [
          {
            id: "device-1",
            negocioId: "business-1",
            nome: "Totem entrada",
            tipo: "TOTEM",
            pareadoEm: "2026-10-28T12:00:00.000Z",
            ativo: true,
            revogadoEm: null,
            createdAt: "2026-10-28T12:00:00.000Z",
          },
        ],
      })
    }

    const response = await getDispositivos()

    assert.deepEqual(chamadas, [
      {
        url: "http://localhost:3001/dispositivos",
        method: "GET",
        cache: "no-store",
      },
    ])
    assert.equal(response.dispositivos[0]?.id, "device-1")
    assert.equal(response.dispositivos[0]?.ativo, true)
  })

  test("solicita ao backend um código para o tipo e nome selecionados", async () => {
    const chamadas: Array<{
      url: string
      method?: string
      body?: string
    }> = []

    globalThis.fetch = async (input, init) => {
      chamadas.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : undefined,
      })

      return respostaJson(
        {
          codigo: "004219",
          expiraEm: "2026-10-28T12:15:00.000Z",
        },
        201
      )
    }

    const response = await gerarCodigoPareamento({
      nome: "Totem entrada",
      tipo: "TOTEM",
    })

    assert.deepEqual(chamadas, [
      {
        url: "http://localhost:3001/dispositivos/parear/codigo",
        method: "POST",
        body: JSON.stringify({ nome: "Totem entrada", tipo: "TOTEM" }),
      },
    ])
    assert.equal(response.codigo, "004219")
    assert.equal(response.expiraEm, "2026-10-28T12:15:00.000Z")
  })

  test("revoga um dispositivo e aceita a resposta 204 sem corpo", async () => {
    let chamada: { url: string; method?: string } | undefined

    globalThis.fetch = async (input, init) => {
      chamada = { url: String(input), method: init?.method }
      return new Response(null, { status: 204 })
    }

    await revogarDispositivo("device-1")

    assert.deepEqual(chamada, {
      url: "http://localhost:3001/dispositivos/device-1",
      method: "DELETE",
    })
  })

  test("preserva ApiError retornado pelo backend", async () => {
    globalThis.fetch = async () =>
      respostaJson({ message: "Apenas DONO pode gerar códigos." }, 403)

    await assert.rejects(
      () =>
        gerarCodigoPareamento({
          nome: "Painel cozinha",
          tipo: "PAINEL",
        }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.statusCode, 403)
        assert.equal(error.message, "Apenas DONO pode gerar códigos.")
        return true
      }
    )
  })
})
