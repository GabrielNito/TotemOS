import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";

import {
  createTotemLanSpikeClient,
  type TotemLanSpikeClient,
  type TotemLanSpikeSnapshot,
} from "../lan-spike/client";
import { createNativeDiscoveryBackend } from "../lan-spike/native-discovery";
import { isLanSpikeRuntimeEnabled } from "../lan-spike/runtime";

const isLanSpikeEnabled = isLanSpikeRuntimeEnabled(
  Constants.expoConfig?.extra,
  __DEV__,
);

const INITIAL_SNAPSHOT: TotemLanSpikeSnapshot = {
  state: "desconectado",
  service: null,
  health: null,
  lastError: null,
  lastEvent: null,
  retryAttempt: 0,
};

/** Rota manual do spike. Não substitui a tela produtiva de pareamento. */
export default function LanSpikeScreen() {
  const clientRef = useRef<TotemLanSpikeClient | null>(null);
  const [snapshot, setSnapshot] =
    useState<TotemLanSpikeSnapshot>(INITIAL_SNAPSHOT);

  useFocusEffect(
    useCallback(() => {
      if (!isLanSpikeEnabled) {
        return undefined;
      }

      const client = createTotemLanSpikeClient({
        negocioId: "tenant-a",
        createDiscoveryBackend: createNativeDiscoveryBackend,
      });
      clientRef.current = client;
      const unsubscribe = client.subscribe(setSnapshot);
      client.start();

      return () => {
        unsubscribe();
        client.stop();
        clientRef.current = null;
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

  const address =
    snapshot.service?.ipv4?.[0] ?? snapshot.service?.host ?? "aguardando";

  return (
    <View className="flex-1 justify-center bg-background px-6">
      <Text className="text-2xl font-semibold text-foreground">
        Spike de rede local do Totem
      </Text>
      <Text className="mt-2 text-base text-muted">
        Descoberta mDNS, health HTTP e handshake WebSocket.
      </Text>
      <Text className="mt-8 text-base text-foreground">
        Estado: {snapshot.state}
      </Text>
      <Text className="mt-2 text-base text-foreground">
        Servidor: {address}
        {snapshot.service ? `:${snapshot.service.port}` : ""}
      </Text>
      <Text className="mt-2 text-sm text-muted">
        HTTP: {snapshot.health?.status ?? "aguardando"}
      </Text>
      <Text className="mt-2 text-sm text-muted">
        Evento: {snapshot.lastEvent ?? "nenhum"}
      </Text>
      <Text className="mt-2 text-sm text-muted">
        Retry: {snapshot.retryAttempt}
      </Text>
      {snapshot.lastError ? (
        <Text className="mt-4 text-sm text-red-600">
          Erro: {snapshot.lastError}
        </Text>
      ) : null}
      <View className="mt-8 flex-row gap-3">
        <Pressable
          className="rounded-xl bg-primary px-4 py-3"
          onPress={() => clientRef.current?.start()}
        >
          <Text className="font-semibold text-white">Procurar</Text>
        </Pressable>
        <Pressable
          className="rounded-xl border border-primary px-4 py-3"
          onPress={() => clientRef.current?.sendDiagnostic()}
        >
          <Text className="font-semibold text-primary">Diagnóstico</Text>
        </Pressable>
        <Pressable
          className="rounded-xl border border-muted px-4 py-3"
          onPress={() => clientRef.current?.stop()}
        >
          <Text className="font-semibold text-foreground">Parar</Text>
        </Pressable>
      </View>
    </View>
  );
}
