import { restoreDeviceSession } from "../device-pairing/session";
import { getApiBaseUrl } from "./api";
import { parseTracking, validOrderId } from "./order-tracking";

type ErrorKind =
  "http" | "network" | "timeout" | "aborted" | "invalid" | "storage";
export class TrackingError extends Error {
  constructor(
    public kind: ErrorKind,
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(
      status === 401
        ? "Sessão inválida. Solicite assistência para refazer o pareamento; o pedido foi preservado."
        : status === 403 || status === 404
          ? "Não foi possível acessar este pedido neste terminal. Solicite assistência ao estabelecimento."
          : status === 400
            ? "Referência inválida. Solicite assistência ao estabelecimento."
            : status === 429
              ? "Limite de consultas atingido. Aguarde a próxima atualização."
              : kind === "storage"
                ? "Não foi possível salvar o acompanhamento. Solicite assistência ou tente novamente."
                : "Acompanhamento desatualizado. Verifique a conexão ou solicite assistência ao estabelecimento.",
    );
  }
}
function retryAfter(value: string | null | undefined) {
  if (!value) return undefined;
  const ms = /^\d+(\.\d+)?$/.test(value)
    ? Number(value) * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, ms) : undefined;
}
export async function getOrderTracking(
  negocioId: string,
  id: string,
  signal?: AbortSignal,
) {
  if (!validOrderId(id)) throw new TrackingError("http", 400);
  const session = await restoreDeviceSession({ expectedDeviceType: "TOTEM" });
  if (signal?.aborted) throw new TrackingError("aborted");
  if (session.kind === "pairing") throw new TrackingError("http", 401);
  if (session.kind !== "authenticated") throw new TrackingError("network");
  if (
    session.dispositivo.negocioId !== negocioId ||
    session.dispositivo.tipo !== "TOTEM" ||
    !session.dispositivo.ativo ||
    session.dispositivo.revogadoEm
  )
    throw new TrackingError("http", 403);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20000);
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/pedidos/${id}/acompanhamento`,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.deviceToken}`,
          "Cache-Control": "no-store",
        },
      },
    );
    if (!response.ok)
      throw new TrackingError(
        "http",
        response.status,
        retryAfter(response.headers?.get("Retry-After")),
      );
    return parseTracking(await response.json(), id);
  } catch (error) {
    if (signal?.aborted) throw new TrackingError("aborted");
    if (timedOut) throw new TrackingError("timeout");
    if (error instanceof TrackingError) throw error;
    throw new TrackingError("network");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
