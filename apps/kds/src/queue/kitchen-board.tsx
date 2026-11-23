import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { QueueController } from "./controller";
import { OrderCard } from "./order-card";
import type { OpenStatus, Order } from "./types";

type Filter = "TODOS" | OpenStatus;

const filters: {
  status: Filter;
  title: string;
  color: string;
  foreground: string;
}[] = [
  { status: "TODOS", title: "Todos", color: "#292524", foreground: "#FFFFFF" },
  {
    status: "PENDENTE",
    title: "Pendentes",
    color: "#F4C430",
    foreground: "#241B00",
  },
  {
    status: "EM_PREPARO",
    title: "Em preparo",
    color: "#2563EB",
    foreground: "#FFFFFF",
  },
  {
    status: "PRONTO",
    title: "Prontos",
    color: "#15803D",
    foreground: "#FFFFFF",
  },
];

const countLabel = (count: number) =>
  `${count} ${count === 1 ? "pedido" : "pedidos"}`;

function QueueCard({
  order,
  now,
  controller,
  state,
}: {
  order: Order;
  now: number;
  controller: QueueController;
  state: QueueController["state"];
}) {
  return (
    <View className="px-1.5" style={{ flex: 1 }}>
      <OrderCard
        order={order}
        now={now}
        isNew={state.newIds.includes(order.id)}
        pending={state.pending.find((pending) => pending.orderId === order.id)}
        rejection={state.rejected[order.id]}
        disabled={state.stale || state.busy}
        onAction={controller.act}
      />
    </View>
  );
}

export function KitchenBoard({
  controller,
  name,
  offlinePending = 0,
}: {
  controller: QueueController;
  name: string;
  offlinePending?: number;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    () => controller.state,
  );
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("TODOS");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [menuProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    menuProgress.setValue(reduceMotion ? 1 : 0);
    Animated.timing(menuProgress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 140,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuProgress, reduceMotion]);

  const counts = useMemo(
    () => ({
      TODOS: state.orders.length,
      PENDENTE: state.orders.filter((order) => order.status === "PENDENTE")
        .length,
      EM_PREPARO: state.orders.filter((order) => order.status === "EM_PREPARO")
        .length,
      PRONTO: state.orders.filter((order) => order.status === "PRONTO").length,
    }),
    [state.orders],
  );
  const visibleOrders = useMemo(
    () =>
      filter === "TODOS"
        ? state.orders
        : state.orders.filter((order) => order.status === filter),
    [filter, state.orders],
  );
  const columns = width >= 1180 ? 3 : width >= 720 ? 2 : 1;
  const syncLabel = state.stale
    ? "Dados desatualizados"
    : state.busy
      ? "Atualizando…"
      : "Sincronizado";

  const closeMenu = () => {
    if (reduceMotion) {
      setMenuOpen(false);
      return;
    }
    Animated.timing(menuProgress, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMenuOpen(false);
    });
  };

  const recover = () => {
    void controller.recover();
  };

  return (
    <SafeAreaView
      className="flex-1 bg-[#F5F5F4]"
      edges={["top", "bottom", "left", "right"]}
    >
      <View className="border-b border-[#D6D3D1] bg-white px-3 py-2">
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir menu da cozinha"
            android_ripple={{ color: "#D6D3D1" }}
            hitSlop={6}
            onPress={() => setMenuOpen(true)}
            className="h-14 w-14 items-center justify-center rounded-lg border border-[#D6D3D1] bg-[#FAFAF9]"
          >
            <Text className="text-2xl font-black text-[#1C1917]">☰</Text>
          </Pressable>
          <View className="mr-1 min-w-24">
            <Text className="text-lg font-black text-[#1C1917]">Cozinha</Text>
            <View className="flex-row items-center gap-1.5">
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: state.stale ? "#DC2626" : "#15803D",
                }}
              />
              <Text
                accessibilityLiveRegion="polite"
                className="text-xs font-semibold text-[#57534E]"
              >
                {syncLabel}
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {filters.map((item) => {
              const selected = filter === item.status;
              const count = counts[item.status];
              return (
                <Pressable
                  key={item.status}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${countLabel(count)}`}
                  accessibilityState={{ selected }}
                  android_ripple={{ color: "#FFFFFF33" }}
                  onPress={() => setFilter(item.status)}
                  className="min-w-28 flex-row items-center justify-center gap-2 rounded-lg border-2 px-3"
                  style={{
                    minHeight: 56,
                    backgroundColor: selected ? item.color : "#FFFFFF",
                    borderColor: item.color,
                  }}
                >
                  <Text
                    className="text-base font-black"
                    style={{
                      color: selected ? item.foreground : "#292524",
                    }}
                  >
                    {item.title}
                  </Text>
                  <View
                    className="min-w-7 items-center rounded px-1.5 py-0.5"
                    style={{
                      backgroundColor: selected ? "#FFFFFF" : item.color,
                    }}
                  >
                    <Text
                      className="text-sm font-black"
                      style={{
                        color: selected ? item.color : item.foreground,
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {offlinePending > 0 && (
        <View className="bg-[#FEF3C7] px-4 py-3">
          <Text
            accessibilityLiveRegion="polite"
            className="text-base font-black text-[#78350F]"
          >
            {offlinePending} pedido{offlinePending === 1 ? "" : "s"} recebido
            {offlinePending === 1 ? "" : "s"} pela rede local
          </Text>
          <Text className="mt-1 text-sm font-semibold text-[#92400E]">
            Aguardando nuvem e pagamento. Estes pedidos não estão na fila de
            preparo e não possuem senha.
          </Text>
        </View>
      )}

      {state.pending.length > 0 && (
        <View className="flex-row items-center justify-between gap-3 bg-[#FFF7ED] px-4 py-2">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 text-sm font-semibold text-[#9A3412]"
          >
            {state.pending.length} operação(ões) aguardando confirmação,
            inclusive pedidos fora da fila. Recuperação preserva a chave
            original.
          </Text>
          {state.recoveryPaused && (
            <Pressable
              accessibilityRole="button"
              onPress={recover}
              className="min-h-14 justify-center rounded-lg bg-[#9A3412] px-4"
            >
              <Text className="font-black text-white">Retomar recuperação</Text>
            </Pressable>
          )}
        </View>
      )}
      {!!state.message && (
        <Text
          accessibilityRole="alert"
          className="bg-[#FEF2F2] px-4 py-2 text-sm font-semibold text-[#991B1B]"
        >
          {state.message}
        </Text>
      )}
      {state.newIds.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={controller.acknowledge}
          className="min-h-14 justify-center bg-[#1D4ED8] px-4"
        >
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-base font-black text-white"
          >
            {state.newIds.length === 1
              ? "1 pedido novo"
              : `${state.newIds.length} pedidos novos`}{" "}
            · toque para reconhecer
          </Text>
        </Pressable>
      )}

      {!state.loaded && (
        <View className="flex-1 flex-row items-center justify-center gap-3 p-4">
          <ActivityIndicator color="#2563EB" size="large" />
          <Text className="text-base font-semibold text-[#292524]">
            {state.busy
              ? "Carregando fila inicial…"
              : "Fila indisponível. Tente atualizar."}
          </Text>
        </View>
      )}
      {state.loaded && visibleOrders.length === 0 && (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-xl font-black text-[#44403C]">
            Nenhum pedido {filter === "TODOS" ? "na fila" : "nesta etapa"}
          </Text>
          {state.stale && (
            <Text className="mt-2 text-base text-[#78716C]">
              Exibindo a última fila conhecida.
            </Text>
          )}
        </View>
      )}
      {state.loaded && visibleOrders.length > 0 && (
        <FlatList
          key={columns}
          data={visibleOrders}
          numColumns={columns}
          keyExtractor={(order) => order.id}
          contentContainerStyle={{
            paddingHorizontal: 6,
            paddingTop: 12,
            paddingBottom: 20,
          }}
          renderItem={({ item }) => (
            <QueueCard
              order={item}
              now={now}
              controller={controller}
              state={state}
            />
          )}
        />
      )}

      <Modal
        animationType="none"
        transparent
        visible={menuOpen}
        onRequestClose={closeMenu}
      >
        <Animated.View
          className="flex-1 flex-row bg-black/40"
          style={{ opacity: menuProgress }}
        >
          <Pressable
            accessibilityLabel="Fechar menu da cozinha"
            accessibilityRole="button"
            className="flex-1"
            onPress={closeMenu}
          />
          <Animated.View
            className="h-full w-80 max-w-[88%] bg-white p-5"
            style={{
              transform: [
                {
                  translateX: menuProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [32, 0],
                  }),
                },
              ],
            }}
          >
            <View className="mb-6 flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-black text-[#1C1917]">
                  Menu da cozinha
                </Text>
                <Text className="mt-1 text-base font-semibold text-[#57534E]">
                  {name}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Fechar menu"
                accessibilityRole="button"
                hitSlop={8}
                onPress={closeMenu}
                className="h-12 w-12 items-center justify-center rounded-lg bg-[#F5F5F4]"
              >
                <Text className="text-2xl font-bold text-[#292524]">×</Text>
              </Pressable>
            </View>
            <View className="mb-6 rounded-lg bg-[#F5F5F4] p-4">
              <Text className="text-sm font-bold text-[#57534E]">
                Estado da fila
              </Text>
              <Text
                className={`mt-1 text-lg font-black ${state.stale ? "text-[#B91C1C]" : "text-[#166534]"}`}
              >
                {syncLabel}
              </Text>
              {state.lastSync && (
                <Text className="mt-1 text-sm text-[#78716C]">
                  Última sincronização às{" "}
                  {new Date(state.lastSync).toLocaleTimeString("pt-BR")}
                </Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                state.recoveryPaused ? "Retomar recuperação" : "Atualizar fila"
              }
              disabled={state.busy}
              onPress={() => {
                closeMenu();
                recover();
              }}
              className="min-h-14 items-center justify-center rounded-lg bg-[#18181B] px-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            >
              <Text className="text-lg font-black text-white">
                {state.busy
                  ? "Atualizando…"
                  : state.recoveryPaused
                    ? "Retomar recuperação"
                    : "Atualizar fila"}
              </Text>
            </Pressable>
            <Text className="mt-auto text-sm leading-5 text-[#78716C]">
              As ações operacionais continuam disponíveis nos cards.
              Configurações administrativas permanecem fora da tela
              compartilhada da cozinha.
            </Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
