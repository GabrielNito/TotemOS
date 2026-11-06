"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Circle,
  RefreshCw,
  Store,
  TabletSmartphone,
  SlidersHorizontal,
  UtensilsCrossed,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getAuthToken, type UserSession } from "@/lib/auth"
import { getCatalogoAdministrativo, getDispositivos } from "@/lib/api"
import {
  ConsultaConfiguracao,
  type FonteConfiguracao,
} from "@/lib/configuracao-inicial-consulta"
import {
  configuracaoOperacional,
  diagnosticarCatalogo,
  diagnosticarEquipamentos,
  type DiagnosticoEtapa,
  type StatusEtapa,
} from "@/lib/configuracao-inicial"
import { cn } from "@/lib/utils"

const card = "rounded-3xl border border-border/40 bg-card p-6 shadow-xs"
const etapas = [
  { titulo: "Estabelecimento", icone: Store },
  { titulo: "Catálogo", icone: UtensilsCrossed },
  { titulo: "Configurações operacionais", icone: SlidersHorizontal },
  { titulo: "Equipamentos", icone: TabletSmartphone },
]
const rotulos: Record<StatusEtapa, string> = {
  concluido: "Concluído",
  pendente: "Pendente",
  indisponivel: "Indisponível",
  carregando: "Carregando",
  erro: "Erro",
}
function Status({ status }: { status: StatusEtapa }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full text-[10px]",
        status === "concluido" &&
          "border-emerald-600/20 bg-emerald-600/10 text-emerald-800 dark:text-emerald-400",
        status === "erro" && "text-destructive"
      )}
    >
      {rotulos[status]}
    </Badge>
  )
}
function diagnosticoFonte<T>(
  fonte: FonteConfiguracao<T>,
  diagnosticar: (dados: T) => DiagnosticoEtapa
): DiagnosticoEtapa {
  if (fonte.status === "carregando")
    return {
      status: "carregando",
      descricao: "Consultando os dados atuais do estabelecimento…",
    }
  if (fonte.status === "erro" || fonte.dados === null)
    return {
      status: "erro",
      descricao: fonte.erro ?? "Dados indisponíveis. Tente novamente.",
    }
  return diagnosticar(fonte.dados)
}

interface AssistenteProps {
  user: UserSession
  token: string
  onSessaoExpirada?: () => void
  sessaoAtual?: () => boolean
}

export default function ConfiguracaoInicialPage() {
  const { user, isLoading, logout } = useAuth()
  const token = getAuthToken()
  React.useEffect(() => {
    if (!isLoading && (!user || !token)) logout()
  }, [isLoading, user, token, logout])
  if (isLoading)
    return (
      <div role="status" aria-label="Validando sessão" className={card}>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <span className="sr-only">Validando sessão</span>
      </div>
    )
  if (
    !user ||
    !token ||
    !user.negocioId ||
    !["DONO", "GERENTE"].includes(user.role ?? "")
  )
    return (
      <div role="alert" className={card}>
        Entre com uma conta administrativa para continuar.{" "}
        <Link href="/login" className="underline">
          Ir para login
        </Link>
      </div>
    )
  return (
    <AssistenteConfiguracao
      user={user}
      token={token}
      onSessaoExpirada={logout}
      sessaoAtual={() => getAuthToken() === token}
    />
  )
}

export function AssistenteConfiguracao(props: AssistenteProps) {
  // A chave remove os snapshots e a navegação assim que a identidade mudar.
  return (
    <AssistenteSessao
      key={JSON.stringify([
        props.user.negocioId,
        props.user.id ?? props.user.sub,
        props.token,
      ])}
      {...props}
    />
  )
}

function AssistenteSessao({
  user,
  token,
  onSessaoExpirada,
  sessaoAtual,
}: AssistenteProps) {
  const [consulta] = React.useState(
    () =>
      new ConsultaConfiguracao(
        user.negocioId!,
        (signal) => getCatalogoAdministrativo(token, signal),
        (signal) => getDispositivos(token, signal),
        onSessaoExpirada,
        20000,
        sessaoAtual
      )
  )
  const snapshot = React.useSyncExternalStore(
    consulta.assinar,
    consulta.snapshot,
    consulta.snapshot
  )
  const [selecionada, setSelecionada] = React.useState(0)
  React.useEffect(() => {
    void consulta.atualizar()
    return () => consulta.cancelar()
  }, [consulta])

  const diagnosticos: DiagnosticoEtapa[] = [
    {
      status: "concluido",
      descricao:
        "Estabelecimento e conta administrativa reconhecidos pela sessão autenticada.",
    },
    diagnosticoFonte(snapshot.catalogo, diagnosticarCatalogo),
    configuracaoOperacional,
    diagnosticoFonte(snapshot.dispositivos, (dados) =>
      diagnosticarEquipamentos(dados.dispositivos)
    ),
  ]
  const contagem = (status: StatusEtapa) =>
    diagnosticos.filter((d) => d.status === status).length
  const atual = diagnosticos[selecionada]
  const proxima = diagnosticos.findIndex(
    (d) => d.status === "pendente" || d.status === "erro"
  )
  const equipamentos = snapshot.dispositivos.dados
    ? diagnosticarEquipamentos(snapshot.dispositivos.dados.dispositivos)
    : null
  const carregando = diagnosticos.some((d) => d.status === "carregando")
  const Icone = etapas[selecionada].icone
  const href =
    selecionada === 1
      ? "/admin/catalogo"
      : selecionada === 3
        ? "/admin/dispositivos"
        : null

  if (snapshot.acessoNegado)
    return (
      <div role="alert" className={card}>
        <h1 className="text-xl font-semibold">
          Não foi possível validar o acesso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {snapshot.catalogo.erro} Entre novamente para continuar.
        </p>
        {onSessaoExpirada ? (
          <Button
            variant="outline"
            className="mt-4 min-h-11 rounded-xl"
            onClick={onSessaoExpirada}
          >
            Trocar conta
          </Button>
        ) : (
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 rounded-xl"
            )}
          >
            Ir para login
          </Link>
        )}
      </div>
    )

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Prepare seu estabelecimento
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure o essencial para começar a receber pedidos pelo TotemOS.
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 self-start rounded-xl"
          disabled={carregando}
          onClick={() => void consulta.atualizar()}
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Atualizar diagnóstico
        </Button>
      </header>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {contagem("concluido")}{" "}
        {contagem("concluido") === 1 ? "etapa pronta" : "etapas prontas"} ·{" "}
        {contagem("pendente")}{" "}
        {contagem("pendente") === 1 ? "pendente" : "pendentes"} ·{" "}
        {contagem("indisponivel")} aguardando integração
        {contagem("carregando") > 0 &&
          ` · ${contagem("carregando")} carregando`}
        {contagem("erro") > 0 && ` · ${contagem("erro")} com erro`}
      </p>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <nav aria-label="Etapas da configuração inicial" className={card}>
            <ol className="grid gap-3 sm:grid-cols-2">
              {etapas.map((etapa, indice) => (
                <li key={etapa.titulo} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={selecionada === indice}
                    aria-controls="conteudo-etapa"
                    onClick={() => setSelecionada(indice)}
                    className={cn(
                      "flex min-h-20 w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      selecionada === indice
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/40 hover:bg-muted/40"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                    >
                      {diagnosticos[indice].status === "concluido" ? (
                        <Check className="size-3.5" />
                      ) : (
                        indice + 1
                      )}
                    </span>
                    <span className="min-w-0 space-y-2">
                      <span className="block text-sm font-semibold">
                        {etapa.titulo}
                      </span>
                      <Status status={diagnosticos[indice].status} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <section
            id="conteudo-etapa"
            aria-labelledby="titulo-etapa"
            aria-busy={atual.status === "carregando"}
            className={cn(card, "min-w-0 space-y-5")}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Icone
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
              <h2 id="titulo-etapa" className="text-lg font-semibold">
                {etapas[selecionada].titulo}
              </h2>
              <Status status={atual.status} />
            </div>
            {atual.status === "carregando" ? (
              <div
                role="status"
                aria-label="Carregando etapa"
                className="space-y-3"
              >
                <Skeleton className="h-5 w-full rounded-xl" />
                <Skeleton className="h-5 w-2/3 rounded-xl" />
              </div>
            ) : (
              <p
                role={atual.status === "erro" ? "alert" : undefined}
                className="text-sm leading-relaxed text-muted-foreground"
              >
                {atual.descricao}
              </p>
            )}
            {selecionada === 0 && (
              <dl className="grid gap-4 rounded-2xl bg-muted/30 p-4 text-sm sm:grid-cols-2">
                {[
                  ["Estabelecimento", user.negocioNome ?? "Nome não informado"],
                  [
                    "Conta administrativa",
                    user.nome ?? user.email ?? "Nome não informado",
                  ],
                  ["Identificação do negócio", user.negocioId],
                  ["Perfil", user.role],
                ].map(([nome, valor]) => (
                  <div key={nome}>
                    <dt className="text-xs text-muted-foreground">{nome}</dt>
                    <dd className="mt-1 font-medium wrap-anywhere">{valor}</dd>
                  </div>
                ))}
              </dl>
            )}
            {selecionada === 0 && (
              <p className="text-xs text-muted-foreground">
                O cadastro já existe. A configuração operacional permanece
                aguardando integração.
              </p>
            )}
            {selecionada === 1 && snapshot.catalogo.dados && (
              <p className="text-xs text-muted-foreground">
                Categorias cadastradas:{" "}
                {snapshot.catalogo.dados.categorias.length}. Ativas:{" "}
                {
                  snapshot.catalogo.dados.categorias.filter((c) => c.ativo)
                    .length
                }{" "}
                · Produtos cadastrados:{" "}
                {snapshot.catalogo.dados.produtos.length}. Produtos inativos,
                esgotados ou em categorias inativas ficam fora da vitrine.
              </p>
            )}
            {selecionada === 3 && (
              <p className="text-xs text-muted-foreground">
                Códigos de pareamento são gerados pelo dono na página de
                dispositivos e inseridos no aplicativo do equipamento.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {atual.status === "erro" && (
                <Button
                  variant="outline"
                  className="min-h-11 rounded-xl"
                  onClick={() => void consulta.atualizar()}
                >
                  Tentar novamente
                </Button>
              )}
              {href && (
                <Link
                  href={href}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "min-h-11 rounded-xl"
                  )}
                >
                  {selecionada === 1
                    ? "Abrir catálogo"
                    : "Gerenciar dispositivos"}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
              {selecionada < 3 && (
                <Button
                  variant="ghost"
                  className="min-h-11 rounded-xl"
                  onClick={() => setSelecionada(selecionada + 1)}
                >
                  Próxima etapa
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              )}
            </div>
          </section>
        </div>
        <aside className="min-w-0 space-y-6" aria-label="Resumo operacional">
          <section className={cn(card, "space-y-4")}>
            <h2 className="text-sm font-semibold">Próxima ação</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {proxima >= 0
                ? diagnosticos[proxima].descricao
                : carregando
                  ? "Aguarde a consulta dos dados atuais."
                  : "Os recursos disponíveis foram verificados. As configurações operacionais ainda aguardam integração."}
            </p>
            {proxima >= 0 && (
              <Button
                variant="outline"
                className="min-h-11 w-full rounded-xl"
                onClick={() => setSelecionada(proxima)}
              >
                Ver {etapas[proxima].titulo.toLowerCase()}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            )}
          </section>
          <section className={cn(card, "space-y-4")}>
            <h2 className="text-sm font-semibold">Equipamentos cadastrados</h2>
            {equipamentos ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt>Totens válidos</dt>
                  <dd className="font-semibold">{equipamentos.totens}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Painéis KDS válidos</dt>
                  <dd className="font-semibold">{equipamentos.paineis}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                {snapshot.dispositivos.status === "carregando"
                  ? "Carregando cadastro…"
                  : "Cadastro não consultado. Tente novamente."}
              </p>
            )}
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Circle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              Conectividade não informada. Cadastro ativo não confirma conexão
              do equipamento.
            </p>
          </section>
          <p className="px-2 text-xs leading-relaxed text-muted-foreground">
            Você pode sair e continuar depois. Ao voltar, o diagnóstico será
            consultado novamente. Após alterar o catálogo ou os equipamentos,
            use Atualizar diagnóstico.
          </p>
        </aside>
      </div>
    </div>
  )
}
