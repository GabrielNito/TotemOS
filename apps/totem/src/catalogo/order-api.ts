import * as SecureStore from "expo-secure-store";
import { restoreDeviceSession } from "../device-pairing/session";
import { getApiBaseUrl } from "./api";
import { OrderSubmission, OrderRejectedError } from "./order-submission";
import { clearBusinessCart } from "./cart-storage";
import { TrackingError } from "./order-tracking-api";

// This is an idempotency identifier, never an authentication credential.
function requestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}

export function createOrderSubmission(negocioId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(negocioId)) throw new Error("Negócio inválido.");
  const key = `totemos.order-attempt.${negocioId}`;
  return new OrderSubmission(
    negocioId,
    {
      get: () => SecureStore.getItemAsync(key),
      set: (value) => SecureStore.setItemAsync(key, value),
    },
    async (request, idempotencyKey) => {
      const session = await restoreDeviceSession({
        expectedDeviceType: "TOTEM",
      });
      if (session.kind === "pairing") throw new TrackingError("http", 401);
      if (
        session.kind !== "authenticated" ||
        session.dispositivo.negocioId !== negocioId ||
        session.dispositivo.tipo !== "TOTEM"
      )
        throw new Error(
          "Não foi possível validar a sessão. Verifique o pareamento e tente novamente.",
        );
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${getApiBaseUrl()}/pedidos`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.deviceToken}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          if (response.status === 401) throw new TrackingError("http", 401);
          // Only validation/not-found guarantee that this attempt did not create an order.
          if ([400, 404].includes(response.status))
            throw new OrderRejectedError(
              "O catálogo mudou ou algum item está indisponível. Revise o pedido e tente novamente.",
            );
          throw new Error(
            "Não foi possível confirmar o envio. Consulte novamente para evitar duplicar o pedido.",
          );
        }
        const result = await response.json();
        if (!result || result.dispositivoId !== session.dispositivo.id)
          throw new Error(
            "Não foi possível validar o vínculo do pedido. Solicite assistência.",
          );
        return result;
      } finally {
        clearTimeout(timeout);
      }
    },
    requestId,
    () => clearBusinessCart(negocioId),
  );
}
