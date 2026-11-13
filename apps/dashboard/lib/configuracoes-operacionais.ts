import { ApiError, type AtualizarConfiguracaoNegocioInput } from "./api"
import type { ConfiguracaoNegocio, Role } from "./types/models"

export interface EstadoLeituraConfiguracao {
  status: "carregando" | "sucesso" | "erro"
  dados: ConfiguracaoNegocio | null
  erro: string | null
  desatualizado: boolean
}

export interface EstadoSalvamentoConfiguracao {
  status: "ocioso" | "salvando" | "sucesso" | "erro"
  mensagem: string | null
}

export interface SnapshotConfiguracaoOperacional {
  leitura: EstadoLeituraConfiguracao
  salvamento: EstadoSalvamentoConfiguracao
  acessoNegado: boolean
}

function mensagemErroLeitura(erro: unknown): string {
  if (erro instanceof ApiError) {
    switch (erro.statusCode) {
      case 401:
        return "Sessão expirada (401). Entre novamente."
      case 403:
        return "Acesso não autorizado (403). Use uma conta administrativa deste estabelecimento."
      case 404:
        return "Estabelecimento não encontrado (404). Tente novamente mais tarde."
      case 429:
        return "Limite de requisições atingido (429). Aguarde antes de tentar novamente."
      case 502:
        return "Resposta de configurações incompatível com o contrato esperado."
      case 503:
        return "Serviço temporariamente indisponível (503). Tente novamente mais tarde."
    }
  }
  if (erro instanceof DOMException && erro.name === "TimeoutError") {
    return "Tempo limite excedido ao carregar as configurações. Tente novamente."
  }
  return "Falha de comunicação ao carregar as configurações. Tente novamente."
}

function mensagemErroSalvamento(erro: unknown): string {
  if (erro instanceof ApiError) {
    switch (erro.statusCode) {
      case 400:
        return "Dados inválidos (400). Revise os campos informados e tente novamente."
      case 401:
        return "PIN do dono inválido ou sessão expirada (401). Confira o PIN de 4 dígitos e tente novamente."
      case 403:
        return "Apenas o DONO ativo deste estabelecimento pode alterar configurações (403)."
      case 404:
        return "Estabelecimento não encontrado (404). Recarregue a página e tente novamente."
      case 429:
        return "Muitas tentativas com PIN (429). Aguarde um minuto antes de tentar novamente."
      case 502:
        return "Resposta do servidor incompatível com o contrato após salvar."
      case 503:
        return "Serviço indisponível (503). Sua edição foi mantida; tente salvar novamente."
    }
  }
  if (erro instanceof DOMException && erro.name === "TimeoutError") {
    return "Tempo limite excedido ao salvar. Sua edição foi mantida; tente novamente."
  }
  return "Falha de comunicação ao salvar as configurações. Tente novamente."
}

async function executarComTimeout<T>(
  operacao: (signal: AbortSignal) => Promise<T>,
  controle: AbortController,
  timeoutMs: number
): Promise<T> {
  let aoAbortar!: () => void
  const timer = setTimeout(
    () => controle.abort(new DOMException("timeout", "TimeoutError")),
    timeoutMs
  )
  try {
    const abortado = new Promise<never>((_, reject) => {
      aoAbortar = () => reject(controle.signal.reason)
      controle.signal.addEventListener("abort", aoAbortar, { once: true })
      if (controle.signal.aborted) aoAbortar()
    })
    return await Promise.race([abortado, operacao(controle.signal)])
  } finally {
    clearTimeout(timer)
    controle.signal.removeEventListener("abort", aoAbortar)
  }
}

export class GerenciadorConfiguracaoOperacional {
  private estado: SnapshotConfiguracaoOperacional = {
    leitura: {
      status: "carregando",
      dados: null,
      erro: null,
      desatualizado: false,
    },
    salvamento: { status: "ocioso", mensagem: null },
    acessoNegado: false,
  }
  private versaoLeitura = 0
  private controleLeitura?: AbortController
  private controleSalvamento?: AbortController
  private ouvintes = new Set<() => void>()

  constructor(
    private negocioId: string,
    private role: Role,
    private consultar: (signal: AbortSignal) => Promise<ConfiguracaoNegocio>,
    private atualizar: (
      input: AtualizarConfiguracaoNegocioInput,
      signal: AbortSignal
    ) => Promise<ConfiguracaoNegocio>,
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

  private publicar(estado: SnapshotConfiguracaoOperacional) {
    this.estado = estado
    this.ouvintes.forEach((o) => o())
  }

  cancelar() {
    this.versaoLeitura++
    this.controleLeitura?.abort()
    this.controleSalvamento?.abort()
  }

  async carregar(): Promise<void> {
    this.versaoLeitura++
    const versao = this.versaoLeitura
    this.controleLeitura?.abort()
    const controle = new AbortController()
    this.controleLeitura = controle

    const dadosAnteriores = this.estado.leitura.dados
    this.publicar({
      ...this.estado,
      leitura: {
        status: "carregando",
        dados: dadosAnteriores,
        erro: null,
        desatualizado: Boolean(dadosAnteriores),
      },
      acessoNegado: false,
    })

    try {
      const dados = await executarComTimeout(
        this.consultar,
        controle,
        this.timeoutMs
      )
      if (versao !== this.versaoLeitura || !this.sessaoAtual()) return

      if (dados.negocioId !== this.negocioId) {
        throw new ApiError(403, "Escopo de estabelecimento divergente")
      }

      this.publicar({
        ...this.estado,
        leitura: {
          status: "sucesso",
          dados,
          erro: null,
          desatualizado: false,
        },
        acessoNegado: false,
      })
    } catch (erro) {
      if (versao !== this.versaoLeitura || !this.sessaoAtual()) return

      const acessoNegado =
        erro instanceof ApiError && [401, 403].includes(erro.statusCode)
      if (acessoNegado) {
        this.publicar({
          leitura: {
            status: "erro",
            dados: null,
            erro: mensagemErroLeitura(erro),
            desatualizado: false,
          },
          salvamento: { status: "ocioso", mensagem: null },
          acessoNegado: true,
        })
        if (erro instanceof ApiError && erro.statusCode === 401) {
          this.sessaoExpirada?.()
        }
        return
      }

      this.publicar({
        ...this.estado,
        leitura: {
          status: "erro",
          dados: null,
          erro: mensagemErroLeitura(erro),
          desatualizado: false,
        },
      })
    }
  }

  async salvar(input: AtualizarConfiguracaoNegocioInput): Promise<boolean> {
    if (this.role !== "DONO") {
      this.publicar({
        ...this.estado,
        salvamento: {
          status: "erro",
          mensagem:
            "Apenas o perfil DONO pode alterar as configurações operacionais.",
        },
      })
      return false
    }

    this.controleSalvamento?.abort()
    const controle = new AbortController()
    this.controleSalvamento = controle
    const versaoNoEnvio = this.versaoLeitura

    this.publicar({
      ...this.estado,
      salvamento: { status: "salvando", mensagem: null },
    })

    try {
      const atualizado = await executarComTimeout(
        (signal) => this.atualizar(input, signal),
        controle,
        this.timeoutMs
      )
      if (versaoNoEnvio !== this.versaoLeitura || !this.sessaoAtual()) {
        return false
      }
      if (atualizado.negocioId !== this.negocioId) {
        throw new ApiError(403, "Escopo de estabelecimento divergente")
      }

      this.publicar({
        leitura: {
          status: "sucesso",
          dados: atualizado,
          erro: null,
          desatualizado: false,
        },
        salvamento: {
          status: "sucesso",
          mensagem: "Configurações salvas no servidor.",
        },
        acessoNegado: false,
      })
      return true
    } catch (erro) {
      if (versaoNoEnvio !== this.versaoLeitura || !this.sessaoAtual()) {
        return false
      }

      this.publicar({
        ...this.estado,
        salvamento: {
          status: "erro",
          mensagem: mensagemErroSalvamento(erro),
        },
      })
      return false
    }
  }
}
