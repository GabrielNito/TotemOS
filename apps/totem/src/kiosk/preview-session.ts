import * as SecureStore from "expo-secure-store";
import { validCart, type Line, type Mode } from "./reference-model";

type PreviewSession = { cart: Line[]; mode: Mode };
const key = "totemos.kiosk-preview.v2";
let pendingWrite = Promise.resolve();

/** This key belongs only to the fictitious V2 catalog, never the paired business. */
export async function loadPreviewSession(): Promise<PreviewSession> {
  await pendingWrite;
  try {
    const stored = JSON.parse((await SecureStore.getItemAsync(key)) ?? "{}");
    return {
      cart: validCart(stored?.cart) ? stored.cart : [],
      mode: ["counter", "table", "qr"].includes(stored?.mode)
        ? stored.mode
        : "counter",
    };
  } catch {
    return { cart: [], mode: "counter" };
  }
}

export function savePreviewSession({
  cart,
  mode,
}: PreviewSession): Promise<void> {
  const snapshot = JSON.stringify({ cart, mode });
  pendingWrite = pendingWrite
    .then(() => SecureStore.setItemAsync(key, snapshot))
    .catch(() => {
      // Match the preview's usable in-memory flow when persistence is unavailable.
    });
  return pendingWrite;
}
