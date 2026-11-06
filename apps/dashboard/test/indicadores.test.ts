import { describe, expect, test } from "bun:test"
import {
  agregarIndicadores,
  periodoAtual,
  coordenadasSerie,
  resumirDispositivos,
} from "../lib/indicadores"
import type { Pedido } from "../lib/types/models"
import { formatarMoeda } from "../lib/pedidos"

const agora = new Date("2026-01-01T15:00:00Z")
function pedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: crypto.randomUUID(),
    negocioId: "a",
    senha: null,
    dataSequencial: "1999-01-01",
    status: "PENDENTE",
    valorTotal: 10.1,
    origemOffline: false,
    demo: false,
    createdAt: "2026-01-01T03:00:00Z",
    updatedAt: "2026-02-01T00:00:00Z",
    itens: [],
    ...overrides,
  }
}
const agregar = (pedidos: Pedido[], incluirDemo = false) =>
  agregarIndicadores(pedidos, [], "a", periodoAtual("dia", agora), incluirDemo)

describe("indicadores verificáveis #35", () => {
  test("conta status, separa DEMO, cancelados e valor nominal em centavos", () => {
    const r = agregar([
      pedido(),
      pedido({ status: "EM_PREPARO" }),
      pedido({ status: "PRONTO" }),
      pedido({ status: "ENTREGUE" }),
      pedido({ status: "AGUARDANDO_PAGAMENTO" }),
      pedido({ status: "CANCELADO" }),
      pedido({ status: "CANCELADO_AGUARDANDO_ESTORNO" }),
      pedido({ demo: true }),
    ])
    expect(r.comercial.totalPedidos).toBe(7)
    expect(r.comercial.pedidosAtivosNaFila).toBe(3)
    expect(r.comercial.pedidosEntregues).toBe(1)
    expect(r.comercial.pedidosAguardandoPagamento).toBe(1)
    expect(r.comercial.pedidosCancelados).toBe(2)
    expect(r.valorPedidos).toBe(50.5)
    expect(r.valorCancelados).toBe(20.2)
    expect(r.demo.totalPedidos).toBe(1)
    expect(r.valorDemo).toBe(10.1)
  })
  for (const status of [
    "PENDENTE",
    "APROVADO",
    "RECUSADO",
    "ESTORNADO",
  ] as const) {
    test(`pagamento ${status} não cria faturamento nem comprova estorno do pedido`, () => {
      const p = pedido({
        status: "ENTREGUE",
        pagamentos: [
          {
            id: "pay",
            pedidoId: "p",
            status,
            valor: 7,
            createdAt: "",
            updatedAt: "",
          },
        ],
      })
      expect(agregar([p]).faturamento).toBeNull()
      expect(agregar([p]).valorPedidos).toBe(10.1)
    })
  }
  test("vazio é medição zero, sem série ou pico inventado", () => {
    const r = agregar([])
    expect(r.comercial.totalPedidos).toBe(0)
    expect(r.serie).toEqual([])
    expect(r.horas).toEqual([])
    expect(r.pico).toBeNull()
  })
  test("dia local inclui início e exclui fim, ignora data da senha e atualização", () => {
    expect(
      agregar([
        pedido({ createdAt: "2026-01-01T02:59:59Z" }),
        pedido(),
        pedido({ createdAt: "2026-01-02T02:59:59Z" }),
        pedido({ createdAt: "2026-01-02T03:00:00Z" }),
      ]).comercial.totalPedidos
    ).toBe(2)
  })
  test("UTC após meia-noite ainda pertence ao dia anterior em São Paulo", () => {
    expect(periodoAtual("dia", new Date("2026-01-01T01:00:00Z")).inicio).toBe(
      "2025-12-31"
    )
  })
  test.each([
    ["dia", "2026-01-01", "2026-01-02"],
    ["semana", "2025-12-29", "2026-01-05"],
    ["mes", "2026-01-01", "2026-02-01"],
    ["ano", "2026-01-01", "2027-01-01"],
  ] as const)("período %s civil, fim exclusivo", (tipo, inicio, fim) => {
    expect(periodoAtual(tipo, agora)).toMatchObject({ inicio, fim })
  })
  test("virada de mês e ano bissexto", () => {
    expect(periodoAtual("mes", new Date("2024-03-01T01:00:00Z"))).toMatchObject(
      { inicio: "2024-02-01", fim: "2024-03-01" }
    )
  })
  test("horas ordenadas, percentuais derivados, empate pela hora mais cedo e DEMO opt-in", () => {
    const lista = [
      pedido({ createdAt: "2026-01-01T15:00:00Z" }),
      pedido(),
      pedido({ demo: true }),
    ]
    const r = agregar(lista)
    expect(r.horas.map((h) => h.time)).toEqual(["00h", "12h"])
    expect(r.pico?.time).toBe("00h")
    expect(r.horas[0].percentage).toBe(100)
    expect(agregar(lista, true).pico?.orders).toBe(2)
  })
  test("semana, mês e ano agrupam nos buckets corretos", () => {
    for (const tipo of ["semana", "mes", "ano"] as const) {
      const r = agregarIndicadores(
        [pedido(), pedido()],
        [],
        "a",
        periodoAtual(tipo, agora),
        false
      )
      expect(r.serie.reduce((s, p) => s + p.value, 0)).toBe(2)
      expect(r.serie.find((p) => p.value === 2)?.label).toBe(
        tipo === "ano" ? "01/2026" : "01/01"
      )
    }
  })
  test("isola dois tenants inclusive dispositivo embutido e rejeita payload misturado", () => {
    expect(() => agregar([pedido({ negocioId: "b" })])).toThrow()
    expect(() =>
      agregarIndicadores(
        [],
        [{ negocioId: "b" } as never],
        "a",
        periodoAtual("dia", agora),
        false
      )
    ).toThrow()
  })
  test.each([-1, NaN, Infinity])(
    "rejeita dinheiro inválido %s",
    (valorTotal) => {
      expect(() => agregar([pedido({ valorTotal })])).toThrow()
    }
  )
  test("rejeita data inválida", () =>
    expect(() => agregar([pedido({ createdAt: "errada" })])).toThrow())
  test("BRL preserva centavos", () =>
    expect(formatarMoeda(1234.56)).toMatch(/1\.234,56/))
  test("origem desconhecida não é Totem ou online; offline é histórico", () => {
    const r = agregar([
      pedido({ dispositivoId: "desconhecido" }),
      pedido({ origemOffline: true }),
      pedido(),
    ])
    expect(r.origens).toEqual({
      totem: 0,
      direta: 2,
      naoIdentificada: 1,
      offline: 1,
    })
  })
  test.each([0, 1, 2, 30, 1000])("coordenadas finitas para %s pontos", (n) => {
    const coords = coordenadasSerie(
      Array.from({ length: n }, (_, i) => ({ label: String(i), value: 5 }))
    )
    expect(coords).toHaveLength(n)
    expect(
      coords.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    ).toBe(true)
  })
  test("coordenadas rejeitam negativos", () =>
    expect(() => coordenadasSerie([{ label: "x", value: -1 }])).toThrow())
  test("spline mantém espaçamento temporal e zeros medidos entre registros", () => {
    const r = agregar([pedido(), pedido({ createdAt: "2026-01-01T05:00:00Z" })])
    expect(r.serie.slice(0, 3)).toEqual([
      { label: "00h", value: 1 },
      { label: "01h", value: 0 },
      { label: "02h", value: 1 },
    ])
  })
  test("cadastro ativo não é presença online, revogado prevalece", () => {
    const r = resumirDispositivos(
      [
        {
          negocioId: "a",
          tipo: "TOTEM",
          ativo: true,
          revogadoEm: null,
        } as never,
        {
          negocioId: "a",
          tipo: "TOTEM",
          ativo: true,
          revogadoEm: "2026-01-01",
        } as never,
        { negocioId: "a", tipo: "PAINEL", ativo: false } as never,
      ],
      "a"
    )
    expect(r).toEqual([
      { tipo: "TOTEM", total: 2, ativos: 1, revogados: 1 },
      { tipo: "PAINEL", total: 1, ativos: 0, revogados: 1 },
    ])
    expect(JSON.stringify(r)).not.toContain("online")
  })
})

test("histórico com dez mil pedidos mantém contagem, centavos e total da série", () => {
  const pedidos: Pedido[] = Array.from({ length: 10000 }, (_, i) => ({
    id: String(i),
    negocioId: "a",
    senha: null,
    dataSequencial: "1999-01-01",
    status: "PENDENTE",
    valorTotal: 10.1,
    origemOffline: false,
    demo: false,
    createdAt: "2026-01-01T12:00:00Z",
    updatedAt: "2026-01-02T12:00:00Z",
    itens: [],
  }))
  const r = agregarIndicadores(
    pedidos,
    [],
    "a",
    periodoAtual("ano", new Date("2026-01-01T12:00:00Z")),
    false
  )
  expect(r.comercial.totalPedidos).toBe(10000)
  expect(r.valorPedidos).toBe(101000)
  expect(r.serie.reduce((s, p) => s + p.value, 0)).toBe(10000)
})
