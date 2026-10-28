import { PairingScreen } from "../components/pairing-screen";

export default function ParearScreen() {
  return (
    <PairingScreen
      destination="/pedidos"
      expectedDeviceType="PAINEL"
      title="Parear KDS"
    />
  );
}
