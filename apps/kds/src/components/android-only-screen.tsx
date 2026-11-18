import { Text, View } from "react-native";

export default function AndroidOnlyScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-md rounded-3xl border border-border bg-card px-7 py-6">
        <Text className="text-center text-xs font-semibold tracking-wider text-muted">
          TOTEMOS · KDS
        </Text>
        <Text className="mt-2 text-center text-lg font-bold tracking-tight text-foreground">
          Abra o TotemOS KDS em um dispositivo Android.
        </Text>
      </View>
    </View>
  );
}
