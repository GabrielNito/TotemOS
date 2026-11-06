import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"

import {
  ApiError,
  getFilaPedidos,
  getPedidoDetalhe,
  getPedidos,
} from "../lib/api"
import {
  calcularMetricasPedidos,
  filtrarPedidosPorPeriodo,
  descreverOrigemPedido,
  formatarSenhaPedido,
  calcularSubtotalItemSnapshot,
} from "../lib/pedidos"
import type { Pedido } from "../lib/types/models"

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

const pedidoApiMock = {
  id: "11111111-1111-4111-8111-111111111111",
  negocioId: "negocio-1",
  dispositivoId: "dev-totem-1",
  senha: null,
  dataSequencial: "2026-11-05",
  dataOperacional: null,
  status: "AGUARDANDO_PAGAMENTO" as const,
  nomeCliente: "Marina",
  codigoCliente: "M12",
  valorTotal: "42.90",
  observacoes: "Sem cebola",
  origemOffline: false,
  preparoZero: false,
  demo: true,
  demoAmbiente: "staging",
  versao: 1,
  createdAt: "2026-11-05T11:20:00.000Z",
  updatedAt: "2026-11-05T11:20:00.000Z",
  itens: [
    {
      id: "item-1",
      pedidoId: "11111111-1111-4111-8111-111111111111",
      produtoId: "prod-1",
      nomeProduto: "Burger Duplo",
      precoNoMomento: "34.90",
      quantidade: 1,
      observacao: "Bem passado",
      variacaoNome: "Duplo 320g",
      adicionais: [
        {
          id: "adic-1",
          pedidoItemId: "item-1",
          adicionalId: "cat-adic-1",
          nomeAdicional: "Bacon Extra",
          precoNoMomento: "4.00",
          quantidade: 2,
        },
      ],
      escolhas: [
        {
          id: "esc-1",
          pedidoItemId: "item-1",
          itemDoGrupoId: "grp-1",
          nomeItem: "Batata Rústica",
          deltaNoMomento: "0.00",
        },
      ],
    },
  ],
  pagamentos: [],
}

describe("gestão e histórico de pedidos reais no Dashboard (TDD)", () => {
  test("lista pedidos do tenant com filtros opcionais sem enviar negocioId e normaliza snapshots do servidor", async () => {
    const chamadas: Array<{
      url: string
      method?: string
      cache?: RequestInit["cache"]
      headers: Record<string, string>
    }> = []

    globalThis.fetch = Object.assign(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
      ) => {
        chamadas.push({
          url: String(input),
          method: init?.method,
          cache: init?.cache,
          headers: Object.fromEntries(new Headers(init?.headers).entries()),
        })

        return respostaJson([pedidoApiMock])
      },
      { preconnect: fetchOriginal.preconnect }
    )

    const pedidos = await getPedidos(
      {
        status: "AGUARDANDO_PAGAMENTO",
        dataIniciadaEm: "2026-11-01",
        dataFinalizadaEm: "2026-11-05",
      },
      "jwt-dono-valido"
    )

    assert.equal(chamadas.length, 1)
    assert.equal(
      chamadas[0]?.url,
      "http://localhost:3001/pedidos?status=AGUARDANDO_PAGAMENTO&dataIniciadaEm=2026-11-01&dataFinalizadaEm=2026-11-05"
    )
    assert.equal(chamadas[0]?.method, "GET")
    assert.equal(chamadas[0]?.cache, "no-store")
    assert.equal(
      chamadas[0]?.headers["authorization"],
      "Bearer jwt-dono-valido"
    )
    assert.equal(chamadas[0]?.url.includes("negocioId"), false)

    assert.equal(pedidos.length, 1)
    const p = pedidos[0]!
    assert.equal(p.valorTotal, 42.9)
    assert.equal(p.senha, null)
    assert.equal(p.itens[0]?.precoNoMomento, 34.9)
    assert.equal(p.itens[0]?.adicionais?.[0]?.precoNoMomento, 4)
    assert.equal(p.itens[0]?.escolhas?.[0]?.deltaNoMomento, 0)
    assert.equal(calcularSubtotalItemSnapshot(p.itens[0]!), 42.9)
  })

  test("consulta detalhe do pedido por ID preservando snapshots e senha opcional", async () => {
    let urlChamada = ""

    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0]) => {
        urlChamada = String(input)
        return respostaJson({
          ...pedidoApiMock,
          status: "EM_PREPARO",
          senha: 18,
          dataOperacional: "2026-11-05",
        })
      },
      { preconnect: fetchOriginal.preconnect }
    )

    const detalhe = await getPedidoDetalhe(pedidoApiMock.id, "jwt-gerente")

    assert.equal(
      urlChamada,
      `http://localhost:3001/pedidos/${pedidoApiMock.id}`
    )
    assert.equal(detalhe.senha, 18)
    assert.equal(detalhe.status, "EM_PREPARO")
    assert.equal(detalhe.valorTotal, 42.9)
    assert.equal(formatarSenhaPedido(detalhe.senha), "#018")
    assert.equal(formatarSenhaPedido(null), "Aguardando senha")
  })

  test("consulta fila elegível da cozinha em GET /pedidos/fila sem mocks silenciosos", async () => {
    let urlChamada = ""

    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0]) => {
        urlChamada = String(input)
        return respostaJson({
          pedidos: [
            {
              id: pedidoApiMock.id,
              status: "PENDENTE",
              senha: 7,
              dataOperacional: "2026-11-05",
              createdAt: "2026-11-05T11:20:00.000Z",
              versao: 2,
              demo: true,
              demoAmbiente: "staging",
              preparoZero: false,
              elegivelCozinha: true,
              autorizacaoOperacional: { tipo: "DEMO", financeira: false },
              itens: [
                {
                  nomeProduto: "Burger Duplo",
                  quantidade: 1,
                  variacaoNome: "Duplo 320g",
                  observacao: null,
                  adicionais: [{ nomeAdicional: "Bacon Extra", quantidade: 2 }],
                  escolhas: [],
                },
              ],
            },
          ],
          proximoCursor: null,
        })
      },
      { preconnect: fetchOriginal.preconnect }
    )

    const fila = await getFilaPedidos(50, "jwt-dono")

    assert.equal(urlChamada, "http://localhost:3001/pedidos/fila?limite=50")
    assert.equal(fila.pedidos.length, 1)
    assert.equal(fila.pedidos[0]?.senha, 7)
    assert.equal(fila.pedidos[0]?.status, "PENDENTE")
  })

  test("propaga erros HTTP 401, 403 e 404 sem mascarar com dados fictícios", async () => {
    const cenarios = [
      {
        status: 401,
        message: "Token de autenticação inválido ou expirado",
        fn: () => getPedidos({}, "token-expirado"),
      },
      {
        status: 403,
        message: "Ação exclusiva de PAINEL, DONO ou GERENTE.",
        fn: () => getPedidos({}, "device-token-totem"),
      },
      {
        status: 404,
        message: "Pedido não encontrado ou não pertence a este estabelecimento",
        fn: () => getPedidoDetalhe("pedido-outro-tenant", "jwt-dono"),
      },
    ]

    for (const cenario of cenarios) {
      globalThis.fetch = Object.assign(
        async () => respostaJson({ message: cenario.message }, cenario.status),
        { preconnect: fetchOriginal.preconnect }
      )

      await assert.rejects(cenario.fn, (error: unknown) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.statusCode, cenario.status)
        assert.equal(error.message, cenario.message)
        return true
      })
    }
  })

  test("descreve origem do pedido, filtra por período e agrega métricas usando apenas valorTotal do servidor", () => {
    const dispositivos = [
      {
        id: "dev-totem-1",
        negocioId: "negocio-1",
        nome: "Totem Entrada 01",
        tipo: "TOTEM" as const,
        pareadoEm: "2026-11-01T10:00:00.000Z",
        ativo: true,
        revogadoEm: null,
        createdAt: "2026-11-01T10:00:00.000Z",
      },
    ]

    const p1: Pedido = {
      id: "ped-1",
      negocioId: "negocio-1",
      dispositivoId: "dev-totem-1",
      senha: 1,
      dataSequencial: "2026-11-05",
      status: "ENTREGUE",
      valorTotal: 50,
      origemOffline: false,
      demo: false,
      createdAt: "2026-11-05T12:00:00.000Z",
      updatedAt: "2026-11-05T12:15:00.000Z",
      itens: [
        {
          id: "i-1",
          pedidoId: "ped-1",
          nomeProduto: "Combo 1",
          precoNoMomento: 50,
          quantidade: 1,
        },
      ],
    }

    const p2Demo: Pedido = {
      ...p1,
      id: "ped-2",
      dispositivoId: null,
      senha: 2,
      status: "PENDENTE",
      valorTotal: 30,
      demo: true,
      demoAmbiente: "staging",
      createdAt: "2026-11-04T12:00:00.000Z",
    }

    const p3Cancelado: Pedido = {
      ...p1,
      id: "ped-3",
      status: "CANCELADO",
      valorTotal: 80,
      createdAt: "2026-11-01T12:00:00.000Z",
    }

    assert.equal(
      descreverOrigemPedido(p1, dispositivos).rotulo,
      "Totem Entrada 01"
    )
    assert.equal(descreverOrigemPedido(p2Demo, dispositivos).isDemo, true)

    const apenasHoje = filtrarPedidosPorPeriodo(
      [p1, p2Demo, p3Cancelado],
      "2026-11-05",
      "2026-11-05"
    )
    assert.equal(apenasHoje.length, 1)
    assert.equal(apenasHoje[0]?.id, "ped-1")

    const metricas = calcularMetricasPedidos([p1, p2Demo, p3Cancelado])
    assert.equal(metricas.totalPedidos, 3)
    assert.equal(metricas.pedidosAtivosNaFila, 1)
    // Valor consolidado usa valorTotal do servidor de pedidos não cancelados e separa DEMO de comercial
    assert.equal(metricas.valorComercialConfirmado, 50)
    assert.equal(metricas.valorDemoOperacional, 30)
  })
})
