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
import {
  calcularDiagnosticoPublicacao,
  filtrarCatalogoPublico,
} from "../lib/catalogo/regras-publicacao"
import type { Categoria, Produto } from "../lib/types/models"

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
    const categoriaValida = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    const resultado = ProdutoFormSchema.safeParse({
      nome: "X-Bacon",
      descricao: "Pão brioche, burger 160g e queijo",
      precoBase: 25,
      imagemUrl: "https://example.com/xbacon.png",
      tempoEstimadoPreparo: 0,
      categoriaId: categoriaValida,
      ativo: true,
      esgotado: false,
      adicionais: [
        {
          id: "11111111-2222-4333-8444-555555555555",
          nome: "Bacon",
          preco: 4,
          maximo: 2,
          esgotado: false,
        },
      ],
    })

    assert.equal(resultado.success, true)

    // Aceita imagemUrl vazia ou nula/omitida
    assert.equal(
      ProdutoFormSchema.safeParse({
        nome: "X-Salada",
        precoBase: 20,
        imagemUrl: "",
        tempoEstimadoPreparo: 5,
        categoriaId: categoriaValida,
        ativo: true,
        esgotado: false,
        adicionais: [],
      }).success,
      true
    )

    // Rejeita URL inválida
    assert.equal(
      ProdutoFormSchema.safeParse({
        nome: "X-Salada",
        precoBase: 20,
        imagemUrl: "url-invalida",
        tempoEstimadoPreparo: 5,
        categoriaId: categoriaValida,
        ativo: true,
        esgotado: false,
        adicionais: [],
      }).success,
      false
    )

    // Rejeita preço base zero ou negativo
    assert.equal(
      ProdutoFormSchema.safeParse({
        nome: "X-Bacon",
        precoBase: 0,
        tempoEstimadoPreparo: -1,
        categoriaId: "categoria-invalida",
        ativo: true,
        esgotado: false,
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
      descricao: "Pão brioche e carne",
      precoBase: 25.9,
      imagemUrl: "https://example.com/xbacon.png",
      tempoEstimadoPreparo: 12,
      esgotado: false,
      ativo: true,
      adicionais: [],
    })
    await updateProduto("produto-1", {
      descricao: "Pão artesanal",
      imagemUrl: null,
      esgotado: true,
      ativo: false,
    })
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
            descricao: "Pão brioche e carne",
            precoBase: 25.9,
            imagemUrl: "https://example.com/xbacon.png",
            tempoEstimadoPreparo: 12,
            esgotado: false,
            ativo: true,
            adicionais: [],
          }),
          contentType: "application/json",
        },
        {
          url: "http://localhost:3001/catalogo/produtos/produto-1",
          method: "PUT",
          body: JSON.stringify({
            descricao: "Pão artesanal",
            imagemUrl: null,
            esgotado: true,
            ativo: false,
          }),
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

  test("calcula a visibilidade exata do catálogo público no Totem", () => {
    const categorias: Categoria[] = [
      { id: "cat-1", negocioId: "n-1", nome: "Bebidas", ordem: 2, ativo: true },
      { id: "cat-2", negocioId: "n-1", nome: "Lanches", ordem: 1, ativo: true },
      { id: "cat-3", negocioId: "n-1", nome: "Sobremesas", ordem: 3, ativo: false },
      { id: "cat-4", negocioId: "n-1", nome: "Acompanhamentos", ordem: 4, ativo: true },
    ]

    const produtos: Produto[] = [
      // cat-2 (Lanches) - ativo=true, ordem 1
      {
        id: "prod-1",
        negocioId: "n-1",
        categoriaId: "cat-2",
        nome: "X-Bacon",
        precoBase: 25,
        tempoEstimadoPreparo: 10,
        ativo: true,
        esgotado: false,
        adicionais: [
          { id: "add-1", produtoId: "prod-1", nome: "Bacon extra", preco: 4, maximo: 2, esgotado: false },
          { id: "add-2", produtoId: "prod-1", nome: "Queijo extra", preco: 3, maximo: 2, esgotado: true },
        ],
      },
      {
        id: "prod-2",
        negocioId: "n-1",
        categoriaId: "cat-2",
        nome: "X-Burguer",
        precoBase: 20,
        tempoEstimadoPreparo: 10,
        ativo: true,
        esgotado: true, // esgotado -> não aparece no Totem
      },
      {
        id: "prod-3",
        negocioId: "n-1",
        categoriaId: "cat-2",
        nome: "X-Egg",
        precoBase: 22,
        tempoEstimadoPreparo: 10,
        ativo: false, // inativo -> não aparece no Totem
        esgotado: false,
      },
      // cat-1 (Bebidas) - ativo=true, ordem 2
      {
        id: "prod-4",
        negocioId: "n-1",
        categoriaId: "cat-1",
        nome: "Refrigerante",
        precoBase: 6,
        tempoEstimadoPreparo: 0,
        ativo: true,
        esgotado: false,
      },
      // cat-3 (Sobremesas) - categoria inativa -> não aparece
      {
        id: "prod-5",
        negocioId: "n-1",
        categoriaId: "cat-3",
        nome: "Sorvete",
        precoBase: 12,
        tempoEstimadoPreparo: 0,
        ativo: true,
        esgotado: false,
      },
      // cat-4 (Acompanhamentos) - categoria ativa, mas todos os produtos esgotados/inativos
      {
        id: "prod-6",
        negocioId: "n-1",
        categoriaId: "cat-4",
        nome: "Batata Frita",
        precoBase: 14,
        tempoEstimadoPreparo: 8,
        ativo: true,
        esgotado: true, // esgotado -> cat-4 fica sem produtos disponíveis
      },
    ]

    const catalogoPublico = filtrarCatalogoPublico(categorias, produtos)

    // Apenas cat-2 e cat-1 devem aparecer (cat-3 inativa, cat-4 vazia de disponíveis)
    assert.equal(catalogoPublico.length, 2)
    // Ordenadas por ordem crescente: cat-2 (ordem 1) primeiro, depois cat-1 (ordem 2)
    assert.equal(catalogoPublico[0]?.id, "cat-2")
    assert.equal(catalogoPublico[1]?.id, "cat-1")

    // Na cat-2, apenas prod-1 está disponível (prod-2 esgotado, prod-3 inativo)
    assert.equal(catalogoPublico[0]?.produtos.length, 1)
    assert.equal(catalogoPublico[0]?.produtos[0]?.id, "prod-1")
    // Em prod-1, o adicional esgotado foi omitido do cardápio público
    assert.equal(catalogoPublico[0]?.produtos[0]?.adicionais?.length, 1)
    assert.equal(catalogoPublico[0]?.produtos[0]?.adicionais?.[0]?.id, "add-1")

    // Diagnóstico
    const diagnostico = calcularDiagnosticoPublicacao(categorias, produtos)
    assert.equal(diagnostico.totalProdutos, 6)
    assert.equal(diagnostico.produtosVisiveisNoTotem, 2)
    assert.equal(diagnostico.produtosInativos, 1)
    assert.equal(diagnostico.produtosEsgotados, 2)
    assert.equal(diagnostico.categoriasVisiveisNoTotem, 2)
    assert.equal(diagnostico.categoriasInativas, 1)
    assert.equal(diagnostico.categoriasOcultasPorFaltaDeProdutos, 1)
  })
})
