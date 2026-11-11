import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  restoreDeviceSession,
  type AuthenticatedSessionResult,
} from "../device-pairing/session";
import { useKioskFonts } from "../kiosk/use-kiosk-fonts";
import { Action, KioskText } from "../kiosk/ui";
import { getCatalogoPublico } from "./api";
import type { CatalogCategory } from "./model";
import { BusinessKioskScreen } from "./business-kiosk";

type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "authenticated";
      session: AuthenticatedSessionResult;
      categories?: CatalogCategory[];
      catalogFailed?: boolean;
    };

const emptyCatalog: CatalogCategory[] = [];

export function CatalogoScreen() {
  const [fontsLoaded, fontError] = useKioskFonts();
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      const session = await restoreDeviceSession({
        expectedDeviceType: "TOTEM",
      });
      if (cancelled) return;
      if (session.kind === "pairing") {
        router.replace("/parear");
        return;
      }
      if (session.kind === "error") {
        setState({ status: "error", message: session.message });
        return;
      }

      setState({ status: "authenticated", session });
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const categories = await getCatalogoPublico(
          session.dispositivo.negocioId,
          controller.signal,
        );
        if (!cancelled)
          setState({ status: "authenticated", session, categories });
      } catch {
        if (!cancelled)
          setState({ status: "authenticated", session, catalogFailed: true });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reload, router]);

  const error = fontError
    ? "Não foi possível carregar a interface do totem."
    : state.status === "error"
      ? state.message
      : state.status === "authenticated" && state.catalogFailed
        ? "Não foi possível carregar o catálogo. Verifique a conexão e tente novamente."
        : state.status === "authenticated" && state.categories?.length === 0
          ? "O estabelecimento ainda não tem produtos disponíveis."
          : undefined;
  const fallback = (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.center}>
        {error ? (
          <>
            <KioskText style={styles.title}>Cardápio indisponível</KioskText>
            <KioskText style={styles.copy}>{error}</KioskText>
            <Action
              onPress={() => {
                setState({ status: "loading" });
                setReload((current) => current + 1);
              }}
            >
              Tentar novamente
            </Action>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#773b2e" />
            <Text style={styles.copy}>Carregando o cardápio...</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );

  if (!fontsLoaded || state.status !== "authenticated") return fallback;

  const { dispositivo, negocio } = state.session;
  return (
    <BusinessKioskScreen
      key={dispositivo.id}
      negocioId={dispositivo.negocioId}
      dispositivoId={dispositivo.id}
      categories={state.categories ?? emptyCatalog}
      businessName={negocio?.nome}
      welcome={negocio?.mensagemBoasVindas ?? undefined}
      identificationMode={negocio?.modoIdentificacao}
      unavailableCatalog={state.categories?.length ? undefined : fallback}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 18,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "600",
    color: "#2d2622",
    textAlign: "center",
  },
  copy: { fontSize: 14, lineHeight: 22, color: "#716861", textAlign: "center" },
});
