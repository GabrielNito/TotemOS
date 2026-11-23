import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const { width } = useWindowDimensions();
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
    if (state.status === "loading" || codigo.length !== 6) return;

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
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F5F5F4] px-6">
        <View className="h-14 w-14 items-center justify-center rounded-xl bg-[#18181B]">
          <Text className="text-2xl font-black text-white">T</Text>
        </View>
        <ActivityIndicator className="mt-5" color="#18181B" />
        <Text className="mt-3 text-base font-semibold text-[#57534E]">
          Verificando este painel…
        </Text>
      </SafeAreaView>
    );
  }

  const isLoading = state.status === "loading";
  const hasMessage = state.status === "error" || state.status === "expired-or-used";
  const canSubmit = codigo.length === 6 && !isLoading;
  const isWide = width >= 700;

  return (
    <SafeAreaView
      className="flex-1 bg-[#F5F5F4]"
      edges={["top", "bottom", "left", "right"]}
    >
      <View className="h-16 flex-row items-center justify-between border-b border-[#D6D3D1] bg-white px-5">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-[#18181B]">
            <Text className="text-lg font-black text-white">T</Text>
          </View>
          <Text className="text-sm font-black tracking-wider text-[#292524]">
            TOTEMOS / {title.toUpperCase()}
          </Text>
        </View>
        <Text className="rounded-full bg-[#E7E5E4] px-3 py-1.5 text-xs font-black text-[#44403C]">
          Configuração inicial
        </Text>
      </View>

      <View
        className="flex-1 items-center justify-center gap-6 p-5"
        style={{ flexDirection: isWide ? "row" : "column" }}
      >
        <View className="max-w-xl flex-1">
          <Text className="text-sm font-black tracking-widest text-[#2563EB]">
            PAINEL DE COZINHA
          </Text>
          <Text className="mt-2 text-4xl font-black leading-[44px] text-[#1C1917]">
            Conectar este painel
          </Text>
          <Text className="mt-3 max-w-lg text-base font-medium leading-6 text-[#57534E]">
            No Dashboard, abra Dispositivos, crie um código para um Painel KDS e
            digite os seis números ao lado.
          </Text>
          <View className="mt-5 flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-[#18181B]">
              <Text className="font-black text-white">1</Text>
            </View>
            <Text className="font-bold text-[#44403C]">Gerar no Dashboard</Text>
            <View className="h-px w-6 bg-[#A8A29E]" />
            <View className="h-8 w-8 items-center justify-center rounded-full bg-[#2563EB]">
              <Text className="font-black text-white">2</Text>
            </View>
            <Text className="font-bold text-[#44403C]">Ativar aqui</Text>
          </View>
        </View>

        <View className="w-full max-w-md rounded-xl border border-[#D6D3D1] bg-white p-5">
          <Text className="text-xl font-black text-[#1C1917]">
            Código de pareamento
          </Text>
          <Text className="mt-1 text-sm leading-5 text-[#78716C]">
            O código tem seis números e expira após o uso.
          </Text>

          {hasMessage && (
            <View className="mt-3 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3">
              <Text
                accessibilityRole="alert"
                className="text-sm font-semibold leading-5 text-[#991B1B]"
              >
                {state.message}
              </Text>
            </View>
          )}

          <TextInput
            accessibilityLabel="Código de pareamento"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-4 rounded-lg border-2 border-[#A8A29E] bg-[#FAFAF9] px-4 text-center text-3xl font-black tracking-[10px] text-[#1C1917]"
            editable={!isLoading}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => {
              setCodigo(value.replace(/\D/g, "").slice(0, 6));
              if (state.status !== "waiting") setState({ status: "waiting" });
            }}
            onSubmitEditing={() => void handlePair()}
            placeholder="000000"
            placeholderTextColor="#A8A29E"
            returnKeyType="done"
            selectTextOnFocus
            style={{ height: 64, fontVariant: ["tabular-nums"] }}
            value={codigo}
          />

          <Pressable
            accessibilityLabel="Ativar painel"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy: isLoading }}
            android_ripple={{ color: "#FFFFFF33" }}
            className="mt-3 items-center justify-center rounded-lg px-5"
            disabled={!canSubmit}
            onPress={() => void handlePair()}
            style={[
              { minHeight: 56 },
              {
                backgroundColor: canSubmit ? "#18181B" : "#A8A29E",
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-lg font-black text-white">Ativar painel</Text>
            )}
          </Pressable>

          <Text className="mt-3 text-center text-xs leading-4 text-[#78716C]">
            A credencial fica protegida no armazenamento seguro deste aparelho.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
