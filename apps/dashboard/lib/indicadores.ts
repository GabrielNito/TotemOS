import { calcularMetricasPedidos } from "./pedidos"
import type { Dispositivo, Pedido } from "./types/models"

export const TIMEZONE = "America/Sao_Paulo"
export type PeriodoTipo = "dia" | "semana" | "mes" | "ano"
export interface Periodo {
  tipo: PeriodoTipo
  inicio: string
  fim: string
}
export interface PontoSerie {
  label: string
  value: number
}
export interface HoraPedidos {
  time: string
  orders: number
  percentage: number
}

const formatoData = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const formatoHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  hourCycle: "h23",
})
export function dataSaoPaulo(data: Date): string {
  if (!Number.isFinite(data.getTime())) throw new Error("Data inválida")
  const partes = formatoData.formatToParts(data)
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value
  return `${parte("year")}-${parte("month")}-${parte("day")}`
}
const isoCivil = (data: Date) => data.toISOString().slice(0, 10)

// UTC aqui serve apenas à aritmética de calendário, nunca para extrair o dia do pedido.
export function periodoAtual(tipo: PeriodoTipo, agora = new Date()): Periodo {
  const data = new Date(`${dataSaoPaulo(agora)}T12:00:00Z`)
  if (tipo === "semana")
    data.setUTCDate(data.getUTCDate() - ((data.getUTCDay() + 6) % 7))
  if (tipo === "mes") data.setUTCDate(1)
  if (tipo === "ano") {
    data.setUTCMonth(0, 1)
  }
  const inicio = isoCivil(data)
  if (tipo === "dia") data.setUTCDate(data.getUTCDate() + 1)
  if (tipo === "semana") data.setUTCDate(data.getUTCDate() + 7)
  if (tipo === "mes") data.setUTCMonth(data.getUTCMonth() + 1)
  if (tipo === "ano") data.setUTCFullYear(data.getUTCFullYear() + 1)
  return { tipo, inicio, fim: isoCivil(data) }
}
function centavos(valor: number): number {
  const inteiro = Math.round(valor * 100)
  if (
    !Number.isFinite(valor) ||
    valor < 0 ||
    !Number.isSafeInteger(inteiro) ||
    Math.abs(inteiro / 100 - valor) > 0.000001
  )
    throw new Error("Valor monetário inválido")
  return inteiro
}
const cancelado = (p: Pedido) =>
  p.status === "CANCELADO" || p.status === "CANCELADO_AGUARDANDO_ESTORNO"
function somar(pedidos: Pedido[]): number {
  const total = pedidos.reduce((s, p) => s + centavos(p.valorTotal), 0)
  if (!Number.isSafeInteger(total)) throw new Error("Soma monetária inválida")
  return total / 100
}

export function agregarIndicadores(
  pedidos: Pedido[],
  dispositivos: Dispositivo[],
  negocioId: string,
  periodo: Periodo,
  incluirDemo: boolean
) {
  for (const p of pedidos) {
    if (
      p.negocioId !== negocioId ||
      (p.dispositivo && p.dispositivo.negocioId !== negocioId)
    )
      throw new Error("Resposta fora do estabelecimento autenticado")
    centavos(p.valorTotal)
    dataSaoPaulo(new Date(p.createdAt))
    if (p.demo !== true && p.demo !== false)
      throw new Error("Classificação DEMO ausente")
  }
  const cadastro = resumirDispositivos(dispositivos, negocioId)
  const selecionados = pedidos.filter((p) => {
    const dia = dataSaoPaulo(new Date(p.createdAt))
    return dia >= periodo.inicio && dia < periodo.fim
  })
  const comerciais = selecionados.filter((p) => !p.demo)
  const demos = selecionados.filter((p) => p.demo)
  const filtrados = incluirDemo ? selecionados : comerciais
  const horas = new Map<string, number>()
  const buckets = new Map<string, number>()
  const origens = { totem: 0, direta: 0, naoIdentificada: 0, offline: 0 }
  for (const p of filtrados) {
    const data = new Date(p.createdAt)
    const dia = dataSaoPaulo(data)
    const hora = `${formatoHora.format(data)}h`
    horas.set(hora, (horas.get(hora) ?? 0) + 1)
    const chave =
      periodo.tipo === "dia"
        ? hora
        : periodo.tipo === "ano"
          ? dia.slice(0, 7)
          : dia
    buckets.set(chave, (buckets.get(chave) ?? 0) + 1)
    const dispositivo =
      p.dispositivo ?? dispositivos.find((d) => d.id === p.dispositivoId)
    if (!p.dispositivoId) origens.direta++
    else if (dispositivo?.tipo === "TOTEM") origens.totem++
    else origens.naoIdentificada++
    if (p.origemOffline) origens.offline++
  }
  const maximo = Math.max(0, ...horas.values())
  const distribuicao: HoraPedidos[] = [...horas]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, orders]) => ({
      time,
      orders,
      percentage: (orders / maximo) * 100,
    }))
  // Completa apenas lacunas entre o primeiro e o último bucket observado.
  // Não desenha projeções para horas/dias futuros do período civil.
  const chaves = [...buckets.keys()].sort()
  if (chaves.length > 1) {
    const primeira = chaves[0],
      ultima = chaves[chaves.length - 1]
    if (periodo.tipo === "dia") {
      for (
        let hora = Number(primeira.slice(0, 2));
        hora <= Number(ultima.slice(0, 2));
        hora++
      ) {
        const chave = `${String(hora).padStart(2, "0")}h`
        if (!buckets.has(chave)) buckets.set(chave, 0)
      }
    } else {
      const data = new Date(
        `${primeira}${periodo.tipo === "ano" ? "-01" : ""}T12:00:00Z`
      )
      while (
        (periodo.tipo === "ano"
          ? isoCivil(data).slice(0, 7)
          : isoCivil(data)) <= ultima
      ) {
        const chave =
          periodo.tipo === "ano" ? isoCivil(data).slice(0, 7) : isoCivil(data)
        if (!buckets.has(chave)) buckets.set(chave, 0)
        if (periodo.tipo === "ano") data.setUTCMonth(data.getUTCMonth() + 1)
        else data.setUTCDate(data.getUTCDate() + 1)
      }
    }
  }
  const serie: PontoSerie[] = [...buckets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, value]) => ({
      label:
        periodo.tipo === "dia"
          ? chave
          : periodo.tipo === "ano"
            ? `${chave.slice(5, 7)}/${chave.slice(0, 4)}`
            : `${chave.slice(8, 10)}/${chave.slice(5, 7)}`,
      value,
    }))
  return {
    comercial: calcularMetricasPedidos(comerciais),
    demo: calcularMetricasPedidos(demos),
    valorPedidos: somar(comerciais.filter((p) => !cancelado(p))),
    valorCancelados: somar(comerciais.filter(cancelado)),
    valorDemo: somar(demos.filter((p) => !cancelado(p))),
    faturamento: null,
    fila: filtrados.filter((p) =>
      ["PENDENTE", "EM_PREPARO", "PRONTO"].includes(p.status)
    ),
    origens,
    cadastro,
    serie,
    horas: distribuicao,
    pico: distribuicao.find((h) => h.orders === maximo) ?? null,
  }
}

export function resumirDispositivos(
  dispositivos: Dispositivo[],
  negocioId: string
) {
  if (dispositivos.some((d) => d.negocioId !== negocioId))
    throw new Error("Cadastro fora do estabelecimento autenticado")
  return (["TOTEM", "PAINEL"] as const).map((tipo) => {
    const lista = dispositivos.filter((d) => d.tipo === tipo)
    const ativos = lista.filter((d) => d.ativo && !d.revogadoEm).length
    return {
      tipo,
      total: lista.length,
      ativos,
      revogados: lista.length - ativos,
    }
  })
}

export function coordenadasSerie(points: PontoSerie[]) {
  if (points.some((p) => !Number.isFinite(p.value) || p.value < 0))
    throw new Error("Série inválida")
  const max = Math.max(1, ...points.map((p) => p.value))
  return points.map((p, i) => ({
    ...p,
    x: points.length === 1 ? 230 : 25 + (i * 410) / (points.length - 1),
    y: 155 - (p.value / max) * 130,
  }))
}
