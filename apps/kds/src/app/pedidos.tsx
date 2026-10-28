import { Text, View } from "react-native";

export default function PedidosScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">Fila de pedidos</Text>
      <Text className="mt-2 text-center text-base text-muted">
        O fluxo da fila será implementado em outro card.
      </Text>
    </View>
  );
}
