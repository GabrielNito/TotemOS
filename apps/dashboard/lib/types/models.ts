// Definições de Tipos TypeScript alinhadas ao schema Prisma do TotemOS

export type Role = "DONO" | "GERENTE"

export type TipoDispositivo = "TOTEM" | "PAINEL"

export type StatusPedido =
  | "AGUARDANDO_PAGAMENTO"
  | "PENDENTE"
  | "EM_PREPARO"
  | "PRONTO"
  | "ENTREGUE"
  | "CANCELADO_AGUARDANDO_ESTORNO"
  | "CANCELADO"

export type StatusPagamento = "PENDENTE" | "APROVADO" | "RECUSADO" | "ESTORNADO"

export type MeioPagamento = "CREDITO" | "DEBITO" | "PIX"

export type MetodoPagamento =
  "PIX" | "CARTAO_DEBITO" | "CARTAO_CREDITO" | "OFFLINE_PENDENTE"

export interface Usuario {
  id: string
  negocioId: string
  email: string
  nome: string
  role: Role
  createdAt: string
}

export interface Dispositivo {
  id: string
  negocioId: string
  nome: string
  tipo: TipoDispositivo
  pareadoEm: string | null
  ativo: boolean
  revogadoEm: string | null
  createdAt: string
}

export interface Categoria {
  id: string
  negocioId: string
  nome: string
  ordem: number
  ativo: boolean
  produtos?: Produto[]
}

export interface ProdutoVariacao {
  id: string
  produtoId: string
  nome: string
  preco: number
  esgotado: boolean
}

export interface Adicional {
  id: string
  produtoId: string
  nome: string
  preco: number
  maximo: number
  esgotado: boolean
}

export interface Produto {
  id: string
  negocioId: string
  categoriaId: string
  categoria?: Pick<Categoria, "id" | "nome">
  nome: string
  descricao?: string | null
  precoBase: number
  imagemUrl?: string | null
  tempoEstimadoPreparo: number // 0 = Preparo Zero
  esgotado: boolean
  ativo: boolean
  variacoes?: ProdutoVariacao[]
  adicionais?: Adicional[]
}

export interface PedidoItemAdicional {
  id: string
  pedidoItemId: string
  adicionalId?: string | null
  nomeAdicional: string
  precoNoMomento: number
  quantidade: number
}

export interface PedidoItemEscolha {
  id: string
  pedidoItemId: string
  itemDoGrupoId?: string | null
  nomeItem: string
  deltaNoMomento: number
}

export interface PedidoItem {
  id: string
  pedidoId: string
  produtoId?: string | null
  nomeProduto: string
  precoNoMomento: number
  quantidade: number
  observacao?: string | null
  variacaoNome?: string | null
  adicionais?: PedidoItemAdicional[]
  escolhas?: PedidoItemEscolha[]
}

export interface Pagamento {
  id: string
  pedidoId: string
  mpIntentId?: string | null
  mpPaymentId?: string | null
  status: StatusPagamento
  meio?: MeioPagamento | null
  valor: number
  createdAt: string
  updatedAt: string
}

export interface Pedido {
  id: string
  negocioId: string
  dispositivoId?: string | null
  dispositivo?: Dispositivo | null
  senha: number | null
  senhaAtribuidaEm?: string | null
  dataSequencial: string
  dataOperacional?: string | null
  status: StatusPedido
  nomeCliente?: string | null
  codigoCliente?: string | null
  valorTotal: number
  observacoes?: string | null
  origemOffline: boolean
  preparoZero?: boolean
  demo?: boolean
  demoAmbiente?: string | null
  versao?: number
  createdAt: string
  updatedAt: string
  itens: PedidoItem[]
  pagamentos?: Pagamento[]
}

export interface PedidoFilaItem {
  id: string
  status: StatusPedido
  senha: number | null
  dataOperacional: string | null
  createdAt: string
  versao: number
  demo: boolean
  demoAmbiente: string | null
  preparoZero: boolean
  elegivelCozinha: true
  autorizacaoOperacional?: {
    tipo: "DEMO"
    financeira: false
  } | null
  itens: Array<{
    nomeProduto: string
    quantidade: number
    variacaoNome: string | null
    observacao: string | null
    adicionais: Array<{ nomeAdicional: string; quantidade: number }>
    escolhas: Array<{ nomeItem: string }>
  }>
}

export interface FilaPedidosResponse {
  pedidos: PedidoFilaItem[]
  proximoCursor: string | null
}

export interface DashboardMetrics {
  faturamentoHoje: number
  crescimentoHojePercentual: number
  pedidosNaFila: number
  tempoMedioPreparoMinutos: number
  totensAtivosCount: number
  totensTotalCount: number
}
