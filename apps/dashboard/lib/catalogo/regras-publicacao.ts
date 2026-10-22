import type { Categoria, Produto } from "../types/models"

export interface CategoriaPublica extends Categoria {
  produtos: Produto[]
}

export interface DiagnosticoPublicacao {
  totalProdutos: number
  produtosVisiveisNoTotem: number
  produtosInativos: number
  produtosEsgotados: number
  totalCategorias: number
  categoriasVisiveisNoTotem: number
  categoriasInativas: number
  categoriasOcultasPorFaltaDeProdutos: number
}

/**
 * Aplica estritamente as regras de visibilidade do catálogo público do TotemOS:
 * 1. Categorias ativas, ordenadas por ordem crescente.
 * 2. Produtos ativos e não esgotados, ordenados por nome alfabeticamente.
 * 3. Adicionais não esgotados.
 * 4. Categorias sem nenhum produto visível são descartadas da vitrine.
 */
export function filtrarCatalogoPublico(
  categorias: Categoria[],
  produtos: Produto[]
): CategoriaPublica[] {
  const categoriasAtivas = categorias
    .filter((c) => c.ativo)
    .sort((a, b) => a.ordem - b.ordem)

  return categoriasAtivas
    .map((categoria) => {
      const produtosDisponiveis = produtos
        .filter(
          (p) =>
            p.categoriaId === categoria.id &&
            p.ativo === true &&
            p.esgotado === false
        )
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((p) => ({
          ...p,
          adicionais: p.adicionais?.filter((adicional) => !adicional.esgotado),
        }))

      return {
        ...categoria,
        produtos: produtosDisponiveis,
      }
    })
    .filter((categoria) => categoria.produtos.length > 0)
}

export function calcularDiagnosticoPublicacao(
  categorias: Categoria[],
  produtos: Produto[]
): DiagnosticoPublicacao {
  const publico = filtrarCatalogoPublico(categorias, produtos)
  const produtosVisiveisNoTotem = publico.reduce(
    (total, cat) => total + cat.produtos.length,
    0
  )
  const produtosInativos = produtos.filter((p) => !p.ativo).length
  const produtosEsgotados = produtos.filter((p) => p.ativo && p.esgotado).length
  const categoriasInativas = categorias.filter((c) => !c.ativo).length

  // Categorias ativas que ficaram com 0 produtos visíveis
  const categoriasOcultasPorFaltaDeProdutos = categorias.filter((c) => {
    if (!c.ativo) return false
    const temProdutoVisivel = produtos.some(
      (p) => p.categoriaId === c.id && p.ativo && !p.esgotado
    )
    return !temProdutoVisivel
  }).length

  return {
    totalProdutos: produtos.length,
    produtosVisiveisNoTotem,
    produtosInativos,
    produtosEsgotados,
    totalCategorias: categorias.length,
    categoriasVisiveisNoTotem: publico.length,
    categoriasInativas,
    categoriasOcultasPorFaltaDeProdutos,
  }
}
