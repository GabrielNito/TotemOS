import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OfflineEnvelope, OfflineInboxStorage } from "./types";
import { validateOfflineEnvelope } from "./controller";

export function offlineInboxStorage(
  negocioId: string,
  painelId: string,
): OfflineInboxStorage {
  const key = `totemos.kds.offline-inbox.v1.${negocioId}.${painelId}`;
  return {
    async load() {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Caixa offline inválida.");
      parsed.forEach(item => {
        validateOfflineEnvelope(item);
        if (item.negocioId !== negocioId)
          throw new Error("Caixa offline pertence a outro tenant.");
      });
      return parsed as OfflineEnvelope[];
    },
    save(envelopes) {
      return AsyncStorage.setItem(key, JSON.stringify(envelopes));
    },
  };
}
