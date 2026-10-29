import { PairingScreen } from "../components/pairing-screen";

export default function ParearScreen() {
  return (
    <PairingScreen
      destination="/catalogo"
      expectedDeviceType="TOTEM"
      title="Ative seu totem"
    />
  );
}
