import type {
  Dispositivo,
  Pedido,
  PedidoItem,
  StatusPedido,
} from "./types/models"

export interface OrigemPedidoInfo {
  rotulo: string
  subtitulo: string
  isDemo: boolean
  isOffline: boolean
}

export interface MetricasPedidos {
  totalPedidos: number
  pedidosAtivosNaFila: number
  pedidosEntregues: number
  pedidosAguardandoPagamento: number
  pedidosCancelados: number
  pedidosDemo: number
  valorNominalComercial: number
  valorNominalCancelado: number
  /** @deprecated Nome legado: soma nominal de status operacionais, não pagamento. */
  valorComercialConfirmado: number
  valorDemoOperacional: number
  valorTotalServidor: number
  ticketMedioComercial: number
}

export const STATUS_PEDIDO_OPCOES: Array<{
  valor: "TODOS" | StatusPedido
  rotulo: string
}> = [
  { valor: "TODOS", rotulo: "Todos os status" },
  { valor: "AGUARDANDO_PAGAMENTO", rotulo: "Aguardando pagamento" },
  { valor: "PENDENTE", rotulo: "Pendente (Fila)" },
  { valor: "EM_PREPARO", rotulo: "Em preparo" },
  { valor: "PRONTO", rotulo: "Pronto" },
  { valor: "ENTREGUE", rotulo: "Entregue" },
  { valor: "CANCELADO_AGUARDANDO_ESTORNO", rotulo: "Aguardando estorno" },
  { valor: "CANCELADO", rotulo: "Cancelado" },
]

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export function formatarSenhaPedido(senha: number | null | undefined): string {
  if (senha === null || senha === undefined) {
    return "Aguardando senha"
  }
  return `#${String(senha).padStart(3, "0")}`
}

export function formatarStatusPedido(status: StatusPedido): string {
  switch (status) {
    case "AGUARDANDO_PAGAMENTO":
      return "Aguardando pagamento"
    case "PENDENTE":
      return "Pendente"
    case "EM_PREPARO":
      return "Em preparo"
    case "PRONTO":
      return "Pronto"
    case "ENTREGUE":
      return "Entregue"
    case "CANCELADO_AGUARDANDO_ESTORNO":
      return "Aguardando estorno"
    case "CANCELADO":
      return "Cancelado"
    default:
      return status
  }
}

export function calcularSubtotalItemSnapshot(item: PedidoItem): number {
  const adicionaisTotal = (item.adicionais ?? []).reduce(
    (soma, adic) => soma + adic.precoNoMomento * adic.quantidade,
    0
  )
  const escolhasTotal = (item.escolhas ?? []).reduce(
    (soma, esc) => soma + esc.deltaNoMomento,
    0
  )
  return (
    (item.precoNoMomento + adicionaisTotal + escolhasTotal) * item.quantidade
  )
}

export function descreverOrigemPedido(
  pedido: Pick<
    Pedido,
    "dispositivoId" | "dispositivo" | "origemOffline" | "demo" | "demoAmbiente"
  >,
  dispositivos: Dispositivo[] = []
): OrigemPedidoInfo {
  const dispositivoEncontrado =
    pedido.dispositivo ??
    (pedido.dispositivoId
      ? dispositivos.find((d) => d.id === pedido.dispositivoId)
      : undefined)

  const rotulo = dispositivoEncontrado
    ? dispositivoEncontrado.nome
    : pedido.dispositivoId
      ? `Terminal (${pedido.dispositivoId.slice(0, 8)})`
      : "Painel / Direto"

  const partes: string[] = [
    pedido.origemOffline ? "Sincronizado offline" : "Origem cloud",
  ]
  if (pedido.demo) {
    partes.push(
      pedido.demoAmbiente ? `DEMO (${pedido.demoAmbiente})` : "Modo DEMO"
    )
  }

  return {
    rotulo,
    subtitulo: partes.join(" • "),
    isDemo: Boolean(pedido.demo),
    isOffline: Boolean(pedido.origemOffline),
  }
}

export function extrairDataLocalIso(isoOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate
  }
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) {
    return isoOrDate.slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

export function filtrarPedidosPorPeriodo(
  pedidos: Pedido[],
  dataInicial?: string,
  dataFinal?: string
): Pedido[] {
  const inicio = dataInicial?.trim() || undefined
  const fim = dataFinal?.trim() || undefined
  if (!inicio && !fim) return pedidos

  return pedidos.filter((pedido) => {
    const dataRef = pedido.createdAt
      ? extrairDataLocalIso(pedido.createdAt)
      : pedido.dataSequencial
    if (inicio && dataRef < inicio) return false
    if (fim && dataRef > fim) return false
    return true
  })
}

export function calcularMetricasPedidos(pedidos: Pedido[]): MetricasPedidos {
  let pedidosDemo = 0
  let comercialCentavos = 0
  let canceladoCentavos = 0
  let pedidosAtivosNaFila = 0
  let pedidosEntregues = 0
  let pedidosAguardandoPagamento = 0
  let pedidosCancelados = 0
  let valorComercialConfirmado = 0
  let valorDemoOperacional = 0
  let valorTotalServidor = 0
  let qtdComercialValido = 0

  for (const pedido of pedidos) {
    const cancelado =
      pedido.status === "CANCELADO" ||
      pedido.status === "CANCELADO_AGUARDANDO_ESTORNO"
    if (pedido.demo) pedidosDemo++
    else if (cancelado) canceladoCentavos += Math.round(pedido.valorTotal * 100)
    else comercialCentavos += Math.round(pedido.valorTotal * 100)

    if (
      pedido.status === "PENDENTE" ||
      pedido.status === "EM_PREPARO" ||
      pedido.status === "PRONTO"
    ) {
      pedidosAtivosNaFila += 1
    } else if (pedido.status === "ENTREGUE") {
      pedidosEntregues += 1
    } else if (pedido.status === "AGUARDANDO_PAGAMENTO") {
      pedidosAguardandoPagamento += 1
    } else if (cancelado) {
      pedidosCancelados += 1
    }

    if (!cancelado) {
      valorTotalServidor += pedido.valorTotal
      if (pedido.demo) {
        valorDemoOperacional += pedido.valorTotal
      } else if (pedido.status !== "AGUARDANDO_PAGAMENTO") {
        valorComercialConfirmado += pedido.valorTotal
        qtdComercialValido += 1
      }
    }
  }

  return {
    totalPedidos: pedidos.length,
    pedidosAtivosNaFila,
    pedidosEntregues,
    pedidosAguardandoPagamento,
    pedidosCancelados,
    pedidosDemo,
    valorNominalComercial: comercialCentavos / 100,
    valorNominalCancelado: canceladoCentavos / 100,
    valorComercialConfirmado,
    valorDemoOperacional,
    valorTotalServidor,
    ticketMedioComercial:
      qtdComercialValido > 0
        ? valorComercialConfirmado / qtdComercialValido
        : 0,
  }
}
