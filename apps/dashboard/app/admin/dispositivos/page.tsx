"use client"

import * as React from "react"
import {
  TabletSmartphone,
  Plus,
  Tv,
  CreditCard,
  ShieldCheck,
  RotateCw,
  QrCode,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Dispositivo } from "@/lib/types/models"

export default function DispositivosPage() {
  // Estados dinâmicos preparados para receber dados reais do backend
  const [devices] = React.useState<Dispositivo[]>([])
  const [codigoPareamento, setCodigoPareamento] = React.useState<string | null>(
    null
  )

  const gerarCodigo = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    setCodigoPareamento(code)
  }

  const totensOnline = devices.filter(
    (d) => d.tipo === "TOTEM" && d.ativo
  ).length
  const totensTotal = devices.filter((d) => d.tipo === "TOTEM").length
  const painelAtivo = devices.some((d) => d.tipo === "PAINEL" && d.ativo)
  const pointPareadas = devices.filter((d) => !!d.mpPointDeviceId).length

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header Banner com Ação de Pareamento */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dispositivos & Terminais
            </h1>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              {devices.length} Registrados
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gerenciamento de totens de autoatendimento, maquininhas Mercado Pago
            e painéis KDS.
          </p>
        </div>

        <Button
          onClick={gerarCodigo}
          size="sm"
          className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
        >
          <Plus className="size-3.5" />
          Gerar Código de Pareamento
        </Button>
      </div>

      {/* Box de Código Temporário de Pareamento se Ativo */}
      {codigoPareamento && (
        <div className="flex animate-in flex-col items-center justify-between gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-xs duration-200 fade-in-50 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <QrCode className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Código de Pareamento de 6 Dígitos
              </h4>
              <p className="text-xs text-muted-foreground">
                Digite este código na tela inicial do seu Totem ou Painel KDS
                (válido por 10 minutos).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-2xl border border-primary/20 bg-background px-4 py-2 font-mono text-2xl font-bold tracking-widest text-primary tabular-nums shadow-xs">
              {codigoPareamento}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCodigoPareamento(null)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}

      {/* Grade de 4 Métricas Bento */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Totens em Operação
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TabletSmartphone className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {totensOnline} / {totensTotal}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {totensTotal > 0
                ? `${totensOnline} conectados na rede`
                : "Nenhum totem pareado"}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Painel KDS Cozinha
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Tv className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {painelAtivo ? "Ativo" : "Inativo"}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {painelAtivo
                ? "Servidor local conectado"
                : "Nenhum KDS conectado"}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Maquininhas MP Point
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CreditCard className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {pointPareadas}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {pointPareadas > 0 ? "Terminais vinculados" : "Nenhuma vinculada"}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Resiliência Offline
            </span>
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-3 space-y-0.5">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              Habilitada
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Armazenamento local ativo
            </span>
          </div>
        </div>
      </div>

      {/* Bento Grid dos Dispositivos Cadastrados ou Empty State */}
      {devices.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {devices.map((dev) => (
            <div
              key={dev.id}
              className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs transition-all hover:border-border/80"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                    {dev.tipo === "TOTEM" ? (
                      <TabletSmartphone className="size-5" />
                    ) : (
                      <Tv className="size-5" />
                    )}
                  </div>

                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {dev.ativo ? "ONLINE" : "OFFLINE"}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    {dev.nome}
                  </h3>
                  {dev.ipLocal && (
                    <span className="block font-mono text-xs text-muted-foreground">
                      IP Local: {dev.ipLocal}
                    </span>
                  )}
                </div>

                <div className="space-y-2 rounded-2xl border border-border/40 bg-muted/20 p-3.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Terminal / Pagamento:</span>
                    <span className="max-w-42.5 truncate text-[11px] font-semibold text-foreground">
                      {dev.mpPointDeviceId || "Não configurado"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tipo:</span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {dev.tipo}
                    </span>
                  </div>
                  {dev.versaoApp && (
                    <div className="flex items-center justify-between">
                      <span>Versão do App:</span>
                      <span className="font-mono text-[11px] text-foreground">
                        {dev.versaoApp}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-xs text-muted-foreground">
                <span>
                  Pareado em{" "}
                  {new Date(dev.createdAt).toLocaleDateString("pt-BR")}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <RotateCw className="size-3" />
                  Testar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/40 p-12 text-center shadow-xs">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <TabletSmartphone className="size-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Nenhum dispositivo pareado no momento
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Gere um código de pareamento de 6 dígitos para conectar seus totens
            de autoatendimento e o painel KDS da cozinha.
          </p>
          <Button
            onClick={gerarCodigo}
            size="sm"
            className="mt-4 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            Gerar Código de Pareamento
          </Button>
        </div>
      )}
    </div>
  )
}
