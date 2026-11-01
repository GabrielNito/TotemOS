import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { waitColor } from "./ui-config";
import type { Order, PendingOperation } from "./types";
export const actionLabel = {
  PENDENTE: "Iniciar preparo",
  EM_PREPARO: "Marcar pronto",
  PRONTO: "Confirmar entrega",
};
export function elapsed(createdAt: string, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(createdAt)) / 60000),
  );
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
export const OrderCard = memo(function OrderCard({
  order,
  now,
  isNew,
  pending,
  disabled,
  onAction,
}: {
  order: Order;
  now: number;
  isNew: boolean;
  pending?: PendingOperation;
  disabled: boolean;
  onAction: (order: Order) => void;
}) {
  return (
    <View
      className={`mb-4 rounded-2xl border-2 p-4 ${isNew ? "border-primary bg-[#1C4668]" : "border-[#34536C] bg-[#193B56]"}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-3xl font-bold text-foreground">
          {order.senha === null
            ? `#${order.id.slice(0, 6)}`
            : `${order.senha.toString().padStart(3, "0")}`}
        </Text>
        {isNew && <Text className="font-bold text-[#73C3FF]">NOVO</Text>}
      </View>
      {order.dataOperacional && (
        <Text className="mt-1 text-sm text-muted">
          Dia {order.dataOperacional.split("-").reverse().join("/")}
        </Text>
      )}
      <Text
        style={{
          color: waitColor(
            Math.max(0, (now - Date.parse(order.createdAt)) / 60000),
          ),
        }}
        className="mb-3 mt-2 text-base"
      >
        {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · há {elapsed(order.createdAt, now)}
      </Text>
      {order.demo && (
        <Text className="mb-3 font-bold text-[#F7CB73]">
          DEMO · {order.demoAmbiente ?? "Demonstração"}
        </Text>
      )}
      {order.itens.map((item, index) => (
        <View key={index} className="mb-4">
          <Text className="text-xl font-semibold text-foreground">
            {item.quantidade}× {item.nomeProduto}
          </Text>
          {item.variacaoNome && (
            <Text className="mt-1 text-base text-foreground">
              {item.variacaoNome}
            </Text>
          )}
          {item.adicionais.map((a, i) => (
            <Text key={i} className="mt-1 text-base text-muted">
              + {a.quantidade}× {a.nomeAdicional}
            </Text>
          ))}
          {item.escolhas.map((e, i) => (
            <Text key={i} className="mt-1 text-base text-muted">
              • {e.nomeItem}
            </Text>
          ))}
          {item.observacao && (
            <View className="mt-2 rounded-lg bg-[#304B57] p-3">
              <Text className="text-base font-semibold text-[#FFE4A8]">
                Obs.: {item.observacao}
              </Text>
            </View>
          )}
        </View>
      ))}
      {order.preparoZero && (
        <Text className="mb-3 text-base text-muted">
          Sem preparo na cozinha
        </Text>
      )}
      {pending && (
        <Text
          accessibilityLiveRegion="polite"
          className="mb-3 text-base text-[#F7CB73]"
        >
          {pending.nextAttempt > now
            ? "Resultado incerto. Recuperação agendada."
            : pending.kind === "senha"
              ? "Atribuindo senha…"
              : "Confirmando operação…"}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${order.senha === null ? "Solicitar senha" : actionLabel[order.status]} do pedido ${order.senha ?? order.id.slice(0, 6)}`}
        accessibilityState={{
          disabled: disabled || !!pending,
          busy: !!pending,
        }}
        disabled={disabled || !!pending}
        onPress={() => onAction(order)}
        className={`min-h-16 items-center justify-center rounded-xl px-3 py-4 ${disabled || pending ? "bg-[#34536C]" : "bg-primary"}`}
      >
        <Text className="text-center text-lg font-bold text-white">
          {order.senha === null ? "Solicitar senha" : actionLabel[order.status]}
        </Text>
      </Pressable>
    </View>
  );
});
