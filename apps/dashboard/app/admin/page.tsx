"use client"

import * as React from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { getAuthToken } from "@/lib/auth"
import { getPedidos, getDispositivos } from "@/lib/api"
import {
  ConsultaIndicadores,
  type FonteIndicadores,
} from "@/lib/indicadores-consulta"
import {
  agregarIndicadores,
  periodoAtual,
  resumirDispositivos,
  TIMEZONE,
  type PeriodoTipo,
} from "@/lib/indicadores"
import {
  formatarMoeda,
  formatarSenhaPedido,
  formatarStatusPedido,
  descreverOrigemPedido,
} from "@/lib/pedidos"
import { ChartPillBars } from "@/components/dashboard/chart-pill-bars"
import { ChartSplineMetric } from "@/components/dashboard/chart-spline-metric"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const card = "rounded-3xl border border-border/40 bg-card p-6 shadow-xs"
const rotulos: Record<PeriodoTipo, string> = {
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
  ano: "Ano",
}

function EstadoFonte({
  nome,
  fonte,
  carregando,
}: {
  nome: string
  fonte: FonteIndicadores<unknown>
  carregando: boolean
}) {
  const [tempo, setTempo] = React.useState(false)
  React.useEffect(() => {
    const idade = fonte.atualizadoEm
      ? Date.now() - new Date(fonte.atualizadoEm).getTime()
      : 0
    const timer = setTimeout(() => setTempo(true), Math.max(0, 300000 - idade))
    return () => clearTimeout(timer)
  }, [fonte.atualizadoEm])
  const velha = Boolean(fonte.atualizadoEm && tempo)
  return (
    <div className="text-xs text-muted-foreground" aria-live="polite">
      <p>
        {nome}:{" "}
        {carregando
          ? "Atualizando…"
          : fonte.atualizadoEm
            ? `Consulta concluída em ${new Date(fonte.atualizadoEm).toLocaleString("pt-BR", { timeZone: TIMEZONE })}`
            : "Sem consulta concluída"}
      </p>
      {fonte.erro && (
        <p role="alert" className="text-destructive">
          {fonte.erro}
        </p>
      )}
      {fonte.dados !== null && (fonte.erro || velha || carregando) && (
        <p>Dados desatualizados. Último snapshot preservado; use Atualizar.</p>
      )}
    </div>
  )
}

function Metrica({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string
  valor: React.ReactNode
  detalhe: string
}) {
  return (
    <div className={card}>
      <h2 className="text-xs font-medium text-muted-foreground">{titulo}</h2>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user, isLoading, logout } = useAuth()
  const token = getAuthToken()
  if (isLoading)
    return (
      <Skeleton className="h-48 rounded-3xl" aria-label="Carregando sessão" />
    )
  if (
    !user?.negocioId ||
    !token ||
    !["DONO", "GERENTE"].includes(user.role ?? "")
  )
    return (
      <p role="alert">
        Sessão administrativa inválida.{" "}
        <Link href="/login">Entrar novamente</Link>
      </p>
    )
  return (
    <VisaoGeral
      key={`${user.negocioId}:${user.id ?? user.sub}:${token}`}
      negocioId={user.negocioId}
      token={token}
      nome={user.negocioNome ?? "Painel de Gestão"}
      onReautenticar={logout}
    />
  )
}

export function VisaoGeral({
  negocioId,
  token,
  nome,
  onReautenticar,
}: {
  negocioId: string
  token: string
  nome: string
  onReautenticar?: () => void
}) {
  const [consulta] = React.useState(
    () =>
      new ConsultaIndicadores(
        async (signal) => {
          const pedidos = await getPedidos({}, token, signal)
          agregarIndicadores(pedidos, [], negocioId, periodoAtual("dia"), true)
          return pedidos
        },
        async (signal) => {
          const { dispositivos } = await getDispositivos(token, signal)
          resumirDispositivos(dispositivos, negocioId)
          return dispositivos
        }
      )
  )
  const estado = React.useSyncExternalStore(
    consulta.assinar,
    consulta.snapshot,
    consulta.snapshot
  )
  React.useEffect(() => {
    void consulta.atualizar()
    return () => consulta.cancelar()
  }, [consulta])
  const [tipo, setTipo] = React.useState<PeriodoTipo>("dia")
  const [incluirDemo, setIncluirDemo] = React.useState(false)
  const periodo = React.useMemo(
    () =>
      periodoAtual(
        tipo,
        estado.pedidos.atualizadoEm
          ? new Date(estado.pedidos.atualizadoEm)
          : new Date()
      ),
    [tipo, estado.pedidos.atualizadoEm]
  )
  const resultado = React.useMemo(
    () =>
      estado.pedidos.dados === null
        ? null
        : agregarIndicadores(
            estado.pedidos.dados,
            estado.dispositivos.dados ?? [],
            negocioId,
            periodo,
            incluirDemo
          ),
    [
      estado.pedidos.dados,
      estado.dispositivos.dados,
      negocioId,
      periodo,
      incluirDemo,
    ]
  )
  const dispositivos = estado.dispositivos.dados
  const resumo =
    dispositivos === null ? null : resumirDispositivos(dispositivos, negocioId)
  const descricao = `${incluirDemo ? "Comerciais e DEMO" : "Sem DEMO"}; todos os status. Criação em ${TIMEZONE}.`
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div
        className={`${card} flex flex-col justify-between gap-4 sm:flex-row sm:items-center`}
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{nome}</h1>
          <p className="text-xs text-muted-foreground">
            Indicadores operacionais de pedidos e cadastro de dispositivos.
          </p>
          <EstadoFonte
            key={`pedidos:${estado.pedidos.atualizadoEm}`}
            nome="Pedidos"
            fonte={estado.pedidos}
            carregando={estado.carregando}
          />
          <EstadoFonte
            key={`dispositivos:${estado.dispositivos.atualizadoEm}`}
            nome="Dispositivos"
            fonte={estado.dispositivos}
            carregando={estado.carregando}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          {estado.pedidos.erro?.includes("(401)") && onReautenticar && (
            <Button onClick={onReautenticar}>Entrar novamente</Button>
          )}
          <Button
            variant="outline"
            disabled={estado.carregando}
            onClick={() => void consulta.atualizar()}
          >
            {estado.carregando ? "Atualizando…" : "Atualizar"}
          </Button>
          <Link href="/admin/catalogo" className="text-sm underline">
            Cardápio
          </Link>
          <Link href="/admin/dispositivos" className="text-sm underline">
            Totens & KDS
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div
          role="group"
          aria-label="Período de criação"
          className="flex gap-1"
        >
          {(Object.keys(rotulos) as PeriodoTipo[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={tipo === p ? "secondary" : "ghost"}
              aria-pressed={tipo === p}
              onClick={() => setTipo(p)}
            >
              {rotulos[p]}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={incluirDemo}
            onChange={(e) => setIncluirDemo(e.target.checked)}
          />
          Incluir DEMO na fila, origem e gráficos
        </label>
        <p className="w-full text-xs text-muted-foreground">
          Criação: {periodo.inicio} (inclusivo) até {periodo.fim} (exclusivo),
          dias civis em {TIMEZONE}. Semana: segunda a domingo. Status atuais na
          última consulta.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {resultado ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Metrica
                  titulo="Pedidos registrados"
                  valor={resultado.comercial.totalPedidos}
                  detalhe="Criados no período, sem DEMO; inclui cancelamentos."
                />
                <Metrica
                  titulo="Valor dos pedidos"
                  valor={formatarMoeda(resultado.valorPedidos)}
                  detalhe="Valor nominal, não receita. Inclui aguardando pagamento, pendente, em preparo, pronto e entregue. Sem DEMO e cancelados."
                />
                <Metrica
                  titulo="Fila da cozinha no período"
                  valor={resultado.fila.length}
                  detalhe={`Pendente, em preparo e pronto. ${incluirDemo ? "Inclui DEMO identificados na lista." : "Sem DEMO."} Apenas pedidos criados no intervalo.`}
                />
                <Metrica
                  titulo="Entregues"
                  valor={resultado.comercial.pedidosEntregues}
                  detalhe="Status ENTREGUE, sem DEMO. Não comprova pagamento."
                />
              </div>
              <div className={`${card} space-y-3 text-sm`}>
                <p>
                  Aguardando liberação:{" "}
                  <strong>
                    {resultado.comercial.pedidosAguardandoPagamento}
                  </strong>{" "}
                  (AGUARDANDO_PAGAMENTO, sem DEMO)
                </p>
                <p>
                  Cancelamentos:{" "}
                  <strong>{resultado.comercial.pedidosCancelados}</strong> ·{" "}
                  {formatarMoeda(resultado.valorCancelados)} nominais excluídos.
                  Sem DEMO. Inclui aguardando estorno; não comprova estorno
                  financeiro.
                </p>
                <p>
                  DEMO: <strong>{resultado.demo.totalPedidos}</strong>{" "}
                  registrados · {formatarMoeda(resultado.valorDemo)}{" "}
                  operacionais sem cancelados. Fila DEMO:{" "}
                  {resultado.demo.pedidosAtivosNaFila}. Não são vendas
                  financeiras.
                </p>
              </div>
              <ChartPillBars data={resultado.horas} descricao={descricao} />
              <div className={card}>
                <h2 className="mb-2 text-sm font-semibold">
                  Fila dos pedidos criados no período
                </h2>
                <Link className="text-xs underline" href="/admin/pedidos">
                  Ver histórico de pedidos
                </Link>
                {!resultado.fila.length ? (
                  <p className="py-8 text-sm text-muted-foreground">
                    Nenhum pedido na fila para este período e filtro.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-border/40">
                    {resultado.fila.slice(0, 20).map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap justify-between gap-3 py-3 text-xs"
                      >
                        <span>
                          {formatarSenhaPedido(p.senha)} ·{" "}
                          {formatarStatusPedido(p.status)}
                          {p.demo ? " · DEMO" : ""}
                          <br />
                          {p.itens
                            .map((i) => `${i.quantidade}x ${i.nomeProduto}`)
                            .join(", ")}
                        </span>
                        <span>
                          {descreverOrigemPedido(p, dispositivos ?? []).rotulo}
                          <br />
                          {formatarMoeda(p.valorTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {resultado.fila.length > 20 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Exibindo 20 de {resultado.fila.length}. Consulte o histórico
                    para os demais.
                  </p>
                )}
              </div>
            </>
          ) : estado.carregando ? (
            <Skeleton
              className="h-64 rounded-3xl"
              aria-label="Carregando indicadores"
            />
          ) : (
            <div role="alert" className={card}>
              Indicadores de pedidos indisponíveis. Use Atualizar para tentar
              novamente.
            </div>
          )}
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          {estado.carregando && !resultado ? (
            <Skeleton
              className="h-64 rounded-3xl"
              aria-label="Carregando série de pedidos"
            />
          ) : (
            <ChartSplineMetric
              key={`${tipo}:${incluirDemo}`}
              data={resultado?.serie}
              descricao={descricao}
            />
          )}
          {resultado && (
            <div className={`${card} space-y-2 text-xs`}>
              <h2 className="text-sm font-semibold">Origem dos pedidos</h2>
              <p>{descricao}</p>
              <p>Totem identificado: {resultado.origens.totem}</p>
              <p>Direta (sem dispositivo): {resultado.origens.direta}</p>
              <p>
                Terminal não identificado como Totem:{" "}
                {resultado.origens.naoIdentificada}
              </p>
              <p>
                Com origem offline histórica: {resultado.origens.offline}{" "}
                (subconjunto das origens acima)
              </p>
              {estado.dispositivos.erro && (
                <p>
                  Identificação de terminais limitada pela falha do cadastro.
                </p>
              )}
            </div>
          )}
          <div className={`${card} space-y-3`}>
            <h2 className="text-sm font-semibold">Dispositivos cadastrados</h2>
            <p className="text-xs text-muted-foreground">
              Cadastro total, independente do período de pedidos. Conectividade
              não medida.
            </p>
            {resumo ? (
              resumo.map((d) => (
                <p key={d.tipo} className="text-xs">
                  {d.tipo}: {d.total} cadastrados · {d.ativos} ativos no
                  cadastro · {d.revogados} revogados
                </p>
              ))
            ) : (
              <p className="text-sm">
                {estado.carregando
                  ? "Carregando cadastro…"
                  : "Cadastro indisponível. Use Atualizar."}
              </p>
            )}
          </div>
          <div className={`${card} space-y-2 text-xs text-muted-foreground`}>
            <h2 className="text-sm font-semibold text-foreground">
              Medições indisponíveis
            </h2>
            <p>
              Faturamento indisponível: contrato financeiro ainda não
              homologado.
            </p>
            <p>Tempo no Totem: ainda não medido.</p>
            <p>Tempo médio de preparo: ainda não medido.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
