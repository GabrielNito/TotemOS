import * as SecureStore from "expo-secure-store";
import { restoreDeviceSession } from "../device-pairing/session";
import { getApiBaseUrl } from "./api";
import {
  CloudUnavailableError,
  OrderSubmission,
  OrderRejectedError,
} from "./order-submission";
import { clearBusinessCart } from "./cart-storage";
import { getOrderTracking, TrackingError } from "./order-tracking-api";
import { sendOrderToOfflineKds } from "../offline-lan/native";

// This is an idempotency identifier, never an authentication credential.
function requestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}

export function createOrderSubmission(
  negocioId: string,
  dispositivoId?: string,
) {
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
        (dispositivoId !== undefined &&
          session.dispositivo.id !== dispositivoId) ||
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
          // A 404 can come from outside the order service. Keep the attempt recoverable.
          if (response.status === 400)
            throw new OrderRejectedError(
              "O catálogo mudou ou algum item está indisponível. Revise o pedido e tente novamente.",
            );
          if (response.status >= 500 || response.status === 429)
            throw new CloudUnavailableError();
          throw new OrderRejectedError(
            "O pedido foi recusado pelo servidor. Solicite assistência.",
          );
        }
        const result = await response.json();
        if (!result || result.dispositivoId !== session.dispositivo.id)
          throw new Error(
            "Não foi possível validar o vínculo do pedido. Solicite assistência.",
          );
        return result;
      } catch (error) {
        if (
          error instanceof TrackingError ||
          error instanceof OrderRejectedError ||
          error instanceof CloudUnavailableError
        )
          throw error;
        throw new CloudUnavailableError();
      } finally {
        clearTimeout(timeout);
      }
    },
    requestId,
    () => clearBusinessCart(negocioId),
    dispositivoId,
    (id) => getOrderTracking(negocioId, id, undefined, dispositivoId),
    async (request, idempotencyKey, valorEstimado) => {
      const session = await restoreDeviceSession({
        expectedDeviceType: "TOTEM",
      });
      const credential =
        session.kind === "authenticated"
          ? session.negocio?.lanCredential
          : undefined;
      if (
        session.kind !== "authenticated" ||
        !credential ||
        !dispositivoId ||
        session.dispositivo.id !== dispositivoId ||
        session.dispositivo.negocioId !== negocioId
      )
        throw new Error("Conexão offline indisponível neste dispositivo.");
      await sendOrderToOfflineKds({
        negocioId,
        dispositivoId,
        credential,
        idempotencyKey,
        pedido: request,
        valorEstimado,
      });
    },
  );
}
