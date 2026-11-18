import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { STAGE_UI, waitColor } from "./ui-config";
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
  const stage = STAGE_UI[order.status];

  return (
    <View
      className={`mb-3 rounded-3xl border bg-card p-4 ${isNew ? "border-2 border-primary" : "border-border"}`}
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-2xl font-bold tracking-tight text-foreground">
          {order.senha === null
            ? `#${order.id.slice(0, 6)}`
            : `${order.senha.toString().padStart(3, "0")}`}
        </Text>
        <View className="flex-row flex-wrap items-center gap-1.5">
          <View
            style={{
              backgroundColor: stage.badgeBg,
              borderColor: stage.badgeBorder,
            }}
            className="rounded-full border px-2.5 py-0.5"
          >
            <Text
              style={{ color: stage.color }}
              className="text-xs font-semibold"
            >
              {stage.badgeLabel}
            </Text>
          </View>
          {isNew ? (
            <View className="rounded-full bg-primary px-2.5 py-0.5">
              <Text className="text-xs font-bold text-white">NOVO</Text>
            </View>
          ) : null}
        </View>
      </View>

      {order.dataOperacional ? (
        <Text className="mt-1 text-xs text-muted">
          Dia {order.dataOperacional.split("-").reverse().join("/")}
        </Text>
      ) : null}

      <Text
        style={{
          color: waitColor(
            Math.max(0, (now - Date.parse(order.createdAt)) / 60000),
          ),
        }}
        className="mb-3 mt-1 text-xs font-semibold"
      >
        {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · há {elapsed(order.createdAt, now)}
      </Text>

      {order.demo ? (
        <View className="mb-3 self-start rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5">
          <Text className="text-xs font-semibold text-[#B45309]">
            DEMO · {order.demoAmbiente ?? "Demonstração"}
          </Text>
        </View>
      ) : null}

      {order.itens.map((item, index) => (
        <View
          key={index}
          className="mb-3 rounded-2xl border border-border bg-surface/60 p-3"
        >
          <Text className="text-base font-bold text-foreground">
            {item.quantidade}× {item.nomeProduto}
          </Text>
          {item.variacaoNome ? (
            <Text className="mt-0.5 text-sm font-medium text-foreground">
              {item.variacaoNome}
            </Text>
          ) : null}
          {item.adicionais.map((a, i) => (
            <Text key={i} className="mt-0.5 text-xs text-muted">
              + {a.quantidade}× {a.nomeAdicional}
            </Text>
          ))}
          {item.escolhas.map((e, i) => (
            <Text key={i} className="mt-0.5 text-xs text-muted">
              • {e.nomeItem}
            </Text>
          ))}
          {item.observacao ? (
            <View className="mt-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-2.5">
              <Text className="text-xs font-semibold text-[#92400E]">
                Obs.: {item.observacao}
              </Text>
            </View>
          ) : null}
        </View>
      ))}

      {order.preparoZero ? (
        <View className="mb-3 self-start rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5">
          <Text className="text-xs font-semibold text-[#047857]">
            Sem preparo na cozinha
          </Text>
        </View>
      ) : null}

      {rejection && !pending ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mb-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs font-medium text-destructive"
        >
          Operação rejeitada. {rejection}
        </Text>
      ) : null}

      {pending ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mb-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-2.5 text-xs font-medium text-[#B45309]"
        >
          {pending.nextAttempt > now
            ? "Resultado incerto. Recuperação agendada."
            : pending.attempts > 0
              ? "Recuperando operação com a chave original…"
              : pending.kind === "senha"
                ? "Atribuindo senha…"
                : "Confirmando operação…"}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${order.senha === null ? "Solicitar senha" : actionLabel[order.status]} do pedido ${order.senha ?? order.id.slice(0, 6)}`}
        accessibilityState={{
          disabled: disabled || !!pending,
          busy: !!pending,
        }}
        disabled={disabled || !!pending}
        onPress={() => onAction(order)}
        className={`min-h-14 items-center justify-center rounded-2xl px-4 py-3.5 ${disabled || pending ? "bg-surface" : "bg-primary"}`}
      >
        <Text
          className={`text-center text-sm font-bold ${disabled || pending ? "text-muted" : "text-white"}`}
        >
          {order.senha === null ? "Solicitar senha" : actionLabel[order.status]}
        </Text>
      </Pressable>
    </View>
  );
});
