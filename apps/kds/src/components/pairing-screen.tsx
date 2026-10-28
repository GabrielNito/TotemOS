import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  pairDevice,
  restoreDeviceSession,
  type PairDeviceResult,
  type RestoreDeviceSessionResult,
} from "../device-pairing/session";
import type { DeviceType } from "../device-pairing/types";

type PairingDestination = "/catalogo" | "/pedidos";

interface PairingScreenProps {
  destination: PairingDestination;
  expectedDeviceType: DeviceType;
  title: string;
}

type PairingUiState =
  | { status: "checking" }
  | { status: "error"; message: string }
  | { status: "expired-or-used"; message: string }
  | { status: "loading" }
  | { status: "waiting" };

function stateFromRestoreResult(
  result: RestoreDeviceSessionResult,
): PairingUiState {
  if (result.kind === "authenticated") return { status: "checking" };
  if (result.kind === "error") {
    return { message: result.message, status: "error" };
  }
  return { status: "waiting" };
}

function stateFromPairResult(result: PairDeviceResult): PairingUiState {
  if (result.kind === "authenticated") return { status: "checking" };
  if (result.kind === "expired-or-used") {
    return { message: result.message, status: "expired-or-used" };
  }
  return { message: result.message, status: "error" };
}

export function PairingScreen({
  destination,
  expectedDeviceType,
  title,
}: PairingScreenProps) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [state, setState] = useState<PairingUiState>({ status: "checking" });

  const redirectToDestination = useCallback(() => {
    router.replace(destination);
  }, [destination, router]);

  useEffect(() => {
    let cancelled = false;

    void restoreDeviceSession({ expectedDeviceType }).then((result) => {
      if (cancelled) return;
      if (result.kind === "authenticated") {
        redirectToDestination();
        return;
      }
      setState(stateFromRestoreResult(result));
    });

    return () => {
      cancelled = true;
    };
  }, [expectedDeviceType, redirectToDestination]);

  const handlePair = async () => {
    if (state.status === "loading") return;

    setState({ status: "loading" });
    const result = await pairDevice(codigo, { expectedDeviceType });
    if (result.kind === "authenticated") {
      redirectToDestination();
      return;
    }
    setState(stateFromPairResult(result));
  };

  if (state.status === "checking") {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator color="#208AEF" />
        <Text className="mt-4 text-base text-muted">Verificando sessão...</Text>
      </View>
    );
  }

  const isLoading = state.status === "loading";
  const hasMessage = state.status === "error" || state.status === "expired-or-used";

  return (
    <View className="flex-1 justify-center bg-background px-6">
      <Text className="text-3xl font-semibold text-foreground">{title}</Text>
      <Text className="mt-2 text-base leading-6 text-muted">
        Digite o código de 6 dígitos gerado pelo Dashboard para ativar este
        dispositivo.
      </Text>

      {hasMessage && (
        <View className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <Text className="text-sm leading-5 text-destructive">
            {state.message}
          </Text>
        </View>
      )}

      <Text className="mt-8 text-sm font-medium text-foreground">
        Código de pareamento
      </Text>
      <TextInput
        accessibilityLabel="Código de pareamento"
        autoCapitalize="none"
        autoCorrect={false}
        className="mt-2 rounded-xl border border-border bg-card px-4 py-4 text-center text-2xl tracking-[8px] text-foreground"
        editable={!isLoading}
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(value) => {
          setCodigo(value.replace(/\D/g, "").slice(0, 6));
          if (state.status !== "waiting") setState({ status: "waiting" });
        }}
        onSubmitEditing={() => void handlePair()}
        placeholder="000000"
        placeholderTextColor="#7A8699"
        returnKeyType="done"
        value={codigo}
      />

      <Pressable
        accessibilityRole="button"
        className="mt-6 items-center rounded-xl bg-primary px-5 py-4"
        disabled={isLoading}
        onPress={() => void handlePair()}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-base font-semibold text-white">
            Ativar dispositivo
          </Text>
        )}
      </Pressable>

      <Text className="mt-4 text-center text-sm text-muted">
        O token será armazenado somente no armazenamento seguro deste aparelho.
      </Text>
    </View>
  );
}
