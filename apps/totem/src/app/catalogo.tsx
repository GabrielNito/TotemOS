import { Text, View } from "react-native";

export default function CatalogoScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">Catálogo</Text>
      <Text className="mt-2 text-center text-base text-muted">
        O fluxo de catálogo será implementado em outro card.
      </Text>
    </View>
  );
}
