import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KitchenBoard } from "../queue/kitchen-board";
import { PreviewPedidos } from "../queue/preview";
import { useKitchenQueue } from "../queue/use-kitchen-queue";

function LivePedidos() {
  const { session, checking, error, retry } = useKitchenQueue();
  if (session)
    return <KitchenBoard name={session.name} controller={session.controller} />;
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <View className="w-full max-w-md items-center rounded-3xl border border-border bg-card p-7">
        {checking ? (
          <>
            <ActivityIndicator color="#18181B" />
            <Text className="mt-4 text-base font-medium text-foreground">
              Verificando sessão…
            </Text>
          </>
        ) : (
          <>
            <Text
              accessibilityRole="alert"
              className="mb-5 text-center text-sm leading-6 text-foreground"
            >
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              className="min-h-12 justify-center rounded-2xl bg-primary px-6 py-3"
            >
              <Text className="text-sm font-bold text-white">
                Tentar novamente
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default function PedidosScreen() {
  if (process.env.EXPO_PUBLIC_KDS_PREVIEW === "1") {
    return <PreviewPedidos />;
  }
  return <LivePedidos />;
}
