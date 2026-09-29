import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function CatalogoScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">Catálogo</Text>
      <Link href="/parear" asChild>
        <Pressable className="mt-8 rounded-xl border border-muted px-5 py-3">
          <Text className="text-base font-semibold text-foreground">Voltar</Text>
        </Pressable>
      </Link>
    </View>
  );
}
