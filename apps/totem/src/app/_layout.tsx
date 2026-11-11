import { Stack } from "expo-router";
import { Platform } from "react-native";
import { AndroidKioskGuard } from "../android-kiosk/guard";

import "../global.css";

export default function RootLayout() {
  const real = process.env.EXPO_PUBLIC_KIOSK_PREVIEW !== "1";
  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        ...(real && { gestureEnabled: false }),
      }}
    />
  );
  return real && Platform.OS === "android" ? (
    <AndroidKioskGuard>{stack}</AndroidKioskGuard>
  ) : (
    stack
  );
}
