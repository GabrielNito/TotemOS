import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function ParearScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">Parear KDS</Text>
      <Text className="mt-2 text-center text-base text-muted">
        A configuração do dispositivo será feita nesta tela.
      </Text>
      <Link href="/pedidos" asChild>
        <Pressable className="mt-8 rounded-xl bg-primary px-5 py-3">
          <Text className="text-base font-semibold text-white">Abrir fila</Text>
        </Pressable>
      </Link>
    </View>
  );
}
