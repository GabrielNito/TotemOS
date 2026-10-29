import { useRouter } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowRight,
  CircleAlert,
  KeyRound,
  LockKeyhole,
  Store,
} from "lucide-react-native";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed/600SemiBold";
import { BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed/700Bold";

import {
  pairDevice,
  restoreDeviceSession,
  type PairDeviceResult,
  type RestoreDeviceSessionResult,
} from "../device-pairing/session";
import type { DeviceType } from "../device-pairing/types";
import { sanitizePairingCode } from "./pairing-code";

const colors = {
  ink: "#2D2622",
  muted: "#716861",
  line: "#E8E2DC",
  paper: "#FFFFFF",
  wash: "#F7F5F2",
  action: "#773B2E",
  actionSoft: "#FAF3F0",
  accentSoft: "#F0E5D4",
  green: "#306B43",
};

type PairingDestination = "/catalogo";

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

type TextProps = ComponentProps<typeof NativeText>;

function Text({ style, ...props }: TextProps) {
  const flatStyle = StyleSheet.flatten(style);
  const weight = Number(flatStyle?.fontWeight ?? 400);
  const family =
    flatStyle?.fontFamily === "BarlowCondensed"
      ? weight >= 700
        ? "BarlowCondensed_700Bold"
        : "BarlowCondensed_600SemiBold"
      : weight >= 700
        ? "Inter_700Bold"
        : weight >= 600
          ? "Inter_600SemiBold"
          : weight >= 500
            ? "Inter_500Medium"
            : "Inter_400Regular";

  return (
    <NativeText
      {...props}
      style={[
        style,
        { fontFamily: family, fontWeight: "normal", includeFontPadding: false },
      ]}
    />
  );
}

function BrandHeader() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>brioche</Text>
        <Text style={styles.brandSub}>HAMBURGUERIA</Text>
      </View>
      <View style={styles.headerMeta}>
        <KeyRound color={colors.action} size={15} strokeWidth={1.8} />
        <Text style={styles.headerMetaText}>Ativação do totem</Text>
      </View>
    </View>
  );
}

function BrandedLoading() {
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={styles.safeArea}
    >
      <StatusBar style="dark" />
      <BrandHeader />
      <View style={styles.loadingState}>
        <ActivityIndicator color={colors.action} size="large" />
        <Text style={styles.loadingText}>Verificando este dispositivo...</Text>
      </View>
    </SafeAreaView>
  );
}

export function PairingScreen({
  destination,
  expectedDeviceType,
  title,
}: PairingScreenProps) {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
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

  if (!fontsLoaded && !fontError) return <BrandedLoading />;
  if (state.status === "checking") return <BrandedLoading />;

  const isLoading = state.status === "loading";
  const hasMessage =
    state.status === "error" || state.status === "expired-or-used";
  const displayTitle = title === "Parear Totem" ? "Ative seu totem" : title;

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={styles.safeArea}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />

        <View style={styles.content}>
          <Text style={styles.kicker}>TOTEMOS · CONFIGURAÇÃO</Text>
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.lead}>
            Conecte este aparelho ao seu negócio usando o código gerado no
            Dashboard.
          </Text>

          <View style={styles.identityCard}>
            <View style={styles.identityIcon}>
              <Store color={colors.action} size={27} strokeWidth={1.6} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.identityKicker}>
                TOTEM DE AUTOATENDIMENTO
              </Text>
              <Text style={styles.identityTitle}>Pronto para começar</Text>
              <Text style={styles.identityText}>
                Ative uma vez e deixe a sessão salva neste aparelho.
              </Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Código de ativação</Text>
            <Text style={styles.fieldHint}>
              Digite os 6 dígitos exibidos no Dashboard.
            </Text>
            <TextInput
              accessibilityLabel="Código de ativação"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => {
                setCodigo(sanitizePairingCode(value));
                if (state.status !== "waiting") setState({ status: "waiting" });
              }}
              onSubmitEditing={() => void handlePair()}
              placeholder="000000"
              placeholderTextColor="#B8ADA5"
              returnKeyType="done"
              selectionColor={colors.action}
              style={[
                styles.codeInput,
                codigo.length === 6 && styles.codeInputReady,
              ]}
              value={codigo}
            />
            <Text style={styles.codeCounter}>{codigo.length}/6 dígitos</Text>

            {hasMessage ? (
              <View style={styles.messageCard}>
                <CircleAlert
                  color={colors.action}
                  size={19}
                  strokeWidth={1.8}
                />
                <Text style={styles.messageText}>{state.message}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isLoading }}
              disabled={isLoading}
              onPress={() => void handlePair()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !isLoading && styles.primaryButtonPressed,
                isLoading && styles.primaryButtonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.paper} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    Ativar dispositivo
                  </Text>
                  <ArrowRight
                    color={colors.paper}
                    size={18}
                    strokeWidth={1.8}
                  />
                </>
              )}
            </Pressable>

            <View style={styles.securityNote}>
              <LockKeyhole color={colors.green} size={17} strokeWidth={1.7} />
              <Text style={styles.securityText}>
                O token fica armazenado somente no armazenamento seguro deste
                aparelho.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Brioche · TotemOS</Text>
            <Text style={styles.footerText}>Ativação segura</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.wash,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 19,
  },
  brand: {
    color: colors.action,
    fontFamily: "BarlowCondensed",
    fontSize: 37,
    fontWeight: "700",
    letterSpacing: -1.3,
    lineHeight: 34,
  },
  brandSub: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "500",
    letterSpacing: 1.26,
    marginTop: 8,
  },
  headerMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  headerMetaText: {
    color: colors.muted,
    fontSize: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  kicker: {
    color: colors.action,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    marginBottom: 11,
  },
  title: {
    color: colors.ink,
    fontFamily: "BarlowCondensed",
    fontSize: 42,
    fontWeight: "600",
    letterSpacing: -0.63,
    lineHeight: 42,
  },
  lead: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 330,
  },
  identityCard: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 6,
    flexDirection: "row",
    gap: 15,
    marginTop: 27,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  identityIcon: {
    alignItems: "center",
    backgroundColor: "#ECEDE3",
    borderRadius: 29,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityKicker: {
    color: colors.action,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.9,
  },
  identityTitle: {
    color: colors.ink,
    fontFamily: "BarlowCondensed",
    fontSize: 25,
    fontWeight: "600",
    lineHeight: 27,
    marginTop: 3,
  },
  identityText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  formSection: {
    marginTop: 29,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  codeInput: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 28,
    height: 68,
    letterSpacing: 8,
    marginTop: 14,
    paddingHorizontal: 15,
    textAlign: "center",
  },
  codeInputReady: {
    backgroundColor: colors.actionSoft,
    borderColor: "#A36E60",
  },
  codeCounter: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 7,
    textAlign: "right",
  },
  messageCard: {
    alignItems: "flex-start",
    backgroundColor: colors.actionSoft,
    borderColor: "#D8B9AF",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
    padding: 13,
  },
  messageText: {
    color: colors.action,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.action,
    borderRadius: 6,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 20,
    minHeight: 54,
    paddingHorizontal: 22,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: colors.paper,
    fontSize: 14,
    fontWeight: "600",
  },
  securityNote: {
    alignItems: "flex-start",
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 9,
    marginTop: 24,
    paddingTop: 16,
  },
  securityText: {
    color: colors.muted,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    alignItems: "center",
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    paddingTop: 16,
  },
  footerText: {
    color: colors.muted,
    fontSize: 10,
  },
  loadingState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 15,
  },
});
