import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import type { Order, PendingOperation } from "./types";

export const actionLabel = {
  PENDENTE: "Iniciar preparo",
  EM_PREPARO: "Marcar pronto",
  PRONTO: "Confirmar entrega",
};

const stageUi = {
  PENDENTE: {
    label: "Pendente",
    background: "#F4C430",
    foreground: "#241B00",
    action: "#18181B",
  },
  EM_PREPARO: {
    label: "Em preparo",
    background: "#2563EB",
    foreground: "#FFFFFF",
    action: "#166534",
  },
  PRONTO: {
    label: "Pronto",
    background: "#15803D",
    foreground: "#FFFFFF",
    action: "#18181B",
  },
} as const;

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
  rejection,
  disabled,
  onAction,
}: {
  order: Order;
  now: number;
  isNew: boolean;
  pending?: PendingOperation;
  rejection?: string;
  disabled: boolean;
  onAction: (order: Order) => void;
}) {
  const stage = stageUi[order.status];
  const orderNumber =
    order.senha === null
      ? order.id.slice(0, 6).toUpperCase()
      : order.senha.toString().padStart(3, "0");

  return (
    <View
      className={`mb-3 overflow-hidden rounded-xl border bg-white ${isNew ? "border-[#2563EB]" : "border-[#D6D3D1]"}`}
      style={isNew ? { borderWidth: 2 } : undefined}
    >
      <View
        className="flex-row items-center justify-between px-4 py-3"
        style={{ backgroundColor: stage.background }}
      >
        <View className="flex-row items-center gap-3">
          <Text
            className="text-3xl font-black"
            style={{ color: stage.foreground }}
          >
            #{orderNumber}
          </Text>
          {isNew && (
            <Text
              className="rounded bg-white px-2 py-1 text-xs font-black"
              style={{ color: stage.background }}
            >
              NOVO
            </Text>
          )}
        </View>
        <View className="items-end">
          <Text
            className="text-base font-black"
            style={{ color: stage.foreground }}
          >
            {stage.label}
          </Text>
          <Text
            className="text-sm font-semibold"
            style={{ color: stage.foreground }}
          >
            há {elapsed(order.createdAt, now)}
          </Text>
        </View>
      </View>

      <View className="px-4 pb-4 pt-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-[#57534E]">
            {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {order.dataOperacional && (
            <Text className="text-xs text-[#78716C]">
              Dia {order.dataOperacional.split("-").reverse().join("/")}
            </Text>
          )}
        </View>

        {order.demo && (
          <Text className="mb-3 self-start rounded bg-[#FEF3C7] px-2 py-1 text-sm font-black text-[#92400E]">
            DEMO · {order.demoAmbiente ?? "Demonstração"}
          </Text>
        )}

        {order.itens.map((item, index) => (
          <View
            key={index}
            className="mb-3 border-b border-[#E7E5E4] pb-3 last:border-b-0"
          >
            <Text className="text-xl font-black leading-7 text-[#1C1917]">
              {item.quantidade}× {item.nomeProduto}
            </Text>
            {item.variacaoNome && (
              <Text className="mt-1 text-base font-semibold text-[#44403C]">
                {item.variacaoNome}
              </Text>
            )}
            {item.adicionais.map((additional, additionalIndex) => (
              <Text
                key={additionalIndex}
                className="mt-1 text-base text-[#44403C]"
              >
                + {additional.quantidade}× {additional.nomeAdicional}
              </Text>
            ))}
            {item.escolhas.map((choice, choiceIndex) => (
              <Text
                key={choiceIndex}
                className="mt-1 text-base text-[#44403C]"
              >
                • {choice.nomeItem}
              </Text>
            ))}
            {item.observacao && (
              <View className="mt-2 rounded-lg border-l-4 border-[#EA580C] bg-[#FFF7ED] p-3">
                <Text className="text-base font-bold leading-6 text-[#7C2D12]">
                  Obs.: {item.observacao}
                </Text>
              </View>
            )}
          </View>
        ))}

        {order.preparoZero && (
          <Text className="mb-3 text-sm font-semibold text-[#57534E]">
            Sem preparo na cozinha
          </Text>
        )}
        {!!rejection && !pending && (
          <Text
            accessibilityLiveRegion="polite"
            className="mb-3 rounded-lg bg-[#FEF2F2] p-3 text-base font-semibold text-[#991B1B]"
          >
            Operação rejeitada. {rejection}
          </Text>
        )}
        {pending && (
          <Text
            accessibilityLiveRegion="polite"
            className="mb-3 rounded-lg bg-[#FFF7ED] p-3 text-base font-semibold text-[#9A3412]"
          >
            {pending.nextAttempt > now
              ? "Resultado incerto. Recuperação agendada."
              : pending.attempts > 0
                ? "Recuperando operação com a chave original…"
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
          android_ripple={{ color: "#FFFFFF33" }}
          disabled={disabled || !!pending}
          onPress={() => onAction(order)}
          className="items-center justify-center rounded-lg px-4"
          style={[
            { minHeight: 56 },
            {
              backgroundColor:
                disabled || pending ? "#A8A29E" : stage.action,
            },
          ]}
        >
          <Text className="text-center text-lg font-black text-white">
            {order.senha === null
              ? "Solicitar senha"
              : actionLabel[order.status]}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
