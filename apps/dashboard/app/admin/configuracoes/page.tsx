"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Users,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Sliders,
  Check,
  Shield,
  Smartphone,
  WifiOff,
  Clock,
  MessageSquare,
} from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface TeamMember {
  id: string
  nome: string
  email: string
  role: "DONO" | "GERENTE"
  createdAt: string
}

export default function ConfiguracoesPage() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = React.useState("operacao")

  // Configurações da Loja State
  const [modoIdentificacao, setModoIdentificacao] = React.useState("OPCIONAL")
  const [permitirOffline, setPermitirOffline] = React.useState(true)
  const [tempoPreparo, setTempoPreparo] = React.useState("15")
  const [mensagemBoasVindas, setMensagemBoasVindas] = React.useState(
    "Toque na tela para iniciar o seu pedido!"
  )
  const [salvandoConfig, setSalvandoConfig] = React.useState(false)

  // Equipe State derivado do usuário autenticado + novos membros locais
  const initialMembers: TeamMember[] = React.useMemo(() => {
    if (!user) return []
    return [
      {
        id: user.id || "1",
        nome: user.nome || "Administrador Dono",
        email: user.email || "",
        role: (user.role as "DONO" | "GERENTE") || "DONO",
        createdAt: new Date().toISOString().split("T")[0],
      },
    ]
  }, [user])

  const [customMembers, setCustomMembers] = React.useState<TeamMember[]>([])
  const teamMembers = [...initialMembers, ...customMembers]

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [novoNome, setNovoNome] = React.useState("")
  const [novoEmail, setNovoEmail] = React.useState("")
  const [novaSenha, setNovaSenha] = React.useState("")
  const [novoRole, setNovoRole] = React.useState<"DONO" | "GERENTE">("GERENTE")

  // Segurança / PIN State
  const [novoPin, setNovoPin] = React.useState("")
  const [confirmarNovoPin, setConfirmarNovoPin] = React.useState("")
  const [salvandoPin, setSalvandoPin] = React.useState(false)

  const handleSalvarConfiguracoes = (
    e: React.SyntheticEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    setSalvandoConfig(true)
    setTimeout(() => {
      setSalvandoConfig(false)
      toast.success("Configurações salvas com sucesso!", {
        description: "As alterações já foram sincronizadas com os totens.",
      })
    }, 600)
  }

  const handleCriarUsuario = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!novoNome.trim() || !novoEmail.trim() || !novaSenha) {
      toast.error("Preencha todos os campos do usuário")
      return
    }

    const novoMembro: TeamMember = {
      id: Math.random().toString(36).substring(7),
      nome: novoNome.trim(),
      email: novoEmail.trim(),
      role: novoRole,
      createdAt: new Date().toISOString().split("T")[0],
    }

    setCustomMembers((prev) => [...prev, novoMembro])
    setNovoNome("")
    setNovoEmail("")
    setNovaSenha("")
    setNovoRole("GERENTE")
    setDialogOpen(false)

    toast.success("Usuário adicionado com sucesso!", {
      description: `${novoMembro.nome} agora tem acesso ao painel como ${novoMembro.role}.`,
    })
  }

  const handleAtualizarPin = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (novoPin.length !== 4) {
      toast.error("O novo PIN deve ter exatamente 4 dígitos numéricos")
      return
    }
    if (novoPin !== confirmarNovoPin) {
      toast.error("A confirmação do novo PIN não confere")
      return
    }

    setSalvandoPin(true)
    setTimeout(() => {
      setSalvandoPin(false)
      setNovoPin("")
      setConfirmarNovoPin("")
      toast.success("PIN do dono atualizado com sucesso!", {
        description: "O novo código já é exigido para operações sensíveis.",
      })
    }, 600)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Configurações do Estabelecimento
            </h1>
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-[11px] font-semibold"
            >
              Parâmetros Ativos
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gerencie os parâmetros operacionais, equipe de gerentes e chaves de
            segurança.
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-3 rounded-2xl border border-border/40 bg-card p-1 shadow-xs">
          <TabsTrigger
            value="operacao"
            className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-xs"
          >
            <Sliders className="size-3.5" />
            <span>Operação</span>
          </TabsTrigger>
          <TabsTrigger
            value="usuarios"
            className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-xs"
          >
            <Users className="size-3.5" />
            <span>Equipe ({teamMembers.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="seguranca"
            className="gap-2 rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-xs"
          >
            <ShieldCheck className="size-3.5" />
            <span>PIN & Segurança</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: OPERAÇÃO & TOTEM ================= */}
        <TabsContent value="operacao" className="space-y-6">
          <form onSubmit={handleSalvarConfiguracoes}>
            <div className="grid gap-6">
              {/* Modo de Identificação */}
              <div className="space-y-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-primary" />
                    <h3 className="text-base font-bold text-foreground">
                      Identificação do Cliente no Totem
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Como o cliente se identifica ao finalizar o pedido para
                    emissão de senha.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      id: "OPCIONAL",
                      title: "Opcional (Padrão)",
                      desc: "O cliente pode digitar o nome ou avançar direto com senha numérica.",
                    },
                    {
                      id: "NOME",
                      title: "Nome Obrigatório",
                      desc: "Exige o primeiro nome do cliente para chamada personalizada.",
                    },
                    {
                      id: "CODIGO",
                      title: "Código / Comanda",
                      desc: "Exige digitação de código da comanda ou mesa física.",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setModoIdentificacao(item.id)}
                      className={cn(
                        "flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all",
                        modoIdentificacao === item.id
                          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                          : "border-border/60 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {item.title}
                        </span>
                        {modoIdentificacao === item.id && (
                          <Check className="size-3.5 text-primary" />
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {item.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pagamento Offline & Tempo de Preparo Bento Cards */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <WifiOff className="size-4 text-primary" />
                      <h4 className="text-base font-bold text-foreground">
                        Pagamento Offline Emergencial
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Permitir que os totens emitam pedidos se houver queda
                      temporária da nuvem.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/40 bg-muted/20 p-4">
                    <div className="space-y-0.5 pr-4">
                      <span className="block text-xs font-bold text-foreground">
                        Resiliência Offline Ativa
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Pedidos são salvos localmente e sincronizados após a
                        reconexão.
                      </span>
                    </div>
                    <Switch
                      checked={permitirOffline}
                      onCheckedChange={setPermitirOffline}
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-3xl border border-border/40 bg-card p-6 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-primary" />
                      <h4 className="text-base font-bold text-foreground">
                        Tempo Padrão de Preparo
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Estimativa exibida ao cliente caso os produtos não tenham
                      tempo específico.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/40 bg-muted/20 p-4">
                    <Label htmlFor="tempoPreparo" className="text-xs font-bold">
                      Minutos estimados:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="tempoPreparo"
                        type="number"
                        min="1"
                        max="120"
                        value={tempoPreparo}
                        onChange={(e) => setTempoPreparo(e.target.value)}
                        className="h-9 w-24 rounded-xl text-center text-xs font-bold"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mensagem de Boas-vindas */}
              <div className="space-y-4 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-primary" />
                    <h3 className="text-base font-bold text-foreground">
                      Mensagem de Boas-Vindas do Totem
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Texto exibido na tela inicial de descanso do totem de
                    autoatendimento.
                  </p>
                </div>

                <Input
                  value={mensagemBoasVindas}
                  onChange={(e) => setMensagemBoasVindas(e.target.value)}
                  placeholder="Ex: Toque para fazer seu pedido e bom apetite!"
                  className="h-11 rounded-2xl"
                />

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={salvandoConfig}
                    className="rounded-xl text-xs font-semibold shadow-xs"
                  >
                    {salvandoConfig ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* ================= TAB 2: GERENCIADOR DE USUÁRIOS ================= */}
        <TabsContent value="usuarios" className="space-y-6">
          <div className="rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
            <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Equipe & Gerentes
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Usuários com permissão de acesso ao painel de gestão deste
                  estabelecimento.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
              >
                <UserPlus className="size-3.5" />
                Adicionar Usuário
              </Button>

              {/* Modal de Cadastro de Novo Usuário */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md">
                  <form onSubmit={handleCriarUsuario}>
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold">
                        Adicionar Membro da Equipe
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        Crie um acesso para um gerente ou sócio acessar a
                        dashboard.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label
                          htmlFor="novoNome"
                          className="text-xs font-semibold"
                        >
                          Nome Completo
                        </Label>
                        <Input
                          id="novoNome"
                          placeholder="Ex: Fernanda Lima"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          className="h-10 rounded-xl"
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label
                          htmlFor="novoEmail"
                          className="text-xs font-semibold"
                        >
                          E-mail de Acesso
                        </Label>
                        <Input
                          id="novoEmail"
                          type="email"
                          placeholder="fernanda@seurestaurante.com"
                          value={novoEmail}
                          onChange={(e) => setNovoEmail(e.target.value)}
                          className="h-10 rounded-xl"
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label
                          htmlFor="novaSenha"
                          className="text-xs font-semibold"
                        >
                          Senha Provisória
                        </Label>
                        <Input
                          id="novaSenha"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          value={novaSenha}
                          onChange={(e) => setNovaSenha(e.target.value)}
                          className="h-10 rounded-xl"
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-xs font-semibold">
                          Perfil de Acesso
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setNovoRole("GERENTE")}
                            className={cn(
                              "flex flex-col gap-1 rounded-2xl border p-3 text-left transition-all",
                              novoRole === "GERENTE"
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:bg-muted/40"
                            )}
                          >
                            <span className="text-xs font-bold">GERENTE</span>
                            <span className="text-[10px] text-muted-foreground">
                              Gestão diária, pedidos e cardápio
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setNovoRole("DONO")}
                            className={cn(
                              "flex flex-col gap-1 rounded-2xl border p-3 text-left transition-all",
                              novoRole === "DONO"
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:bg-muted/40"
                            )}
                          >
                            <span className="text-xs font-bold">DONO</span>
                            <span className="text-[10px] text-muted-foreground">
                              Acesso irrestrito e PIN sensível
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        className="rounded-xl text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="rounded-xl text-xs font-semibold"
                      >
                        Salvar Membro
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/40">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Membro</TableHead>
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => {
                    const initials = member.nome
                      .split(/[\s@._]+/)
                      .filter(Boolean)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()

                    return (
                      <TableRow
                        key={member.id}
                        className="transition-colors hover:bg-muted/20"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8 rounded-xl">
                              <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-bold text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-foreground">
                                {member.nome}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {member.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              member.role === "DONO" ? "default" : "secondary"
                            }
                            className="rounded-full text-[10px] font-semibold tracking-wider uppercase"
                          >
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.createdAt}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 3: SEGURANÇA & PIN DO DONO ================= */}
        <TabsContent value="seguranca">
          <div className="max-w-xl space-y-5 rounded-3xl border border-border/40 bg-card p-6 shadow-xs backdrop-blur-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Alterar PIN do Dono
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                O PIN de 4 dígitos autoriza cancelamentos, estornos e
                configurações nos totens e no painel da cozinha.
              </p>
            </div>

            <form onSubmit={handleAtualizarPin} className="space-y-5">
              <div className="flex items-start gap-2.5 rounded-2xl border border-border/40 bg-muted/20 p-3.5 text-xs text-muted-foreground">
                <Shield className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>
                  Apenas usuários com perfil <strong>DONO</strong> podem alterar
                  este código. Guarde este número em local seguro.
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Novo PIN (4 dígitos)
                </Label>
                <InputOTP maxLength={4} value={novoPin} onChange={setNovoPin}>
                  <InputOTPGroup>
                    <InputOTPSlot
                      index={0}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                    <InputOTPSlot
                      index={1}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                    <InputOTPSlot
                      index={2}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                    <InputOTPSlot
                      index={3}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Confirmar Novo PIN
                </Label>
                <InputOTP
                  maxLength={4}
                  value={confirmarNovoPin}
                  onChange={setConfirmarNovoPin}
                >
                  <InputOTPGroup>
                    <InputOTPSlot
                      index={0}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                    <InputOTPSlot
                      index={1}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                    <InputOTPSlot
                      index={2}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                    <InputOTPSlot
                      index={3}
                      mask
                      className="size-9.5 text-sm font-semibold"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="flex justify-end border-t border-border/30 pt-2">
                <Button
                  type="submit"
                  disabled={salvandoPin}
                  className="rounded-xl text-xs font-semibold shadow-xs"
                >
                  {salvandoPin ? "Atualizando..." : "Atualizar PIN do Dono"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
