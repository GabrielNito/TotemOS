// Definições de Tipos TypeScript alinhadas ao schema Prisma do TotemOS

export type Role = "DONO" | "GERENTE"

export type TipoDispositivo = "TOTEM" | "PAINEL"

export type StatusPedido =
  | "AGUARDANDO_PAGAMENTO"
  | "PENDENTE"
  | "EM_PREPARO"
  | "PRONTO"
  | "ENTREGUE"
  | "CANCELADO"

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
  token: string
  codigoPareamento?: string | null
  pareadoEm?: string | null
  mpPointDeviceId?: string | null
  ativo: boolean
  ipLocal?: string
  versaoApp?: string
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
  categoria?: Categoria
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

export interface PedidoItem {
  id: string
  pedidoId: string
  produtoId?: string | null
  nomeProduto: string
  precoNoMomento: number
  quantidade: number
  observacao?: string | null
  variacaoNome?: string | null
}

export interface Pedido {
  id: string
  negocioId: string
  dispositivoId?: string | null
  dispositivo?: Dispositivo | null
  senha: number
  dataSequencial: string
  status: StatusPedido
  nomeCliente?: string | null
  codigoCliente?: string | null
  valorTotal: number
  observacoes?: string | null
  origemOffline: boolean
  createdAt: string
  updatedAt: string
  itens: PedidoItem[]
}

export interface DashboardMetrics {
  faturamentoHoje: number
  crescimentoHojePercentual: number
  pedidosNaFila: number
  tempoMedioPreparoMinutos: number
  totensAtivosCount: number
  totensTotalCount: number
}
