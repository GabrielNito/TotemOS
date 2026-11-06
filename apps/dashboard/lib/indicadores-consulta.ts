import { ApiError } from "./api"
import type { Dispositivo, Pedido } from "./types/models"

export interface FonteIndicadores<T> {
  dados: T | null
  erro: string | null
  atualizadoEm: string | null
}
export interface SnapshotIndicadores {
  pedidos: FonteIndicadores<Pedido[]>
  dispositivos: FonteIndicadores<Dispositivo[]>
  carregando: boolean
}
const vazio = <T>(): FonteIndicadores<T> => ({
  dados: null,
  erro: null,
  atualizadoEm: null,
})
export function mensagemErroIndicadores(erro: unknown): string {
  if (erro instanceof ApiError) {
    switch (erro.statusCode) {
      case 401:
        return "Sessão inválida (401). Entre novamente."
      case 403:
        return "Sem autorização (403). Acesso para DONO ou GERENTE."
      case 429:
        return "Limite de requisições (429). Aguarde e tente novamente."
      case 503:
        return "Serviço indisponível (503). Tente novamente."
    }
  }
  return "Falha de comunicação ou dados inválidos. Tente novamente."
}

// Uma instância por sessão montada, sem cache global ou persistência local.
export class ConsultaIndicadores {
  private estado: SnapshotIndicadores = {
    pedidos: vazio(),
    dispositivos: vazio(),
    carregando: true,
  }
  private versao = 0
  private controle?: AbortController
  private ouvintes = new Set<() => void>()
  constructor(
    private pedidos: (signal: AbortSignal) => Promise<Pedido[]>,
    private dispositivos: (signal: AbortSignal) => Promise<Dispositivo[]>,
    private timeoutMs = 20000
  ) {}
  snapshot = () => this.estado
  assinar = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte)
    return () => {
      this.ouvintes.delete(ouvinte)
    }
  }
  private publicar(estado: SnapshotIndicadores) {
    this.estado = estado
    this.ouvintes.forEach((o) => o())
  }
  cancelar() {
    this.versao++
    this.controle?.abort()
  }
  async atualizar() {
    this.cancelar()
    const versao = this.versao
    const controle = new AbortController()
    this.controle = controle
    const timeout = setTimeout(() => controle.abort(), this.timeoutMs)
    this.publicar({ ...this.estado, carregando: true })
    const [pedidos, dispositivos] = await Promise.allSettled([
      this.pedidos(controle.signal),
      this.dispositivos(controle.signal),
    ])
    clearTimeout(timeout)
    if (versao !== this.versao) return
    const proibido = [pedidos, dispositivos].find(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof ApiError &&
        [401, 403].includes(r.reason.statusCode)
    )
    if (proibido?.status === "rejected") {
      const erro = mensagemErroIndicadores(proibido.reason)
      this.publicar({
        pedidos: { ...vazio<Pedido[]>(), erro },
        dispositivos: { ...vazio<Dispositivo[]>(), erro },
        carregando: false,
      })
      return
    }
    const fonte = <T>(
      res: PromiseSettledResult<T>,
      anterior: FonteIndicadores<T>
    ): FonteIndicadores<T> =>
      res.status === "fulfilled"
        ? {
            dados: res.value,
            erro: null,
            atualizadoEm: new Date().toISOString(),
          }
        : { ...anterior, erro: mensagemErroIndicadores(res.reason) }
    this.publicar({
      pedidos: fonte(pedidos, this.estado.pedidos),
      dispositivos: fonte(dispositivos, this.estado.dispositivos),
      carregando: false,
    })
  }
}
