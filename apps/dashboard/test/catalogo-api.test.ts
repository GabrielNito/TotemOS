import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"

import {
  createCategoria,
  createProduto,
  deactivateProduto,
  getCatalogoAdministrativo,
  updateCategoria,
  updateProduto,
} from "../lib/api"
import { ProdutoFormSchema } from "../lib/schemas/catalogo"

const fetchOriginal = globalThis.fetch

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

function respostaJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("integração do catálogo no Dashboard", () => {
  test("valida os campos do produto e dos adicionais antes do envio", () => {
    const resultado = ProdutoFormSchema.safeParse({
      nome: "X-Bacon",
      precoBase: 25,
      tempoEstimadoPreparo: 0,
      categoriaId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      ativo: true,
      adicionais: [{ nome: "Bacon", preco: 4, maximo: 2, esgotado: false }],
    })

    assert.equal(resultado.success, true)
    assert.equal(
      ProdutoFormSchema.safeParse({
        nome: "X-Bacon",
        precoBase: 0,
        tempoEstimadoPreparo: -1,
        categoriaId: "categoria-invalida",
        ativo: true,
        adicionais: [],
      }).success,
      false
    )
  })

  test("lista o catálogo administrativo e converte preços serializados", async () => {
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
        categorias: [],
        produtos: [
          {
            id: "produto-1",
            negocioId: "negocio-1",
            categoriaId: "categoria-1",
            categoria: { id: "categoria-1", nome: "Lanches" },
            nome: "X-Bacon",
            precoBase: "25.90",
            tempoEstimadoPreparo: 12,
            esgotado: false,
            ativo: true,
            adicionais: [
              {
                id: "adicional-1",
                produtoId: "produto-1",
                nome: "Bacon",
                preco: "4.00",
                maximo: 2,
                esgotado: false,
              },
            ],
          },
        ],
      })
    }

    const catalogo = await getCatalogoAdministrativo()

    assert.deepEqual(chamadas, [
      {
        url: "http://localhost:3001/catalogo/admin",
        method: "GET",
        cache: "no-store",
      },
    ])
    assert.equal(catalogo.produtos[0]?.precoBase, 25.9)
    assert.equal(catalogo.produtos[0]?.adicionais?.[0]?.preco, 4)
  })

  test("envia as mutações para as rotas administrativas correspondentes", async () => {
    const chamadas: Array<{
      url: string
      method?: string
      body?: string
      contentType: string | null
    }> = []
    globalThis.fetch = async (input, init) => {
      chamadas.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : undefined,
        contentType: new Headers(init?.headers).get("content-type"),
      })

      if (init?.method === "DELETE") {
        return respostaJson({ id: "produto-1", nome: "X-Bacon", ativo: false })
      }

      if (String(input).endsWith("/categorias")) {
        return respostaJson({ id: "categoria-1", nome: "Lanches", ordem: 1 })
      }

      return respostaJson({
        id: "produto-1",
        negocioId: "negocio-1",
        categoriaId: "categoria-1",
        nome: "X-Bacon",
        precoBase: "25.90",
        tempoEstimadoPreparo: 12,
        esgotado: false,
        ativo: true,
        adicionais: [],
      })
    }

    await createCategoria({ nome: "Lanches", ordem: 1 })
    await updateCategoria("categoria-1", { ativo: false })
    await createProduto({
      categoriaId: "categoria-1",
      nome: "X-Bacon",
      precoBase: 25.9,
      tempoEstimadoPreparo: 12,
      ativo: true,
      adicionais: [],
    })
    await updateProduto("produto-1", { ativo: false })
    await deactivateProduto("produto-1")

    assert.deepEqual(
      chamadas.map(({ url, method, body, contentType }) => ({
        url,
        method,
        body,
        contentType,
      })),
      [
        {
          url: "http://localhost:3001/catalogo/categorias",
          method: "POST",
          body: JSON.stringify({ nome: "Lanches", ordem: 1 }),
          contentType: "application/json",
        },
        {
          url: "http://localhost:3001/catalogo/categorias/categoria-1",
          method: "PUT",
          body: JSON.stringify({ ativo: false }),
          contentType: "application/json",
        },
        {
          url: "http://localhost:3001/catalogo/produtos",
          method: "POST",
          body: JSON.stringify({
            categoriaId: "categoria-1",
            nome: "X-Bacon",
            precoBase: 25.9,
            tempoEstimadoPreparo: 12,
            ativo: true,
            adicionais: [],
          }),
          contentType: "application/json",
        },
        {
          url: "http://localhost:3001/catalogo/produtos/produto-1",
          method: "PUT",
          body: JSON.stringify({ ativo: false }),
          contentType: "application/json",
        },
        {
          url: "http://localhost:3001/catalogo/produtos/produto-1",
          method: "DELETE",
          body: undefined,
          contentType: null,
        },
      ]
    )
  })
})
