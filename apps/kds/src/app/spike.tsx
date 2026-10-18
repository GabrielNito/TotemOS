import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";

import { createNativeKdsLanServer } from "../lan-spike/native-server";
import { isLanSpikeRuntimeEnabled } from "../lan-spike/runtime";

const isLanSpikeEnabled = isLanSpikeRuntimeEnabled(
  Constants.expoConfig?.extra,
  __DEV__,
);

/** Rota manual do spike. Não faz parte da navegação produtiva do KDS. */
export default function LanSpikeScreen() {
  const [status, setStatus] = useState("iniciando");
  const [port, setPort] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isLanSpikeEnabled) {
        return undefined;
      }

      let disposed = false;
      const server = createNativeKdsLanServer("tenant-a");
      void server
        .start()
        .then(result => {
          if (disposed) {
            return;
          }
          setPort(result.port);
          setStatus("publicado");
        })
        .catch(startError => {
          if (disposed) {
            return;
          }
          setError(startError instanceof Error ? startError.message : String(startError));
          setStatus("erro");
        });

      return () => {
        disposed = true;
        void server.stop().catch(() => undefined);
      };
    }, []),
  );

  if (!isLanSpikeEnabled) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-base text-foreground">
          O diagnóstico LAN está desabilitado neste build.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">
        Spike de rede local do KDS
      </Text>
      <Text className="mt-2 text-base text-muted">
        Servidor HTTP/WebSocket e anúncio mDNS experimentais.
      </Text>
      <Text className="mt-8 text-base text-foreground">Estado: {status}</Text>
      <Text className="mt-2 text-base text-foreground">
        Porta: {port ?? "aguardando"}
      </Text>
      <Text className="mt-2 text-sm text-muted">
        Health: GET /_spike/health. WebSocket: /_spike/ws.
      </Text>
      {error ? (
        <Text className="mt-4 text-sm text-red-600">Erro: {error}</Text>
      ) : null}
    </View>
  );
}
