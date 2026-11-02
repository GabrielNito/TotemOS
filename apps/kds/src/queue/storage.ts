import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueueJournalError } from "./types";
import type { OperationStorage, PendingOperation } from "./types";
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function isOperation(value: unknown): value is PendingOperation {
  if (typeof value !== "object" || value === null) return false;
  const op = value as Record<string, unknown>;
  return (
    Object.keys(op).every((key) =>
      [
        "key",
        "orderId",
        "kind",
        "target",
        "version",
        "attempts",
        "nextAttempt",
        "halted",
      ].includes(key),
    ) &&
    uuid(op.key) &&
    uuid(op.orderId) &&
    ["senha", "status"].includes(String(op.kind)) &&
    Number.isSafeInteger(op.attempts) &&
    Number(op.attempts) >= 0 &&
    typeof op.nextAttempt === "number" &&
    Number.isFinite(op.nextAttempt) &&
    op.nextAttempt >= 0 &&
    (op.halted === undefined || typeof op.halted === "boolean") &&
    (op.version === undefined ||
      (Number.isSafeInteger(op.version) && Number(op.version) > 0)) &&
    (op.kind === "senha"
      ? op.target === undefined
      : ["EM_PREPARO", "PRONTO", "ENTREGUE"].includes(String(op.target)) &&
        Number.isSafeInteger(op.version) &&
        Number(op.version) > 0)
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
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new QueueJournalError();
      }
      if (
        !Array.isArray(value) ||
        !value.every(isOperation) ||
        new Set(value.map((op) => op.key.toLowerCase())).size !== value.length
      )
        throw new QueueJournalError();
      return value;
    },
    async save(ops) {
      await AsyncStorage.setItem(key, JSON.stringify(ops));
    },
  };
}
