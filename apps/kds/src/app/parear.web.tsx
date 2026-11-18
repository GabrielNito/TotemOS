import AndroidOnlyScreen from "../components/android-only-screen";
import { PairingScreen } from "../components/pairing-screen";

export default function ParearWebScreen() {
  return process.env.EXPO_PUBLIC_KDS_PREVIEW === "1" ? (
    <PairingScreen
      destination="/pedidos"
      expectedDeviceType="PAINEL"
      title="Parear KDS"
    />
  ) : (
    <AndroidOnlyScreen />
  );
}
