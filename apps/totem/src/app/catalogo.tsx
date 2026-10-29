import { CatalogoScreen } from "../catalogo/catalogo-screen";
import { KioskPreviewScreen } from "../kiosk/kiosk-screen";

export default process.env.EXPO_PUBLIC_KIOSK_PREVIEW === "1"
  ? KioskPreviewScreen
  : CatalogoScreen;
