import type { CatalogoAdministrativo } from "./api"
import { calcularDiagnosticoPublicacao } from "./catalogo/regras-publicacao"
import type { Dispositivo } from "./types/models"

export type StatusEtapa =
  "concluido" | "pendente" | "revisao_pendente" | "carregando" | "erro"
export interface DiagnosticoEtapa {
  status: StatusEtapa
  descricao: string
}

export function diagnosticarCatalogo(
  catalogo: CatalogoAdministrativo
): DiagnosticoEtapa {
  const d = calcularDiagnosticoPublicacao(
    catalogo.categorias,
    catalogo.produtos
  )
  if (d.produtosVisiveisNoTotem > 0)
    return {
      status: "concluido",
      descricao: `${d.produtosVisiveisNoTotem} ${d.produtosVisiveisNoTotem === 1 ? "produto disponível" : "produtos disponíveis"} em ${d.categoriasVisiveisNoTotem} ${d.categoriasVisiveisNoTotem === 1 ? "categoria ativa" : "categorias ativas"} para exibição no Totem.`,
    }
  const ativas = catalogo.categorias.filter((c) => c.ativo)
  let descricao: string
  if (!catalogo.categorias.length)
    descricao = "Crie uma categoria para organizar seu catálogo."
  else if (!ativas.length)
    descricao = "Ative uma categoria para exibir seus produtos."
  else if (
    !catalogo.produtos.some((p) => ativas.some((c) => c.id === p.categoriaId))
  )
    descricao = "Cadastre um produto em uma categoria ativa."
  else if (
    !catalogo.produtos.some(
      (p) => p.ativo && ativas.some((c) => c.id === p.categoriaId)
    )
  )
    descricao = "Ative um produto em uma categoria ativa."
  else
    descricao =
      "Marque ao menos um produto ativo como disponível, sem estar esgotado, em uma categoria ativa."
  return { status: "pendente", descricao }
}

export function diagnosticarEquipamentos(dispositivos: Dispositivo[]) {
  const validos = dispositivos.filter(
    (d) => d.ativo && d.revogadoEm === null && d.pareadoEm !== null
  )
  const totens = validos.filter((d) => d.tipo === "TOTEM").length
  const paineis = validos.filter((d) => d.tipo === "PAINEL").length
  const faltam = [!totens && "um Totem", !paineis && "um Painel KDS"]
    .filter(Boolean)
    .join(" e ")
  return {
    status: totens && paineis ? ("concluido" as const) : ("pendente" as const),
    descricao: faltam
      ? `Falta parear ${faltam}. Gere um código de pareamento na página de dispositivos e informe-o no equipamento.`
      : "Totem e Painel KDS pareados e ativos no cadastro. A conectividade não é informada por esta consulta.",
    totens,
    paineis,
  }
}
