import AndroidOnlyScreen from "../components/android-only-screen";
import { PreviewPedidos } from "../queue/preview";

export default function PedidosWebScreen() {
  return process.env.EXPO_PUBLIC_KDS_PREVIEW === "1" ? (
    <PreviewPedidos />
  ) : (
    <AndroidOnlyScreen />
  );
}
