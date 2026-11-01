import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { QueueController } from "./controller";
import { OrderCard } from "./order-card";
import { WAIT_UI } from "./ui-config";
import type { OpenStatus } from "./types";
const stages: { status: OpenStatus; title: string; color: string }[] = [
  { status: "PENDENTE", title: "Pendentes", color: "#F7CB73" },
  { status: "EM_PREPARO", title: "Em preparo", color: "#73C3FF" },
  { status: "PRONTO", title: "Prontos", color: "#7DE2BC" },
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
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "bottom", "left", "right"]}
    >
      <View className="flex-row items-center justify-between border-b border-[#34536C] px-5 py-4">
        <View className="flex-1">
          <Text className="text-sm font-bold tracking-widest text-muted">
            TOTEMOS / COZINHA
          </Text>
          <Text className="mt-1 text-2xl font-bold text-foreground">
            {name}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            className={`mt-1 text-base ${state.stale ? "text-[#F7CB73]" : "text-[#7DE2BC]"}`}
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
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={state.busy}
          onPress={() => void controller.refresh()}
          className="min-h-14 justify-center rounded-xl bg-[#254B69] px-6"
        >
          <Text className="text-lg font-bold text-foreground">
            {state.busy ? "Atualizando…" : "Atualizar"}
          </Text>
        </Pressable>
      </View>
      {!!state.message && (
        <Text
          accessibilityRole="alert"
          className="bg-[#493F30] px-5 py-3 text-base text-[#FFE4A8]"
        >
          {state.message}
        </Text>
      )}
      {state.newIds.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={controller.acknowledge}
          className="bg-primary px-5 py-3"
        >
          <Text
            accessibilityLiveRegion="polite"
            className="text-lg font-bold text-white"
          >
            {state.newIds.length} novo(s) pedido(s) · toque para reconhecer
          </Text>
        </Pressable>
      )}
      {!state.loaded && (
        <View className="flex-row items-center justify-center gap-3 p-4">
          <ActivityIndicator color="#73C3FF" />
          <Text className="text-base text-foreground">
            {state.busy
              ? "Carregando fila inicial…"
              : "Fila indisponível. Tente atualizar."}
          </Text>
        </View>
      )}
      {state.loaded && state.orders.length === 0 && (
        <Text className="p-3 text-center text-lg text-muted">
          Nenhum pedido na fila{state.stale ? " conhecida" : ""}.
        </Text>
      )}
      <Text className="px-5 pt-2 text-sm text-muted">
        Espera visual: verde &lt; {WAIT_UI.attentionMinutes} min · amarelo até{" "}
        {WAIT_UI.longWaitMinutes} min · vermelho a partir de{" "}
        {WAIT_UI.longWaitMinutes} min. Sem previsão de conclusão.
      </Text>
      <View className="flex-1 flex-row gap-4 px-4 pt-4">
        {stages.map((stage) => {
          const orders = state.orders.filter((o) => o.status === stage.status);
          return (
            <View key={stage.status} className="flex-1">
              <View className="mb-4 flex-row items-center justify-between">
                <Text
                  style={{ color: stage.color }}
                  className="text-xl font-bold"
                >
                  {stage.title}
                </Text>
                <Text className="rounded-lg bg-[#254B69] px-3 py-1 text-lg font-bold text-foreground">
                  {orders.length}
                </Text>
              </View>
              <FlatList
                data={orders}
                keyExtractor={(o) => o.id}
                contentContainerStyle={{ paddingBottom: 16 }}
                ListEmptyComponent={
                  <Text className="p-4 text-center text-base text-muted">
                    Sem pedidos nesta etapa
                  </Text>
                }
                renderItem={({ item }) => (
                  <OrderCard
                    order={item}
                    now={now}
                    isNew={state.newIds.includes(item.id)}
                    pending={state.pending.find((p) => p.orderId === item.id)}
                    disabled={state.stale || state.busy}
                    onAction={controller.act}
                  />
                )}
              />
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
