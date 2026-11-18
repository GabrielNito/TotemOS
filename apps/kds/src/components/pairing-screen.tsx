import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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

interface PairingScreenProps {
  destination: "/pedidos";
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
  const isPreview = process.env.EXPO_PUBLIC_KDS_PREVIEW === "1";
  const [codigo, setCodigo] = useState("");
  const [state, setState] = useState<PairingUiState>({
    status: isPreview ? "waiting" : "checking",
  });

  const redirectToDestination = useCallback(() => {
    router.replace(destination);
  }, [destination, router]);

  useEffect(() => {
    if (isPreview) return;
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
  }, [expectedDeviceType, isPreview, redirectToDestination]);

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
        <View className="items-center rounded-3xl border border-border bg-card px-8 py-7">
          <ActivityIndicator color="#18181B" />
          <Text className="mt-3 text-sm text-muted">Verificando sessão...</Text>
        </View>
      </View>
    );
  }

  const isLoading = state.status === "loading";
  const hasMessage =
    state.status === "error" || state.status === "expired-or-used";

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 24,
      }}
    >
      <View className="w-full max-w-md rounded-3xl border border-border bg-card p-7">
        <Text className="text-center text-xs font-semibold tracking-wider text-muted">
          TOTEMOS · KDS
        </Text>
        <Text className="mt-1.5 text-center text-2xl font-bold tracking-tight text-foreground">
          {title}
        </Text>
        <Text className="mt-1.5 text-center text-xs leading-5 text-muted">
          Digite o código de 6 dígitos gerado pelo Dashboard para ativar este
          dispositivo.
        </Text>

        {hasMessage ? (
          <View className="mt-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-3.5">
            <Text className="text-center text-xs leading-5 text-destructive">
              {state.message}
            </Text>
          </View>
        ) : null}

        <Text className="mt-5 text-xs font-semibold text-foreground">
          Código de pareamento
        </Text>
        <TextInput
          accessibilityLabel="Código de pareamento"
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-2 rounded-2xl border border-border bg-surface px-4 py-3.5 text-center text-2xl font-bold tracking-[8px] text-foreground"
          editable={!isLoading}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => {
            setCodigo(value.replace(/\D/g, "").slice(0, 6));
            if (state.status !== "waiting") setState({ status: "waiting" });
          }}
          onSubmitEditing={() => void handlePair()}
          placeholder="000000"
          placeholderTextColor="#A1A1AA"
          returnKeyType="done"
          value={codigo}
        />

        <Pressable
          accessibilityRole="button"
          className="mt-5 min-h-12 items-center justify-center rounded-2xl bg-primary px-5 py-3.5"
          disabled={isLoading}
          onPress={() => void handlePair()}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-xs font-semibold text-white">
              Ativar dispositivo
            </Text>
          )}
        </Pressable>

        <Text className="mt-4 text-center text-xs text-muted">
          O token será armazenado somente no armazenamento seguro deste
          aparelho.
        </Text>
      </View>
    </ScrollView>
  );
}
