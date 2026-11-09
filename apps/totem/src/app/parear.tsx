import { Redirect } from "expo-router";
import { AndroidKioskMode } from "../android-kiosk/guard";
import { PairingScreen } from "../components/pairing-screen";

export default function ParearScreen() {
  if (process.env.EXPO_PUBLIC_KIOSK_PREVIEW === "1")
    return <Redirect href="/catalogo" />;
  return (
    <PairingScreen
      destination="/catalogo"
      expectedDeviceType="TOTEM"
      title="Ative seu totem"
      kioskMode={<AndroidKioskMode setup />}
    />
  );
}
