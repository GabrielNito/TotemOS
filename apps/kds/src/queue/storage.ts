import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OperationStorage, PendingOperation } from "./types";
function isOperation(value: unknown): value is PendingOperation {
  if (typeof value !== "object" || value === null) return false;
  const op = value as Record<string, unknown>;
  return (
    typeof op.key === "string" &&
    typeof op.orderId === "string" &&
    ["senha", "status"].includes(String(op.kind)) &&
    Number.isInteger(op.attempts) &&
    typeof op.nextAttempt === "number" &&
    Number.isFinite(op.nextAttempt) &&
    (op.kind === "senha" ||
      (["EM_PREPARO", "PRONTO", "ENTREGUE"].includes(String(op.target)) &&
        Number.isInteger(op.version)))
  );
}
export function operationStorage(
  deviceId: string,
  negocioId: string,
): OperationStorage {
  const key = `totemos.kds.operations.v1.${negocioId}.${deviceId}`;
  return {
    async load() {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return [];
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value) || !value.every(isOperation))
        throw new Error("Diário inválido; recuperação necessária.");
      return value;
    },
    async save(ops) {
      await AsyncStorage.setItem(key, JSON.stringify(ops));
    },
  };
}
