import type { OrderRequest } from "../catalogo/order-submission";

export type OfflineLanSocket = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(data: string): unknown;
  close(code?: number, reason?: string): unknown;
};

type Options = {
  negocioId: string;
  dispositivoId: string;
  credential: string;
  idempotencyKey: string;
  pedido: OrderRequest;
  valorEstimado: number;
  discover(): Promise<string>;
  socket(url: string): OfflineLanSocket;
  proof(context: string, credential: string): Promise<string>;
  now(): number;
  timeoutMs?: number;
};

export async function deliverOfflineOrder(options: Options): Promise<void> {
  const endpoint = await options.discover();
  return new Promise<void>((resolve, reject) => {
    const socket = options.socket(endpoint);
    const payload = JSON.stringify({
      negocioId: options.negocioId,
      dispositivoId: options.dispositivoId,
      idempotencyKey: options.idempotencyKey,
      recebidoEm: options.now(),
      valorEstimado: options.valorEstimado,
      pedido: options.pedido,
    });
    let nonce = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close(error ? 1011 : 1000, error ? "delivery failed" : "ack");
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(
      () => finish(new Error("Tempo esgotado ao entregar pedido ao KDS.")),
      options.timeoutMs ?? 8000,
    );
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "handshake",
          protocolVersion: 2,
          negocioId: options.negocioId,
          dispositivoId: options.dispositivoId,
        }),
      );
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        finish(new Error("Resposta binária inesperada do KDS."));
        return;
      }
      const data = event.data;
      void (async () => {
        const message = JSON.parse(data) as Record<string, unknown>;
        if (message.type === "challenge" && typeof message.nonce === "string") {
          nonce = message.nonce;
          socket.send(
            JSON.stringify({
              type: "authenticate",
              proof: await options.proof(
                `${nonce}.auth.${options.dispositivoId}`,
                options.credential,
              ),
            }),
          );
          return;
        }
        if (message.type === "authenticated" && nonce) {
          socket.send(
            JSON.stringify({
              type: "order",
              payload,
              proof: await options.proof(
                `${nonce}.order.${payload}`,
                options.credential,
              ),
            }),
          );
          return;
        }
        if (
          message.type === "order_ack" &&
          message.idempotencyKey === options.idempotencyKey
        ) {
          finish();
          return;
        }
        finish(new Error("Resposta incompatível do KDS."));
      })().catch((error) =>
        finish(error instanceof Error ? error : new Error(String(error))),
      );
    };
    socket.onerror = () => finish(new Error("Falha na conexão LAN com o KDS."));
    socket.onclose = () => {
      if (!settled)
        finish(new Error("Conexão LAN encerrada antes da confirmação."));
    };
  });
}
