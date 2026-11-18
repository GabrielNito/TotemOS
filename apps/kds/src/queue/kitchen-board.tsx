import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { QueueController } from "./controller";
import { OrderCard } from "./order-card";
import { STAGE_UI, WAIT_UI, sortOrdersByArrival } from "./ui-config";
import type { OpenStatus, Order } from "./types";

type OrganizationMode = "kanban" | "primeiro-ultimo" | "ultimo-primeiro";
type GridColumns = 1 | 2 | 3;
type StatusFilter = "TODOS" | OpenStatus;

const stageOrder: OpenStatus[] = ["PENDENTE", "EM_PREPARO", "PRONTO"];

const organizationOptions: { id: OrganizationMode; label: string }[] = [
  { id: "kanban", label: "Kanban" },
  { id: "primeiro-ultimo", label: "Primeiro → Último" },
  { id: "ultimo-primeiro", label: "Último → Primeiro" },
];

const gridOptions: { cols: GridColumns; label: "1x1" | "2x1" | "3x1" }[] = [
  { cols: 1, label: "1x1" },
  { cols: 2, label: "2x1" },
  { cols: 3, label: "3x1" },
];

export function KitchenBoard({
  controller,
  name,
}: {
  controller: QueueController;
  name: string;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    () => controller.state,
  );
  const [now, setNow] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState<OrganizationMode>("kanban");
  const [userGrid, setUserGrid] = useState<GridColumns | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const { width } = useWindowDimensions();
  const isMobile = width > 0 && width < 640;
  const defaultColumns: GridColumns = isMobile
    ? 1
    : width > 0 && width < 1100
      ? viewMode === "kanban"
        ? 3
        : 2
      : 3;
  const activeColumns: GridColumns = userGrid ?? defaultColumns;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const filteredOrders =
    statusFilter === "TODOS"
      ? state.orders
      : state.orders.filter((o) => o.status === statusFilter);

  const orderedOrders =
    viewMode === "kanban"
      ? []
      : sortOrdersByArrival(
          filteredOrders,
          viewMode === "primeiro-ultimo" ? "asc" : "desc",
        );

  const visibleKanbanStages: OpenStatus[] =
    statusFilter !== "TODOS"
      ? [statusFilter]
      : activeColumns === 3
        ? stageOrder
        : ["PENDENTE"];

  const kanbanCardColumns: GridColumns =
    visibleKanbanStages.length === 1 ? activeColumns : 1;

  const renderOrderCell = (item: Order, cols: GridColumns) => (
    <View
      className={cols > 1 ? "flex-1 px-1.5" : "w-full"}
      style={cols > 1 ? { maxWidth: `${100 / cols}%` } : undefined}
    >
      <OrderCard
        order={item}
        now={now}
        isNew={state.newIds.includes(item.id)}
        pending={state.pending.find((p) => p.orderId === item.id)}
        rejection={state.rejected[item.id]}
        disabled={state.stale || state.busy}
        onAction={controller.act}
      />
    </View>
  );

  return (
    <SafeAreaView
      className={`flex-1 bg-background ${isMobile ? "px-3 py-2.5" : "px-4 py-3"}`}
      edges={["top", "bottom", "left", "right"]}
    >
      <View
        className={`mb-3 rounded-3xl border border-border bg-card ${isMobile ? "gap-3 px-4 py-3" : "flex-row items-center justify-between gap-4 px-5 py-3.5"}`}
      >
        <View className={isMobile ? "" : "flex-1"}>
          <Text className="text-xs font-semibold tracking-wider text-muted">
            TOTEMOS / COZINHA
          </Text>
          <Text className="mt-0.5 text-xl font-bold tracking-tight text-foreground">
            {name}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            className={`mt-0.5 text-xs font-medium ${state.stale ? "text-[#B45309]" : "text-[#047857]"}`}
          >
            {state.stale
              ? "Dados desatualizados"
              : state.busy
                ? "Atualizando…"
                : "Sincronizado"}
            {state.lastSync
              ? ` · última sincronização ${new Date(state.lastSync).toLocaleTimeString("pt-BR")}`
              : ""}
          </Text>
          <Text className="mt-1 text-xs text-muted">
            Espera visual: verde &lt; {WAIT_UI.attentionMinutes} min · amarelo
            até {WAIT_UI.longWaitMinutes} min · vermelho a partir de{" "}
            {WAIT_UI.longWaitMinutes} min. Sem previsão de conclusão.
          </Text>
        </View>

        <View
          className={
            isMobile
              ? "flex-row flex-wrap items-center justify-between gap-2"
              : "flex-row flex-wrap items-center justify-end gap-2"
          }
        >
          <View className="flex-row flex-wrap gap-1 rounded-2xl border border-border bg-surface p-1">
            {organizationOptions.map((option) => {
              const selected = viewMode === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setViewMode(option.id)}
                  className={`min-h-10 justify-center rounded-xl px-3 py-2 ${selected ? "border border-border bg-card" : ""}`}
                >
                  <Text
                    className={`text-xs font-semibold ${selected ? "text-foreground" : "text-muted"}`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="flex-row gap-1 rounded-2xl border border-border bg-surface p-1">
            {gridOptions.map((option) => {
              const selected = activeColumns === option.cols;
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setUserGrid(option.cols)}
                  className={`min-h-10 justify-center rounded-xl px-3 py-2 ${selected ? "border border-border bg-card" : ""}`}
                >
                  <Text
                    className={`text-xs font-semibold ${selected ? "text-foreground" : "text-muted"}`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={state.busy}
            onPress={() => void controller.recover()}
            className="min-h-12 justify-center rounded-2xl border border-border bg-surface px-4 py-2.5"
          >
            <Text className="text-sm font-bold text-foreground">
              {state.busy
                ? "Atualizando…"
                : state.recoveryPaused
                  ? "Retomar recuperação"
                  : "Atualizar"}
            </Text>
          </Pressable>
        </View>
      </View>

      {state.pending.length > 0 ? (
        <View className="mb-2 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5">
          <Text
            accessibilityLiveRegion="polite"
            className="text-xs font-medium text-[#92400E]"
          >
            {state.pending.length} operação(ões) aguardando confirmação,
            inclusive pedidos fora da fila.
            {state.recoveryPaused
              ? " Recuperação automática pausada por limite de tentativas ou rejeição do servidor. Toque em Retomar recuperação."
              : " Recuperação preserva a chave original. Aguarde a reconciliação para agir."}
          </Text>
        </View>
      ) : null}

      {state.message ? (
        <View className="mb-2 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5">
          <Text
            accessibilityRole="alert"
            className="text-xs font-medium text-destructive"
          >
            {state.message}
          </Text>
        </View>
      ) : null}

      {state.newIds.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={controller.acknowledge}
          className="mb-3 rounded-2xl bg-primary px-4 py-3"
        >
          <Text
            accessibilityLiveRegion="polite"
            className="text-sm font-bold text-white"
          >
            {state.newIds.length} novo(s) pedido(s) · toque para reconhecer
          </Text>
        </Pressable>
      ) : null}

      {!state.loaded ? (
        <View className="mb-3 flex-row items-center justify-center gap-3 rounded-2xl border border-border bg-card p-4">
          <ActivityIndicator color="#18181B" />
          <Text className="text-sm font-medium text-foreground">
            {state.busy
              ? "Carregando fila inicial…"
              : "Fila indisponível. Tente atualizar."}
          </Text>
        </View>
      ) : null}

      {state.loaded && state.orders.length === 0 ? (
        <View className="mb-3 rounded-2xl border border-dashed border-border bg-card/70 p-3">
          <Text className="text-center text-sm font-medium text-muted">
            Nenhum pedido na fila{state.stale ? " conhecida" : ""}.
          </Text>
        </View>
      ) : null}

      <View className="mb-3 flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: statusFilter === "TODOS" }}
          onPress={() => setStatusFilter("TODOS")}
          className={`min-h-11 flex-row items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 ${isMobile ? "min-w-[47%] flex-1" : "flex-1"} ${statusFilter === "TODOS" ? "border-primary bg-card" : "border-border bg-surface"}`}
        >
          <Text className="text-xs font-bold text-foreground">Todos</Text>
          <View className="rounded-full border border-border bg-surface px-2 py-0.5">
            <Text className="text-xs font-bold text-foreground">
              {state.orders.length}
            </Text>
          </View>
        </Pressable>

        {stageOrder.map((status) => {
          const stage = STAGE_UI[status];
          const count = state.orders.filter((o) => o.status === status).length;
          const selected = statusFilter === status;
          return (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setStatusFilter(status)}
              className={`min-h-11 flex-row items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 ${isMobile ? "min-w-[47%] flex-1" : "flex-1"} ${selected ? "border-primary bg-card" : "border-border bg-surface"}`}
            >
              <Text style={{ color: stage.color }} className="text-xs font-bold">
                {stage.title}
              </Text>
              <View
                style={{
                  backgroundColor: stage.badgeBg,
                  borderColor: stage.badgeBorder,
                }}
                className="rounded-full border px-2 py-0.5"
              >
                <Text
                  style={{ color: stage.color }}
                  className="text-xs font-bold"
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {viewMode === "kanban" ? (
        <View
          className={`flex-1 ${visibleKanbanStages.length === 1 ? "" : `flex-row ${width < 1100 ? "gap-3" : "gap-4"}`}`}
        >
          {visibleKanbanStages.map((status) => {
            const stage = STAGE_UI[status];
            const orders = state.orders.filter((o) => o.status === status);
            return (
              <View
                key={status}
                className={`flex-1 rounded-3xl border border-border bg-surface/50 ${width < 1100 ? "p-2.5" : "p-3"}`}
              >
                <View className="mb-3 flex-row items-center justify-between px-1">
                  <Text
                    style={{ color: stage.color }}
                    className="text-base font-bold"
                  >
                    {stage.title}
                  </Text>
                  <View
                    style={{
                      backgroundColor: stage.badgeBg,
                      borderColor: stage.badgeBorder,
                    }}
                    className="rounded-full border px-3 py-0.5"
                  >
                    <Text
                      style={{ color: stage.color }}
                      className="text-xs font-bold"
                    >
                      {orders.length}
                    </Text>
                  </View>
                </View>
                <FlatList
                  key={`kanban-${status}-${kanbanCardColumns}`}
                  data={orders}
                  numColumns={kanbanCardColumns}
                  keyExtractor={(o) => o.id}
                  contentContainerStyle={{ paddingBottom: 12 }}
                  ListEmptyComponent={
                    <View className="rounded-2xl border border-dashed border-border bg-card/70 p-4">
                      <Text className="text-center text-sm text-muted">
                        Sem pedidos nesta etapa
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) =>
                    renderOrderCell(item, kanbanCardColumns)
                  }
                />
              </View>
            );
          })}
        </View>
      ) : (
        <View
          className={`flex-1 rounded-3xl border border-border bg-surface/50 ${width < 1100 ? "p-2.5" : "p-3"}`}
        >
          <View className="mb-3 flex-row items-center justify-between gap-2 px-1">
            <Text className="text-base font-bold text-foreground">
              {viewMode === "primeiro-ultimo"
                ? "Ordem de chegada · Primeiro → Último"
                : "Ordem de chegada · Último → Primeiro"}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-medium text-muted">
                Grade {activeColumns}x1
              </Text>
              <View className="rounded-full border border-border bg-card px-3 py-0.5">
                <Text className="text-xs font-bold text-foreground">
                  {orderedOrders.length}
                </Text>
              </View>
            </View>
          </View>
          <FlatList
            key={`arrival-${activeColumns}`}
            data={orderedOrders}
            numColumns={activeColumns}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ paddingBottom: 12 }}
            ListEmptyComponent={
              <View className="rounded-2xl border border-dashed border-border bg-card/70 p-4">
                <Text className="text-center text-sm text-muted">
                  Sem pedidos na fila
                </Text>
              </View>
            }
            renderItem={({ item }) => renderOrderCell(item, activeColumns)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
