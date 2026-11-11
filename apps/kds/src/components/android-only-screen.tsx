import { Text, View } from "react-native";

export default function AndroidOnlyScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-xl font-semibold text-foreground">
        Abra o TotemOS KDS em um dispositivo Android.
      </Text>
    </View>
  );
}
