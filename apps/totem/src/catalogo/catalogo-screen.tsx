import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { restoreDeviceSession } from "../device-pairing/session";
import type { NegocioIdentity } from "../device-pairing/types";
import { useKioskFonts } from "../kiosk/use-kiosk-fonts";
import { Action, KioskText } from "../kiosk/ui";
import { getCatalogoPublico } from "./api";
import type { CatalogCategory } from "./model";
import { BusinessKioskScreen } from "./business-kiosk";

type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      negocioId: string;
      categories: CatalogCategory[];
      negocio?: NegocioIdentity;
    };

export function CatalogoScreen() {
  const [fontsLoaded, fontError] = useKioskFonts();
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
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
        const categories = await getCatalogoPublico(
          session.dispositivo.negocioId,
          controller.signal,
        );
        if (cancelled) return;
        setState({
          status: "ready",
          negocioId: session.dispositivo.negocioId,
          categories,
          negocio: session.negocio,
        });
      } catch (error) {
        if (
          cancelled ||
          (error instanceof Error && error.name === "AbortError")
        )
          return;
        setState({
          status: "error",
          message:
            "Não foi possível carregar o catálogo. Verifique a conexão e tente novamente.",
        });
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reload, router]);
  if (fontsLoaded && state.status === "ready" && state.categories.length) {
    return (
      <BusinessKioskScreen
        key={state.negocioId}
        negocioId={state.negocioId}
        categories={state.categories}
        businessName={state.negocio?.nome}
        welcome={state.negocio?.mensagemBoasVindas ?? undefined}
        identificationMode={state.negocio?.modoIdentificacao}
      />
    );
  }
  const failed =
    !!fontError ||
    state.status === "error" ||
    (state.status === "ready" && !state.categories.length);
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.center}>
        {failed ? (
          <>
            <KioskText style={styles.title}>Cardápio indisponível</KioskText>
            <KioskText style={styles.copy}>
              {fontError
                ? "Não foi possível carregar a interface do totem."
                : state.status === "error"
                  ? state.message
                  : "O estabelecimento ainda não tem produtos disponíveis."}
            </KioskText>
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
