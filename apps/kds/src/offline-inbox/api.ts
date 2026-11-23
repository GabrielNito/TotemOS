import { request } from "../device-pairing/api";
import type { OfflineReconciliationApi } from "./types";

export function createOfflineReconciliationApi(
  deviceToken: string,
): OfflineReconciliationApi {
  return {
    async reconcile(lote) {
      return request("/pedidos/reconciliar", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${deviceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lote),
      });
    },
  };
}
