import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KitchenBoard } from "../queue/kitchen-board";
import { useKitchenQueue } from "../queue/use-kitchen-queue";
export default function PedidosScreen() {
  const { session, checking, error, retry } = useKitchenQueue();
  if (session)
    return <KitchenBoard name={session.name} controller={session.controller} />;
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      {checking ? (
        <>
          <ActivityIndicator color="#73C3FF" />
          <Text className="mt-4 text-xl text-foreground">
            Verificando sessão…
          </Text>
        </>
      ) : (
        <>
          <Text
            accessibilityRole="alert"
            className="mb-6 text-center text-xl text-foreground"
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            className="min-h-16 justify-center rounded-xl bg-primary px-8"
          >
            <Text className="text-xl font-bold text-white">
              Tentar novamente
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
