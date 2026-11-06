import {
  ApiError,
  type CatalogoAdministrativo,
  type DispositivosResponse,
} from "./api"

export interface FonteConfiguracao<T> {
  status: "carregando" | "sucesso" | "erro"
  dados: T | null
  erro: string | null
}
export interface SnapshotConfiguracao {
  catalogo: FonteConfiguracao<CatalogoAdministrativo>
  dispositivos: FonteConfiguracao<DispositivosResponse>
  acessoNegado: boolean
}
const carregando = <T>(): FonteConfiguracao<T> => ({
  status: "carregando",
  dados: null,
  erro: null,
})
function mensagem(erro: unknown) {
  if (erro instanceof ApiError) {
    switch (erro.statusCode) {
      case 401:
        return "Sessão expirada (401). Entre novamente."
      case 403:
        return "Acesso não autorizado (403). Use uma conta administrativa deste estabelecimento."
      case 404:
        return "Recurso não encontrado (404). Tente novamente mais tarde."
      case 429:
        return "Limite de requisições (429). Aguarde antes de tentar novamente."
      case 503:
        return "Serviço indisponível (503). Tente novamente mais tarde."
    }
  }
  if (erro instanceof DOMException && erro.name === "TimeoutError")
    return "Tempo limite excedido. Tente novamente."
  return "Falha de comunicação ou dados inválidos. Tente novamente."
}

// Instância por identidade/token montados. Não há cache global ou progresso persistido.
export class ConsultaConfiguracao {
  private estado: SnapshotConfiguracao = {
    catalogo: carregando(),
    dispositivos: carregando(),
    acessoNegado: false,
  }
  private versao = 0
  private controle?: AbortController
  private ouvintes = new Set<() => void>()
  constructor(
    private negocioId: string,
    private catalogo: (signal: AbortSignal) => Promise<CatalogoAdministrativo>,
    private dispositivos: (
      signal: AbortSignal
    ) => Promise<DispositivosResponse>,
    private sessaoExpirada?: () => void,
    private timeoutMs = 20000,
    private sessaoAtual = () => true
  ) {}
  snapshot = () => this.estado
  assinar = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte)
    return () => {
      this.ouvintes.delete(ouvinte)
    }
  }
  private publicar(estado: SnapshotConfiguracao) {
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
    this.publicar({
      catalogo: carregando(),
      dispositivos: carregando(),
      acessoNegado: false,
    })
    const timer = setTimeout(
      () => controle.abort(new DOMException("timeout", "TimeoutError")),
      this.timeoutMs
    )
    const carregar = async <K extends "catalogo" | "dispositivos">(
      chave: K,
      consultar: (
        signal: AbortSignal
      ) => Promise<NonNullable<SnapshotConfiguracao[K]["dados"]>>
    ) => {
      let aoAbortar!: () => void
      try {
        const abortado = new Promise<never>((_, reject) => {
          aoAbortar = () => reject(controle.signal.reason)
          controle.signal.addEventListener("abort", aoAbortar, { once: true })
          if (controle.signal.aborted) aoAbortar()
        })
        const dados = await Promise.race([abortado, consultar(controle.signal)])
        if (versao !== this.versao || !this.sessaoAtual()) return
        const entidades =
          "categorias" in dados
            ? [...dados.categorias, ...dados.produtos]
            : dados.dispositivos
        if (entidades.some((e) => e.negocioId !== this.negocioId))
          throw new ApiError(403, "Escopo inválido")
        this.publicar({
          ...this.estado,
          [chave]: { status: "sucesso", dados, erro: null },
        })
      } catch (erro) {
        if (versao !== this.versao || !this.sessaoAtual()) return
        const fonte = {
          status: "erro" as const,
          dados: null,
          erro: mensagem(erro),
        }
        if (erro instanceof ApiError && [401, 403].includes(erro.statusCode)) {
          this.cancelar()
          this.publicar({
            catalogo: fonte,
            dispositivos: fonte,
            acessoNegado: true,
          })
          if (erro.statusCode === 401) this.sessaoExpirada?.()
        } else this.publicar({ ...this.estado, [chave]: fonte })
      } finally {
        controle.signal.removeEventListener("abort", aoAbortar)
      }
    }
    try {
      await Promise.all([
        carregar("catalogo", this.catalogo),
        carregar("dispositivos", this.dispositivos),
      ])
    } finally {
      clearTimeout(timer)
    }
  }
}
