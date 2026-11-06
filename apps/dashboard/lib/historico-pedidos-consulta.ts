import { ApiError, type ListarPedidosParams } from "./api"
import type { Dispositivo, Pedido } from "./types/models"

export interface ErroHistorico {
  titulo: string
  detalhe: string
  codigo?: number
}
export function mensagemErroPedido(error: unknown): ErroHistorico {
  const codigo = error instanceof ApiError ? error.statusCode : undefined
  const mensagens: Record<number, string> = {
    401: "Sessão inválida. Autentique novamente.",
    403: "Acesso restrito a DONO ou GERENTE.",
    404: "Pedido não encontrado neste estabelecimento.",
    429: "Limite de requisições. Aguarde antes de tentar novamente.",
    503: "Serviço indisponível. Tente novamente.",
  }
  return {
    titulo: codigo
      ? `Falha na consulta (${codigo})`
      : "Falha de comunicação ou timeout",
    detalhe:
      (codigo && mensagens[codigo]) ||
      "Não foi possível consultar dados válidos do estabelecimento.",
    codigo,
  }
}
interface Fonte<T> {
  dados: T | null
  erro: ErroHistorico | null
  carregando: boolean
  atualizadoEm: string | null
}
interface Dados {
  pedidos: Pedido[]
  dispositivos: Dispositivo[]
  detalhe: Pedido
}
interface SnapshotHistorico {
  pedidos: Fonte<Pedido[]>
  dispositivos: Fonte<Dispositivo[]>
  detalhe: Fonte<Pedido>
  selecionadoId: string | null
  filtro: string
}
interface Dependencias {
  listar: (
    filtro: ListarPedidosParams,
    signal: AbortSignal
  ) => Promise<Pedido[]>
  dispositivos: (signal: AbortSignal) => Promise<Dispositivo[]>
  detalhe: (id: string, signal: AbortSignal) => Promise<Pedido>
}
const vazio = <T>(): Fonte<T> => ({
  dados: null,
  erro: null,
  carregando: false,
  atualizadoEm: null,
})

// Estado exclusivo desta página/sessão, independente do trabalho paralelo #35.
export class HistoricoPedidosConsulta {
  private estado: SnapshotHistorico = {
    pedidos: vazio(),
    dispositivos: vazio(),
    detalhe: vazio(),
    selecionadoId: null,
    filtro: "",
  }
  private versoes = { pedidos: 0, dispositivos: 0, detalhe: 0 }
  private controles: Partial<Record<keyof Dados, AbortController>> = {}
  private ouvintes = new Set<() => void>()
  constructor(
    private negocioId: string,
    private deps: Dependencias,
    private timeoutMs = 20000
  ) {}
  snapshot = () => this.estado
  assinar = (fn: () => void) => {
    this.ouvintes.add(fn)
    return () => {
      this.ouvintes.delete(fn)
    }
  }
  private publicar(estado: SnapshotHistorico) {
    this.estado = estado
    this.ouvintes.forEach((fn) => fn())
  }
  private cancelarFonte(fonte: keyof Dados) {
    this.versoes[fonte]++
    this.controles[fonte]?.abort()
  }
  cancelarConsultas() {
    this.cancelarFonte("pedidos")
    this.cancelarFonte("dispositivos")
  }
  cancelar() {
    this.cancelarConsultas()
    this.cancelarFonte("detalhe")
  }
  private negarAcesso(erro: ErroHistorico) {
    this.cancelar()
    this.publicar({
      ...this.estado,
      pedidos: { ...vazio<Pedido[]>(), erro },
      dispositivos: { ...vazio<Dispositivo[]>(), erro },
      detalhe: vazio(),
      selecionadoId: null,
    })
  }
  private async consultar<K extends keyof Dados>(
    fonte: K,
    tarefa: (signal: AbortSignal) => Promise<Dados[K]>,
    preservar = false
  ) {
    this.cancelarFonte(fonte)
    const versao = this.versoes[fonte],
      controle = new AbortController()
    this.controles[fonte] = controle
    const anterior = preservar ? this.estado[fonte] : vazio<Dados[K]>()
    this.publicar({
      ...this.estado,
      [fonte]: { ...anterior, erro: null, carregando: true },
    })
    const timer = setTimeout(() => controle.abort(), this.timeoutMs)
    try {
      const dados = await tarefa(controle.signal)
      if (versao !== this.versoes[fonte]) return
      const registros = Array.isArray(dados) ? dados : [dados]
      if (registros.some((p) => p.negocioId !== this.negocioId))
        throw new Error("Tenant divergente")
      this.publicar({
        ...this.estado,
        [fonte]: {
          dados,
          erro: null,
          carregando: false,
          atualizadoEm: new Date().toISOString(),
        },
      })
    } catch (error) {
      if (versao !== this.versoes[fonte]) return
      const erro = mensagemErroPedido(error)
      if (erro.codigo === 401 || erro.codigo === 403) this.negarAcesso(erro)
      else
        this.publicar({
          ...this.estado,
          [fonte]: { ...anterior, erro, carregando: false },
        })
    } finally {
      clearTimeout(timer)
    }
  }
  async carregar(filtro: ListarPedidosParams, preservar = false) {
    this.publicar({ ...this.estado, filtro: JSON.stringify(filtro) })
    await Promise.all([
      this.consultar("pedidos", (s) => this.deps.listar(filtro, s), preservar),
      this.consultar("dispositivos", (s) => this.deps.dispositivos(s), true),
    ])
  }
  async abrirDetalhe(id: string) {
    this.publicar({ ...this.estado, selecionadoId: id })
    await this.consultar("detalhe", async (s) => {
      const pedido = await this.deps.detalhe(id, s)
      if (pedido.id !== id) throw new Error("Detalhe divergente")
      return pedido
    })
  }
  fecharDetalhe() {
    this.cancelarFonte("detalhe")
    this.publicar({ ...this.estado, selecionadoId: null, detalhe: vazio() })
  }
}
